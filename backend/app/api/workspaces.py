import asyncio
import json
import logging
import os
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.providers.factory import get_active_provider
from app.services.workspace.assistant import CODING_SYSTEM_PROMPT, coding_assistant
from app.services.workspace.context import code_context_engine
from app.services.workspace.execution import execution_service
from app.services.workspace.languages import language_registry
from app.services.workspace.storage import workspace_storage
from app.services.workspace.agent import coding_agent_engine
from app.services.web_search_service import WebSearchService

logger = logging.getLogger("solix.api.workspaces")
router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


# ── Pydantic Request/Response Models ──────────────────────────────────────────

class CreateWorkspaceRequest(BaseModel):
    name: Optional[str] = Field(default=None, description="Optional workspace project name")
    template: str = Field(default="starter-python", description="Template to initialize with")


class CreateFileRequest(BaseModel):
    path: str = Field(..., description="Relative file or directory path")
    is_directory: bool = Field(default=False)
    content: str = Field(default="")


class UpdateFileRequest(BaseModel):
    content: str = Field(..., description="New file content")


class RenameRequest(BaseModel):
    old_path: str = Field(...)
    new_path: str = Field(...)


class RunCommandRequest(BaseModel):
    command: Optional[str] = Field(default=None, description="Explicit command to run")


class ApplyPatchRequest(BaseModel):
    file: str = Field(...)
    replacement_content: str = Field(...)


class WorkspaceChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    current_file: Optional[str] = None
    selected_code: Optional[str] = None
    open_files: Optional[List[str]] = None
    terminal_context: Optional[str] = None
    web_search: bool = Field(default=False)


class AgentRunRequest(BaseModel):
    message: Optional[str] = None
    request: Optional[str] = None
    current_file: Optional[str] = None
    active_file: Optional[str] = None
    auto_apply: bool = Field(default=False, description="Whether to auto-apply safe file changes")

    @property
    def prompt(self) -> str:
        return (self.message or self.request or "").strip()

    @property
    def target_file(self) -> Optional[str]:
        return self.current_file or self.active_file


class AgentApprovalRequest(BaseModel):
    approval_id: str = Field(..., description="Approval ID from approval_required event")
    approved: bool = Field(..., description="True to apply changes, False to reject")


# ── Workspace CRUD Endpoints ──────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workspace(payload: CreateWorkspaceRequest):
    """Initialize a new coding workspace directory."""
    try:
        meta = workspace_storage.create_workspace(name=payload.name, template=payload.template)
        return meta
    except Exception as e:
        logger.error(f"Failed to create workspace: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_workspaces():
    """List all available workspaces."""
    return workspace_storage.list_workspaces()


@router.get("/runtimes")
async def get_language_runtimes():
    """Detect and return real compiler and runtime availability on the host system."""
    runtimes = language_registry.detect_runtimes(force_refresh=True)
    return list(runtimes.values())


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str):
    """Get metadata for a specific workspace."""
    try:
        return workspace_storage.get_workspace(workspace_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str):
    """Delete a workspace and its files."""
    try:
        # Stop any active process first
        await execution_service.stop(workspace_id)
        success = workspace_storage.delete_workspace(workspace_id)
        if not success:
            raise HTTPException(status_code=404, detail="Workspace not found")
        return {"success": True, "id": workspace_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── File Explorer Endpoints ───────────────────────────────────────────────────

@router.get("/{workspace_id}/files")
async def get_workspace_tree(workspace_id: str):
    """Get recursive directory tree for a workspace."""
    try:
        return workspace_storage.get_workspace_tree(workspace_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{workspace_id}/files/{file_path:path}")
async def read_file(workspace_id: str, file_path: str):
    """Read a specific file from the workspace."""
    try:
        return workspace_storage.read_file(workspace_id, file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{workspace_id}/files/{file_path:path}")
async def write_file(workspace_id: str, file_path: str, payload: UpdateFileRequest):
    """Save content to a file in the workspace."""
    try:
        return workspace_storage.write_file(workspace_id, file_path, payload.content)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace or directory not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{workspace_id}/files", status_code=status.HTTP_201_CREATED)
async def create_file_or_dir(workspace_id: str, payload: CreateFileRequest):
    """Create a new file or directory."""
    try:
        return workspace_storage.create_file_or_dir(
            workspace_id,
            payload.path,
            is_directory=payload.is_directory,
            content=payload.content,
        )
    except FileExistsError:
        raise HTTPException(status_code=409, detail=f"Path '{payload.path}' already exists.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{workspace_id}/files/{file_path:path}")
async def delete_path(workspace_id: str, file_path: str):
    """Delete a file or folder from the workspace."""
    try:
        workspace_storage.delete_path(workspace_id, file_path)
        return {"success": True, "path": file_path}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Path not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{workspace_id}/rename")
async def rename_path(workspace_id: str, payload: RenameRequest):
    """Rename or move a file/folder in the workspace."""
    try:
        return workspace_storage.rename_path(workspace_id, payload.old_path, payload.new_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Source path not found")
    except FileExistsError:
        raise HTTPException(status_code=409, detail="Destination path already exists")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Execution Endpoints ───────────────────────────────────────────────────────

@router.post("/{workspace_id}/build")
async def build_project(workspace_id: str):
    """Compile project sources in the sandbox without executing."""
    try:
        result = await execution_service.build(workspace_id)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Build error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Build error: {str(e)}")


@router.post("/{workspace_id}/run")
async def run_code(workspace_id: str, payload: Optional[RunCommandRequest] = None):
    """Execute project entrypoint or user command in the sandbox."""
    cmd = payload.command if payload else None
    try:
        result = await execution_service.run(workspace_id, command=cmd, is_test=False)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Execution error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")


@router.post("/{workspace_id}/test")
async def test_code(workspace_id: str, payload: Optional[RunCommandRequest] = None):
    """Run tests for the project in the sandbox."""
    cmd = payload.command if payload else None
    try:
        result = await execution_service.run(workspace_id, command=cmd, is_test=True)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Workspace not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Test execution error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Test execution error: {str(e)}")


@router.post("/{workspace_id}/stop")
async def stop_execution(workspace_id: str):
    """Stop any actively running process for this workspace."""
    stopped = await execution_service.stop(workspace_id=workspace_id)
    return {"success": stopped, "workspace_id": workspace_id}


@router.post("/{workspace_id}/executions/{execution_id}/stop")
async def stop_specific_execution(workspace_id: str, execution_id: str):
    """Stop a specific running execution process."""
    stopped = await execution_service.stop(workspace_id=workspace_id, execution_id=execution_id)
    return {"success": stopped, "workspace_id": workspace_id, "execution_id": execution_id}


# ── Patch Application Endpoint ────────────────────────────────────────────────

@router.post("/{workspace_id}/apply-patch")
async def apply_patch(workspace_id: str, payload: ApplyPatchRequest):
    """Apply a structured patch proposed by Solix to a workspace file."""
    try:
        return coding_assistant.apply_patch(
            workspace_id,
            payload.file,
            payload.replacement_content,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Target file '{payload.file}' not found.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Git Status Endpoint (Read-Only) ───────────────────────────────────────────

@router.get("/{workspace_id}/git/status")
async def get_git_status(workspace_id: str):
    """Read-only Git branch and change detection."""
    try:
        ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
        git_dir = ws_dir / ".git"
        if not git_dir.exists():
            return {"is_repo": False, "branch": None, "modified": [], "untracked": []}

        # Query git branch and status safely without shell
        branch_proc = await asyncio.create_subprocess_exec(
            "git", "branch", "--show-current",
            cwd=str(ws_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        b_out, _ = await branch_proc.communicate()
        branch_name = b_out.decode("utf-8").strip() or "main"

        status_proc = await asyncio.create_subprocess_exec(
            "git", "status", "--porcelain",
            cwd=str(ws_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        s_out, _ = await status_proc.communicate()
        status_lines = s_out.decode("utf-8").splitlines()

        modified = []
        untracked = []
        for line in status_lines:
            if not line.strip():
                continue
            code = line[:2]
            fname = line[3:].strip()
            if "??" in code:
                untracked.append(fname)
            else:
                modified.append(fname)

        return {
            "is_repo": True,
            "branch": branch_name,
            "modified": modified,
            "untracked": untracked,
        }
    except Exception as e:
        return {"is_repo": False, "error": str(e), "branch": None, "modified": [], "untracked": []}


# ── Coding Assistant Streaming Chat Endpoint ──────────────────────────────────

@router.post("/{workspace_id}/chat")
async def workspace_chat(workspace_id: str, payload: WorkspaceChatRequest):
    """Stream coding assistant responses via SSE with grounded multi-file codebase context."""
    try:
        # 1. Build rich codebase context
        project_context = code_context_engine.build_context(
            workspace_id=workspace_id,
            query=payload.message,
            current_file=payload.current_file,
            selected_code=payload.selected_code,
            open_files=payload.open_files,
        )

        user_prompt = payload.message.strip()

        # If terminal error context is present, append it to user query
        if payload.terminal_context and payload.terminal_context.strip():
            user_prompt += (
                f"\n\n[TERMINAL OUTPUT / RUNTIME ERROR CONTEXT]:\n"
                f"```\n{payload.terminal_context.strip()[:3000]}\n```"
            )

        messages = [
            {"role": "user", "content": f"{project_context}\n\n--- USER REQUEST ---\n{user_prompt}"}
        ]

        provider, is_connected = await get_active_provider()
        if not is_connected:
            async def offline_generator() -> AsyncGenerator[str, None]:
                yield f"data: {json.dumps({'type': 'error', 'error': f'Code AI unavailable — Ollama is offline at {settings.OLLAMA_BASE_URL}. Please start Ollama.'})}\n\n"
            return StreamingResponse(
                offline_generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        # Model routing: prefer qwen2.5-coder:7b for coding
        model_name = settings.OLLAMA_CODING_MODEL
        if payload.web_search:
            model_name = settings.OLLAMA_WEB_MODEL

        # Check if requested model exists, otherwise fallback to default
        if hasattr(provider, "resolve_model_name"):
            resolved = await provider.resolve_model_name(model_name)
            if resolved:
                model_name = resolved
            else:
                model_name = settings.OLLAMA_MODEL

        async def sse_generator() -> AsyncGenerator[str, None]:
            # Initial event
            start_payload = {
                "type": "start",
                "workspace_id": workspace_id,
                "model": model_name,
                "web_search": payload.web_search,
            }
            yield f"data: {json.dumps(start_payload)}\n\n"

            accumulated_text = []

            # Handle web search if requested
            if payload.web_search and settings.TAVILY_API_KEY:
                try:
                    yield f"data: {json.dumps({'type': 'search_started', 'query': payload.message})}\n\n"
                    search_svc = WebSearchService()
                    sources = await search_svc.search(payload.message)
                    sources_dict = [s.model_dump() for s in sources]
                    yield f"data: {json.dumps({'type': 'search_results', 'sources': sources_dict})}\n\n"
                    search_context = search_svc.build_search_context(sources)
                    messages[0]["content"] += f"\n\n--- WEB SEARCH RESULTS ---\n{search_context}"
                except Exception as e:
                    logger.warning(f"Web search in coding workspace failed: {e}")

            try:
                async for chunk in provider.generate_stream(
                    messages=messages,
                    model=model_name,
                    system_prompt=CODING_SYSTEM_PROMPT,
                    temperature=0.3,  # Lower temperature for coding precision
                ):
                    accumulated_text.append(chunk)
                    yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"

                full_response = "".join(accumulated_text)

                # Check if a structured patch was generated
                patch_data = coding_assistant.extract_patch(full_response)
                if patch_data:
                    target_file = patch_data.get("file", "")
                    repl_content = patch_data.get("replacement_content", "")
                    explanation = patch_data.get("explanation", "Proposed code modification")

                    # Generate diff if target file exists
                    diff_str = ""
                    try:
                        orig = workspace_storage.read_file(workspace_id, target_file)
                        diff_str = coding_assistant.generate_diff(orig["content"], repl_content, filename=target_file)
                    except Exception:
                        diff_str = f"+++ New File: {target_file}\n{repl_content}"

                    patch_event = {
                        "type": "patch_ready",
                        "file": target_file,
                        "explanation": explanation,
                        "replacement_content": repl_content,
                        "diff": diff_str,
                    }
                    yield f"data: {json.dumps(patch_event)}\n\n"

                yield f"data: {json.dumps({'type': 'done'})}\n\n"

            except Exception as e:
                logger.error(f"Coding stream error: {e}", exc_info=True)
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

        return StreamingResponse(
            sse_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        logger.error(f"Failed to initiate workspace chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Autonomous Coding Agent Endpoints ──────────────────────────────────────────

@router.post("/{workspace_id}/agent/run")
async def run_autonomous_agent(workspace_id: str, payload: AgentRunRequest):
    """Initiate an autonomous coding agent loop with SSE streaming."""
    try:
        user_prompt = payload.prompt
        if not user_prompt:
            raise HTTPException(status_code=422, detail="Message or request prompt is required")

        generator = coding_agent_engine.run_agent_loop(
            workspace_id=workspace_id,
            user_request=user_prompt,
            active_file=payload.target_file,
            auto_apply=payload.auto_apply,
        )

        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        logger.error(f"[AgentEndpoint] Failed to initiate autonomous agent: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{workspace_id}/agent/{task_id}/approve")
async def approve_agent_change(workspace_id: str, task_id: str, payload: AgentApprovalRequest):
    """Approve or reject a staged file modification requested by the agent."""
    resolved = coding_agent_engine.resolve_approval(
        task_id=task_id,
        approval_id=payload.approval_id,
        approved=payload.approved,
    )
    if not resolved:
        raise HTTPException(status_code=404, detail="Pending approval not found or task already resolved.")
    return {"success": True, "approval_id": payload.approval_id, "approved": payload.approved}


@router.post("/{workspace_id}/agent/{task_id}/stop")
async def stop_agent_task(workspace_id: str, task_id: str):
    """Cancel and stop an active autonomous agent task."""
    stopped = coding_agent_engine.cancel_task(task_id)
    return {"success": stopped, "task_id": task_id}

