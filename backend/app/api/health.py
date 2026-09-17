from fastapi import APIRouter
from app.core.config import settings
from app.models.schemas import HealthResponse
from app.providers.factory import get_ollama_provider

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=HealthResponse)
async def health_check():
    """Verify backend health, database connectivity, and AI provider availability."""
    provider = get_ollama_provider()
    is_connected = await provider.check_health()

    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        provider=provider.name,
        provider_connected=is_connected,
        database="sqlite" if "sqlite" in settings.DATABASE_URL else "postgresql",
    )

