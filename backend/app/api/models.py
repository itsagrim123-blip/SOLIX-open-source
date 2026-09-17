from fastapi import APIRouter
from app.core.config import settings
from app.models.schemas import ModelInfo, ModelsResponse
from app.providers.factory import get_active_provider

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("", response_model=ModelsResponse)
async def get_available_models():
    """Retrieve list of currently available AI models and provider status."""
    provider, is_connected = await get_active_provider()
    raw_models = await provider.list_models()

    models = [
        ModelInfo(
            id=m.get("id", settings.OLLAMA_MODEL),
            name=m.get("name", settings.OLLAMA_MODEL),
            details=m.get("details"),
            size=m.get("size"),
            modified_at=str(m.get("modified_at", "")),
            is_default=m.get("is_default", False) or m.get("id") == settings.OLLAMA_MODEL,
        )
        for m in raw_models
    ]

    # Ensure at least the configured model is listed
    if not any(m.id == settings.OLLAMA_MODEL for m in models):
        models.insert(
            0,
            ModelInfo(
                id=settings.OLLAMA_MODEL,
                name=f"{settings.OLLAMA_MODEL} (Default)",
                details="Ollama configured model",
                is_default=True,
            ),
        )

    return ModelsResponse(
        models=models,
        default_model=settings.OLLAMA_MODEL,
        provider=provider.name,
        provider_connected=is_connected,
    )

