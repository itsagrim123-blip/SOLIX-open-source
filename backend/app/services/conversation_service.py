import re
import uuid
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.conversation import Conversation, Message, get_utc_now
from app.models.schemas import ConversationSummary


async def list_conversations(db: AsyncSession) -> List[ConversationSummary]:
    """List all conversations ordered by last update time, including message count."""
    # Query conversations with count of associated messages
    stmt = (
        select(
            Conversation.id,
            Conversation.title,
            Conversation.created_at,
            Conversation.updated_at,
            func.count(Message.id).label("message_count"),
        )
        .outerjoin(Message, Conversation.id == Message.conversation_id)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        ConversationSummary(
            id=row.id,
            title=row.title,
            created_at=row.created_at,
            updated_at=row.updated_at,
            message_count=row.message_count,
        )
        for row in rows
    ]


async def create_conversation(
    db: AsyncSession,
    title: Optional[str] = "New Chat",
) -> Conversation:
    """Create a new conversation session."""
    conversation = Conversation(
        id=str(uuid.uuid4()),
        title=title or "New Chat",
        created_at=get_utc_now(),
        updated_at=get_utc_now(),
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def get_conversation(
    db: AsyncSession,
    conversation_id: str,
) -> Optional[Conversation]:
    """Retrieve conversation by ID with loaded messages."""
    stmt = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
        .execution_options(populate_existing=True)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_conversation_messages(
    db: AsyncSession,
    conversation_id: str,
) -> List[Message]:
    """Directly query all messages for a conversation ordered by timestamp."""
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_conversation_title(
    db: AsyncSession,
    conversation_id: str,
    title: str,
) -> Optional[Conversation]:
    """Update title of an existing conversation."""
    conversation = await get_conversation(db, conversation_id)
    if not conversation:
        return None
    conversation.title = title
    conversation.updated_at = get_utc_now()
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def delete_conversation(
    db: AsyncSession,
    conversation_id: str,
) -> bool:
    """Delete a conversation and all its messages."""
    conversation = await get_conversation(db, conversation_id)
    if not conversation:
        return False
    await db.delete(conversation)
    await db.commit()
    return True


async def add_message(
    db: AsyncSession,
    conversation_id: str,
    role: str,
    content: str,
) -> Message:
    """Add a new message to a conversation and update conversation timestamp."""
    message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role=role,
        content=content,
        timestamp=get_utc_now(),
    )
    db.add(message)

    # Update conversation's updated_at
    conversation = await get_conversation(db, conversation_id)
    if conversation:
        conversation.updated_at = get_utc_now()

    await db.commit()
    await db.refresh(message)
    return message


def generate_title_from_prompt(prompt: str) -> str:
    """Generate a clean, readable conversation title from the initial prompt."""
    cleaned = re.sub(r"[^\w\s-]", "", prompt).strip()
    words = cleaned.split()
    if not words:
        return "New Chat"
    title = " ".join(words[:6])
    if len(title) > 40:
        title = title[:37] + "..."
    return title.capitalize()

