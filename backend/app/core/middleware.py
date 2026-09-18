import logging
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.metrics import metrics_service

logger = logging.getLogger("solix.http")

# Endpoints that should not generate request-level logs to prevent log loop spam
_EXCLUDED_LOG_PATHS = {
    "/api/dashboard/logs/stream",
    "/api/dashboard/logs",
    "/favicon.ico",
}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """ASGI middleware to generate request IDs, measure response time, and record metrics."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        request_id = f"req_{uuid.uuid4().hex[:6]}"
        request.state.request_id = request_id

        # Skip metrics & logging for internal continuous log streaming
        if path == "/api/dashboard/logs/stream":
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response

        start_time = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as exc:
            logger.error(
                f"[{request_id}] Exception handling {request.method} {path}: {exc}",
                extra={"request_id": request_id},
            )
            raise
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Record telemetry in metrics service
            is_chat = path.endswith("/chat")
            metrics_service.record_request(
                method=request.method,
                path=path,
                status_code=status_code,
                duration_ms=duration_ms,
                is_chat=is_chat,
            )

            # Log clean request summary if path is not excluded
            if path not in _EXCLUDED_LOG_PATHS:
                logger.info(
                    f"[{request_id}] {request.method} {path} status={status_code} duration={duration_ms:.1f}ms",
                    extra={"request_id": request_id},
                )

