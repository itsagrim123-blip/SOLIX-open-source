import asyncio
import json
import logging
import platform
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.core.auth import verify_dashboard_access
from app.core.config import settings
from app.core.logging_service import log_service
from app.core.metrics import metrics_service
from app.providers.factory import get_ollama_provider

logger = logging.getLogger("solix.api.dashboard")
router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(verify_dashboard_access)],
)


@router.get("/status")
async def get_dashboard_status():
    """Return comprehensive service health, model statuses, and system information."""
    provider = get_ollama_provider()

    # Ollama health
    is_ollama_connected = await provider.check_health()

    # Normal chat model status
    normal_model_name = settings.OLLAMA_MODEL
    normal_model_available = False

    # Web search model status
    web_model_name = settings.OLLAMA_WEB_MODEL
    web_model_available = False

    installed_models = []
    if is_ollama_connected:
        try:
            normal_model_available = await provider.model_exists(normal_model_name)
            web_model_available = await provider.model_exists(web_model_name)
            installed_models = await provider.list_models()
        except Exception as e:
            logger.warning(f"Error inspecting Ollama models: {e}")

    # Web search / Tavily status
    tavily_configured = bool(settings.TAVILY_API_KEY and settings.TAVILY_API_KEY.strip())
    web_search_status = (
        "ready"
        if (tavily_configured and web_model_available)
        else ("model_missing" if (tavily_configured and not web_model_available) else "not_configured")
    )

    stats = metrics_service.get_stats()

    return {
        "status": "healthy" if is_ollama_connected else "degraded",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "uptime_seconds": stats["uptime_seconds"],
        "uptime_formatted": stats["uptime_formatted"],
        "system": {
            "backend": "FastAPI",
            "python_version": platform.python_version(),
            "os": platform.system(),
            "streaming": "enabled",
            "database": "sqlite" if "sqlite" in settings.DATABASE_URL else "postgresql",
        },
        "services": {
            "api": "healthy",
            "ollama": "connected" if is_ollama_connected else "offline",
            "web_search": web_search_status,
            "tavily": "configured" if tavily_configured else "not_configured",
        },
        "models": {
            "normal": {
                "name": normal_model_name,
                "available": normal_model_available,
                "role": "Default model for normal chat",
            },
            "web_search": {
                "name": web_model_name,
                "available": web_model_available,
                "role": "Dedicated model enforced for web search queries",
            },
        },
        "installed_models": [
            {
                "id": m.get("id"),
                "name": m.get("name"),
                "size": m.get("size"),
                "family": m.get("details"),
                "is_default": m.get("is_default", False),
            }
            for m in installed_models
        ],
    }


@router.get("/stats")
async def get_dashboard_stats():
    """Return real-time request counts, throughput, and latency metrics."""
    return metrics_service.get_stats()


@router.get("/logs")
async def get_dashboard_logs(
    limit: int = Query(default=150, ge=1, le=500),
    level: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
):
    """Retrieve recent server logs with optional level and keyword filtering."""
    logs = log_service.get_recent_logs(limit=limit, level=level, search=search)
    return {
        "count": len(logs),
        "logs": logs,
    }


@router.get("/logs/stream")
async def stream_dashboard_logs():
    """Stream real-time server logs via Server-Sent Events (SSE)."""
    queue = log_service.subscribe()

    async def log_generator():
        # Emit initial connect acknowledgment
        yield f"data: {json.dumps({'type': 'connected', 'message': 'Live log stream established'})}\n\n"

        try:
            while True:
                try:
                    # Wait for next log with 15s keep-alive timeout
                    log_entry = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(log_entry)}\n\n"
                except asyncio.TimeoutError:
                    # Send comment ping to prevent connection timeout through proxies
                    yield ": ping\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            log_service.unsubscribe(queue)

    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/logs/clear")
async def clear_dashboard_logs():
    """Clear the in-memory displayed recent logs buffer."""
    log_service.clear()
    logger.info("Dashboard in-memory logs cleared by user.")
    return {"status": "cleared"}

