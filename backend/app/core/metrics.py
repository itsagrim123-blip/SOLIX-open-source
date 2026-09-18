import time
from collections import deque
from typing import Dict, Any


class MetricsService:
    """Thread-safe in-memory metrics and request performance tracker."""

    def __init__(self):
        self.server_start_time = time.time()
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.web_search_requests = 0
        self.chat_requests = 0
        self.recent_durations = deque(maxlen=500)
        self.recent_request_timestamps = deque(maxlen=500)

    def record_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        is_web_search: bool = False,
        is_chat: bool = False,
    ):
        """Record telemetry for a completed HTTP request."""
        now = time.time()
        self.total_requests += 1
        self.recent_durations.append(duration_ms)
        self.recent_request_timestamps.append(now)

        if 200 <= status_code < 400:
            self.successful_requests += 1
        else:
            self.failed_requests += 1

        if is_web_search:
            self.web_search_requests += 1

        if is_chat or path.endswith("/chat"):
            self.chat_requests += 1

    def format_uptime(self, seconds: float) -> str:
        """Format uptime into human-readable representation."""
        secs = int(seconds)
        days, rem = divmod(secs, 86400)
        hours, rem = divmod(rem, 3600)
        minutes, seconds = divmod(rem, 60)

        parts = []
        if days > 0:
            parts.append(f"{days}d")
        if hours > 0 or days > 0:
            parts.append(f"{hours}h")
        if minutes > 0 or hours > 0 or days > 0:
            parts.append(f"{minutes}m")
        parts.append(f"{seconds}s")
        return " ".join(parts)

    def get_stats(self) -> Dict[str, Any]:
        """Compute real-time aggregated server statistics."""
        now = time.time()
        uptime = now - self.server_start_time

        # Calculate requests in the last 60 seconds
        cutoff_60s = now - 60.0
        reqs_in_last_minute = sum(
            1 for ts in self.recent_request_timestamps if ts >= cutoff_60s
        )

        # Calculate average response time
        avg_duration = (
            sum(self.recent_durations) / len(self.recent_durations)
            if self.recent_durations
            else 0.0
        )

        return {
            "uptime_seconds": int(uptime),
            "uptime_formatted": self.format_uptime(uptime),
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "web_search_requests": self.web_search_requests,
            "chat_requests": self.chat_requests,
            "avg_response_time_ms": round(avg_duration, 1),
            "requests_per_minute": reqs_in_last_minute,
        }


metrics_service = MetricsService()

