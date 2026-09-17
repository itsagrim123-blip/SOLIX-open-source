from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MessageSchema(BaseModel):
    """Schema for individual chat messages."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str = Field(..., description="'user', 'assistant', or 'system'")
    content: str
    timestamp: datetime


class ConversationSummary(BaseModel):
    """Summary schema for conversations listed in the sidebar."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ConversationDetail(BaseModel):
    """Detailed conversation schema including complete message thread."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageSchema] = []


class CreateConversationRequest(BaseModel):
    """Payload to initialize a new conversation."""
    title: Optional[str] = Field(default="New Chat", max_length=255)


class UpdateConversationRequest(BaseModel):
    """Payload to update conversation metadata."""
    title: str = Field(..., min_length=1, max_length=255)


class ChatRequest(BaseModel):
    """Payload for conversational interaction."""
    message: str = Field(..., min_length=1, description="User prompt text")
    conversation_id: Optional[str] = Field(
        default=None,
        description="Target conversation ID. If omitted, a new conversation is automatically created.",
    )
    model: Optional[str] = Field(default=None, description="Requested AI model identifier")
    system_prompt: Optional[str] = Field(default=None, description="Optional custom system prompt")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)


class ModelInfo(BaseModel):
    """Representation of an available AI model."""
    id: str
    name: str
    details: Optional[str] = None
    size: Optional[int] = None
    modified_at: Optional[str] = None
    is_default: bool = False


class ModelsResponse(BaseModel):
    """Response containing available models and provider connectivity."""
    models: List[ModelInfo]
    default_model: str
    provider: str
    provider_connected: bool


class HealthResponse(BaseModel):
    """System health check response."""
    status: str
    version: str
    provider: str
    provider_connected: bool
    database: str

