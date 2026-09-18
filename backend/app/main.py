import asyncio
from contextlib import asynccontextmanager
import logging
import os
from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from app.api import chat, conversations, dashboard, files, health, models, workspaces
from app.core.auth import verify_dashboard_access
from app.core.config import settings
from app.core.database import init_db
from app.core.logging_service import DashboardLogHandler, log_service
from app.core.middleware import RequestLoggingMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# Attach centralized Dashboard Log Handler to capture all application logs
_dashboard_log_handler = DashboardLogHandler()
_dashboard_log_handler.setLevel(logging.INFO)
_dashboard_log_handler.setFormatter(logging.Formatter("%(message)s"))
logging.getLogger().addHandler(_dashboard_log_handler)

logger = logging.getLogger("solix.main")

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events (startup & shutdown)."""
    # Register active event loop for threadsafe SSE broadcasts
    loop = asyncio.get_running_loop()
    log_service.set_event_loop(loop)

    logger.info("Initializing Solix AI Database...")
    await init_db()
    logger.info("Database initialized successfully.")
    logger.info(f"Ollama configured at: {settings.OLLAMA_BASE_URL} (Model: {settings.OLLAMA_MODEL})")
    logger.info(f"Web Search model: {settings.OLLAMA_WEB_MODEL} (Tavily: {'Configured' if settings.TAVILY_API_KEY else 'Not Configured'})")
    logger.info("Solix Backend Dashboard ready at GET /")
    yield
    logger.info("Shutting down Solix AI backend...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Futuristic AI Chatbot API with Ollama & Provider Abstraction",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# 1. Request logging & telemetry middleware
app.add_middleware(RequestLoggingMiddleware)

# 2. CORS middleware (supports local, custom domain, and *.vercel.app preview deployments)
logger.info(f"CORS origins: {settings.cors_origins_list}, regex: {settings.CORS_ORIGIN_REGEX}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please check server logs."},
    )


# Static files (logo and assets)
@app.get("/static/{file_path:path}")
async def serve_static(file_path: str):
    """Serve backend static assets such as the Solix dragon logo."""
    full_path = os.path.join(STATIC_DIR, file_path)
    if os.path.isfile(full_path):
        return FileResponse(full_path)
    return JSONResponse(status_code=404, content={"detail": "Static file not found"})


# Register API Routers under /api
app.include_router(health.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(workspaces.router, prefix="/api")


# Machine-readable root health check endpoint
@app.get("/health", response_model=health.HealthResponse, tags=["Health"])
async def root_health():
    """Machine-readable system health check endpoint."""
    return await health.health_check()


# Solix Backend Dashboard served at root
@app.get("/", response_class=HTMLResponse, tags=["Dashboard"])
async def root_dashboard(authorized: bool = Depends(verify_dashboard_access)):
    """Serve the Solix Backend Monitoring Dashboard."""
    dashboard_path = os.path.join(TEMPLATES_DIR, "dashboard.html")
    if os.path.isfile(dashboard_path):
        with open(dashboard_path, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    return HTMLResponse("<h1>Solix AI Backend Online</h1><p>Visit /docs for API documentation.</p>")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.APP_ENV == "development"),
    )
