from abc import ABC, abstractmethod
from typing import Any, Dict
from app.services.files.models import ExtractionResult


class BaseFileProcessor(ABC):
    """Abstract base class for all file format extractors in Solix."""

    @abstractmethod
    def can_process(self, category: str, mime_type: str, filename: str) -> bool:
        """Return True if this processor can handle the detected format."""
        pass

    @abstractmethod
    async def extract(self, file_id: str, filename: str, content_bytes: bytes) -> ExtractionResult:
        """Extract text, structured segments, chunks, and metadata from raw bytes."""
        pass

    def get_metadata(self, filename: str, content_bytes: bytes) -> Dict[str, Any]:
        """Extract format-specific lightweight metadata."""
        return {}

