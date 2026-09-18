import json
import logging
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal, get_db
from app.models.schemas import ChatRequest
from app.providers.factory import get_active_provider
from app.providers.ollama import ModelNotFoundError, OllamaConnectionError
from app.services import conversation_service
from app.services.web_search_service import WebSearchService

logger = logging.getLogger("solix.api.chat")
router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("")
async def send_chat_message(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Process a chat interaction and stream back the response using Server-Sent Events (SSE).

    Routing:
      - web_search=False (default): existing Ollama path using the user-selected model.
      - web_search=True: WebSearchService pipeline using OLLAMA_WEB_MODEL (qwen3:8b).
    """
    user_prompt = payload.message.strip()
    if not user_prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty.",
        )

    # 1. Resolve or create conversation
    conversation = None
    if payload.conversation_id:
        conversation = await conversation_service.get_conversation(db, payload.conversation_id)

    if not conversation:
        title = conversation_service.generate_title_from_prompt(user_prompt)
        conversation = await conversation_service.create_conversation(db, title=title)
    elif conversation.title == "New Chat":
        new_title = conversation_service.generate_title_from_prompt(user_prompt)
        await conversation_service.update_conversation_title(db, conversation.id, new_title)
        conversation.title = new_title

    conv_id = conversation.id
    current_title = conversation.title

    # 2. Persist user message
    await conversation_service.add_message(
        db,
        conversation_id=conv_id,
        role="user",
        content=user_prompt,
    )

    # 3. Reliably load complete conversation history directly from database
    raw_messages = await conversation_service.get_conversation_messages(db, conv_id)
    history = [
        {"role": m.role, "content": m.content}
        for m in raw_messages
    ]
    # Ensure current user message is always in history
    if not history or history[-1].get("content") != user_prompt:
        history.append({"role": "user", "content": user_prompt})

    # ── File Intelligence context retrieval ────────────────────────────────────
    file_context_str: Optional[str] = None
    retrieved_chunks_count: int = 0
    if payload.file_ids:
        from app.services.files import file_service
        all_chunks = file_service.get_chunks(payload.file_ids)
        if all_chunks:
            retrieved_chunks = file_service.retriever.retrieve(
                query=user_prompt,
                chunks=all_chunks,
                file_ids=payload.file_ids,
            )
            retrieved_chunks_count = len(retrieved_chunks)
            file_context_str = file_service.retriever.build_context_block(retrieved_chunks)
            logger.info(f"[Chat] File Intelligence: Retrieved {retrieved_chunks_count} chunks from {len(payload.file_ids)} attached files")
        else:
            logger.warning(f"[Chat] File Intelligence: No chunks found for file IDs: {payload.file_ids}")

    # ── Web Search path ────────────────────────────────────────────────────────
    if payload.web_search:
        logger.info(f"[Chat] Web Search mode — conv={conv_id} (files: {len(payload.file_ids or [])})")

        async def web_search_sse_stream() -> AsyncGenerator[str, None]:
            # Emit start event first so the frontend knows the conv_id
            start_data = {
                "type": "start",
                "conversation_id": conv_id,
                "title": current_title,
                "provider": "ollama",
                "provider_connected": True,
                "web_search": True,
            }
            yield f"data: {json.dumps(start_data)}\n\n"

            if payload.file_ids:
                file_status_data = {
                    "type": "file_status",
                    "status": "ready",
                    "chunk_count": retrieved_chunks_count,
                    "conversation_id": conv_id,
                }
                yield f"data: {json.dumps(file_status_data)}\n\n"

            full_response = ""
            sources = []

            try:
                service = WebSearchService()
            except EnvironmentError as exc:
                # TAVILY_API_KEY missing
                logger.error(f"[Chat][WebSearch] Config error: {exc}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(exc), 'conversation_id': conv_id})}\n\n"
                return

            async for sse_line in service.run(
                query=user_prompt,
                conversation_id=conv_id,
                history=history,
                temperature=payload.temperature,
                file_context=file_context_str,
            ):
                # Capture done payload to persist to DB
                if sse_line.startswith("data: "):
                    try:
                        evt = json.loads(sse_line[6:])
                        if evt.get("type") == "done":
                            full_response = evt.get("full_content", "")
                            sources = evt.get("sources", [])
                    except Exception:
                        pass

                yield sse_line

            # Persist assistant message + source metadata to backend DB
            if full_response:
                async with AsyncSessionLocal() as save_db:
                    await conversation_service.add_message(
                        save_db,
                        conversation_id=conv_id,
                        role="assistant",
                        content=full_response,
                    )

            logger.info(f"[Chat][WebSearch] Done — {len(sources)} sources persisted")

        return StreamingResponse(
            web_search_sse_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # ── Normal chat path ──────────────────────────────────────────────────────
    provider, is_connected = await get_active_provider()

    async def sse_event_stream() -> AsyncGenerator[str, None]:
        full_content_chunks = []

        # Send start event with conversation ID and title
        start_data = {
            "type": "start",
            "conversation_id": conv_id,
            "title": current_title,
            "provider": provider.name,
            "provider_connected": is_connected,
        }
        yield f"data: {json.dumps(start_data)}\n\n"

        if payload.file_ids:
            file_status_data = {
                "type": "file_status",
                "status": "ready",
                "chunk_count": retrieved_chunks_count,
                "conversation_id": conv_id,
            }
            yield f"data: {json.dumps(file_status_data)}\n\n"

        effective_system_prompt = payload.system_prompt or "You are Solix AI, a helpful, precise, and thoughtful AI assistant."
        if file_context_str:
            effective_system_prompt = f"{effective_system_prompt}\n\n{file_context_str}"

        try:
            async for token in provider.generate_stream(
                messages=history,
                model=payload.model,
                temperature=payload.temperature,
                system_prompt=effective_system_prompt,
            ):
                full_content_chunks.append(token)
                token_data = {"type": "token", "content": token}
                yield f"data: {json.dumps(token_data)}\n\n"

            full_response = "".join(full_content_chunks)

            # If no content was generated at all, yield an identifiable error
            if not full_response.strip():
                logger.warning(f"[Chat] Stream ended with empty content for model '{payload.model}'")
                err_data = {
                    "type": "error",
                    "error": f"The model '{payload.model or provider.name}' produced an empty response. Please verify model status and retry.",
                    "conversation_id": conv_id,
                }
                yield f"data: {json.dumps(err_data)}\n\n"
                return

            # Persist assistant response in DB
            assistant_msg_id = None
            async with AsyncSessionLocal() as save_db:
                saved_msg = await conversation_service.add_message(
                    save_db,
                    conversation_id=conv_id,
                    role="assistant",
                    content=full_response,
                )
                assistant_msg_id = saved_msg.id

            done_data = {
                "type": "done",
                "conversation_id": conv_id,
                "message_id": assistant_msg_id,
                "full_content": full_response,
            }
            yield f"data: {json.dumps(done_data)}\n\n"

        except ModelNotFoundError as exc:
            logger.error(f"[Chat] ModelNotFoundError: {exc}")
            err_data = {
                "type": "error",
                "error": str(exc),
                "conversation_id": conv_id,
            }
            yield f"data: {json.dumps(err_data)}\n\n"

        except OllamaConnectionError as exc:
            logger.error(f"[Chat] OllamaConnectionError: {exc}")
            err_data = {
                "type": "error",
                "error": str(exc),
                "conversation_id": conv_id,
            }
            yield f"data: {json.dumps(err_data)}\n\n"

        except Exception as exc:
            logger.error(f"[Chat] Error during streaming: {exc}", exc_info=True)
            err_data = {
                "type": "error",
                "error": str(exc),
                "conversation_id": conv_id,
            }
            yield f"data: {json.dumps(err_data)}\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
