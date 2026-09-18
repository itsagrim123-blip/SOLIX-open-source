from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    """Represents an atomic, searchable piece of a document with citation metadata."""

    chunk_id: str
    file_id: str
    filename: str
    content: str
    page: Optional[int] = None
    slide: Optional[int] = None
    sheet: Optional[str] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    section: Optional[str] = None

    @property
    def citation_label(self) -> str:
        """Generate human-readable authoritative citation reference."""
        parts = [self.filename]
        if self.page is not None:
            parts.append(f"Page {self.page}")
        elif self.slide is not None:
            parts.append(f"Slide {self.slide}")
        elif self.sheet is not None:
            parts.append(f"Sheet: {self.sheet}")
        elif self.line_start is not None and self.line_end is not None:
            parts.append(f"Lines {self.line_start}–{self.line_end}")
        elif self.section:
            parts.append(f"Section: {self.section}")
        return " — ".join(parts)


class FileMetadata(BaseModel):
    """Safe metadata representation for an uploaded file."""

    file_id: str
    filename: str
    content_type: str
    detected_type: str
    size_bytes: int
    sha256_hash: str
    status: str = Field(default="uploaded", description="'uploaded', 'processing', 'ready', 'error'")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    page_count: Optional[int] = None
    sheet_count: Optional[int] = None
    slide_count: Optional[int] = None
    chunk_count: int = 0
    error: Optional[str] = None


class ExtractionResult(BaseModel):
    """Result of processing and parsing a file format."""

    text: str
    chunks: List[DocumentChunk] = Field(default_factory=list)
    page_count: Optional[int] = None
    sheet_count: Optional[int] = None
    slide_count: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    is_scanned: bool = False
    warning: Optional[str] = None

