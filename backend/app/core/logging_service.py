import asyncio
from collections import deque
from datetime import datetime
import logging
import re
import threading
from typing import Any, Dict, List, Optional, Set
from app.core.config import settings

# Regex to scrub sensitive API keys and tokens from displayed logs
_KEY_SCRUBBER = re.compile(r"(tvly-[A-Za-z0-9_-]{10,}|bearer\s+[A-Za-z0-9_.-]{10,})", re.IGNORECASE)


class LogService:
    """Centralized log storage and SSE distribution manager."""

    def __init__(self, max_logs: int = 500):
        self._max_logs = max_logs
        self._buffer: deque = deque(maxlen=max_logs)
        self._lock = threading.Lock()
        self._subscribers: Set[asyncio.Queue] = set()
        self._counter = 0
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        """Set the active asyncio event loop for threadsafe subscriber notifications."""
        self._loop = loop

    def add_log(
        self,
        level: str,
        logger_name: str,
        message: str,
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record and broadcast a log entry."""
        # Sanitize any accidental secrets
        clean_msg = _KEY_SCRUBBER.sub("[REDACTED_SECRET]", message)

        now = datetime.now()
        with self._lock:
            self._counter += 1
            entry = {
                "id": self._counter,
                "timestamp": now.isoformat(),
                "time_str": now.strftime("%H:%M:%S"),
                "level": level.upper(),
                "logger": logger_name,
                "message": clean_msg,
                "request_id": request_id,
            }
            self._buffer.append(entry)

        # Notify SSE subscribers
        self._broadcast(entry)
        return entry

    def _broadcast(self, entry: Dict[str, Any]):
        """Safely broadcast log entry to all active SSE queues."""
        if not self._subscribers:
            return

        dead_queues = set()
        for q in list(self._subscribers):
            try:
                if self._loop and self._loop.is_running():
                    self._loop.call_soon_threadsafe(
                        lambda queue=q, item=entry: self._safe_put(queue, item)
                    )
                else:
                    self._safe_put(q, entry)
            except Exception:
                dead_queues.add(q)

        if dead_queues:
            with self._lock:
                self._subscribers.difference_update(dead_queues)

    @staticmethod
    def _safe_put(queue: asyncio.Queue, item: Dict[str, Any]):
        """Put item into queue without raising on full queue."""
        try:
            queue.put_nowait(item)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()
                queue.put_nowait(item)
            except Exception:
                pass

    def get_recent_logs(
        self,
        limit: int = 150,
        level: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve recent logs with optional level and search filtering."""
        with self._lock:
            logs = list(self._buffer)

        if level and level.upper() != "ALL":
            target_level = level.upper()
            logs = [entry for entry in logs if entry["level"] == target_level]

        if search:
            query = search.lower().strip()
            logs = [
                entry
                for entry in logs
                if query in entry["message"].lower()
                or query in entry["logger"].lower()
                or (entry.get("request_id") and query in entry["request_id"].lower())
            ]

        return logs[-limit:]

    def subscribe(self) -> asyncio.Queue:
        """Register a new SSE stream subscriber queue."""
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        with self._lock:
            self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        """Unregister an SSE stream subscriber queue."""
        with self._lock:
            self._subscribers.discard(q)

    def clear(self):
        """Clear the in-memory recent log buffer."""
        with self._lock:
            self._buffer.clear()


log_service = LogService(max_logs=settings.DASHBOARD_MAX_LOGS)


class DashboardLogHandler(logging.Handler):
    """Python logging handler that captures log records into the Dashboard log_service."""

    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            req_id = getattr(record, "request_id", None)
            log_service.add_log(
                level=record.levelname,
                logger_name=record.name,
                message=msg,
                request_id=req_id,
            )
        except Exception:
            self.handleError(record)

