from fastapi import APIRouter
from app.core.config import settings
from app.models.schemas import HealthResponse
from app.providers.factory import get_ollama_provider

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=HealthResponse)
async def health_check():
    """Verify backend health, database connectivity, Ollama status, and selected model availability."""
    provider = get_ollama_provider()
    is_connected = await provider.check_health()

    active_model = getattr(provider, "active_model", settings.OLLAMA_MODEL)
    web_model = settings.OLLAMA_WEB_MODEL

    model_available = False
    web_model_available = False
    if is_connected:
        model_available = await provider.model_exists(active_model)
        web_model_available = await provider.model_exists(web_model)

    tavily_configured = bool(settings.TAVILY_API_KEY and settings.TAVILY_API_KEY.strip())
    web_search_state = "ready" if tavily_configured and web_model_available else ("configured" if tavily_configured else "not_configured")

    return HealthResponse(
        status="healthy" if is_connected else "degraded",
        version=settings.APP_VERSION,
        provider=provider.name,
        provider_connected=is_connected,
        database="sqlite" if "sqlite" in settings.DATABASE_URL else "postgresql",
        ollama=is_connected,
        model=active_model,
        model_available=model_available,
        normal_model="available" if model_available else "not_installed",
        web_model="available" if web_model_available else "not_installed",
        web_search=web_search_state,
        streaming="enabled",
    )

