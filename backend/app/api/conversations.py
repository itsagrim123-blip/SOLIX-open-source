from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.schemas import (
    ConversationDetail,
    ConversationSummary,
    CreateConversationRequest,
    UpdateConversationRequest,
)
from app.services import conversation_service

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("", response_model=List[ConversationSummary])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    """Retrieve all conversation summaries for the sidebar list."""
    return await conversation_service.list_conversations(db)


@router.post("", response_model=ConversationDetail, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: CreateConversationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new blank conversation session."""
    conv = await conversation_service.create_conversation(db, title=payload.title)
    # Refresh to ensure relationships are initialized
    return await conversation_service.get_conversation(db, conv.id)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve complete conversation with all associated messages."""
    conv = await conversation_service.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found.",
        )
    return conv


@router.patch("/{conversation_id}", response_model=ConversationDetail)
async def update_conversation_title(
    conversation_id: str,
    payload: UpdateConversationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update conversation title."""
    conv = await conversation_service.update_conversation_title(
        db, conversation_id, payload.title.strip()
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found.",
        )
    return conv


@router.delete("/{conversation_id}", status_code=status.HTTP_200_OK)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation and all its messages."""
    deleted = await conversation_service.delete_conversation(db, conversation_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found.",
        )
    return {"success": True, "id": conversation_id}

