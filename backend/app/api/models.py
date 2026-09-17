import logging
from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.models.schemas import ModelInfo, ModelsResponse, SwitchModelRequest, SwitchModelResponse
from app.providers.factory import get_active_provider
from app.providers.ollama import ModelNotFoundError

logger = logging.getLogger("solix.api.models")
router = APIRouter(prefix="/models", tags=["Models"])


@router.get("", response_model=ModelsResponse)
async def get_available_models():
    """Retrieve list of currently available AI models and provider status."""
    provider, is_connected = await get_active_provider()
    raw_models = await provider.list_models()

    active_model = getattr(provider, "active_model", settings.OLLAMA_MODEL)

    models = [
        ModelInfo(
            id=m.get("id"),
            name=m.get("name"),
            details=m.get("details"),
            size=m.get("size"),
            modified_at=str(m.get("modified_at", "")),
            is_default=(m.get("id") == active_model or (not active_model and m.get("id") == settings.OLLAMA_MODEL)),
        )
        for m in raw_models
    ]

    # Resolve effective default model
    default_model = active_model
    if models:
        # If active_model is in the list, keep it; otherwise default to first available
        if not any(m.id == active_model for m in models):
            default_model = models[0].id
            models[0].is_default = True
    else:
        default_model = settings.OLLAMA_MODEL

    return ModelsResponse(
        models=models,
        default_model=default_model,
        provider=provider.name,
        provider_connected=is_connected,
    )


@router.post("/switch", response_model=SwitchModelResponse)
async def switch_model(payload: SwitchModelRequest):
    """Switch active AI model: frees RTX 4050 6GB VRAM, preloads selected model, and confirms ready."""
    provider, is_connected = await get_active_provider()
    target = payload.model.strip()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Model name must not be empty.",
        )

    if not is_connected or provider.name != "ollama":
        return SwitchModelResponse(
            status="ready",
            model=target,
            message=f"Model '{target}' selected (preview mode).",
        )

    try:
        result = await provider.switch_model(target)
        return SwitchModelResponse(
            status=result.get("status", "ready"),
            model=result.get("model", target),
            message=result.get("message", f"Model {target} is ready."),
            vram_usage=result.get("vram_usage"),
        )
    except ModelNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"Error switching model to '{target}': {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to switch model to '{target}': {str(exc)}",
        )
