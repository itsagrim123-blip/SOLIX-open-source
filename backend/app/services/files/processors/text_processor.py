import re
from typing import List
from app.services.files.chunker import DocumentChunker
from app.services.files.models import DocumentChunk, ExtractionResult
from app.services.files.processors.base import BaseFileProcessor


class TextProcessor(BaseFileProcessor):
    """Processes plain text, markdown, and log files with multi-encoding support."""

    def __init__(self):
        self.chunker = DocumentChunker(chunk_size=1000, chunk_overlap=150)

    def can_process(self, category: str, mime_type: str, filename: str) -> bool:
        return category == "text" or filename.lower().endswith((".txt", ".md", ".markdown", ".log"))

    def _decode_content(self, content_bytes: bytes) -> str:
        """Attempt safe multi-encoding decoding."""
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252", "utf-16"):
            try:
                return content_bytes.decode(enc)
            except UnicodeDecodeError:
                continue
        # Fallback with replacement characters
        return content_bytes.decode("utf-8", errors="replace")

    async def extract(self, file_id: str, filename: str, content_bytes: bytes) -> ExtractionResult:
        decoded_text = self._decode_content(content_bytes)
        chunks: List[DocumentChunk] = []

        # If markdown, split by markdown headings to preserve sections
        heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
        matches = list(heading_pattern.finditer(decoded_text))

        if matches and len(matches) > 1:
            for i, match in enumerate(matches):
                section_title = match.group(2).strip()
                start_idx = match.start()
                end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(decoded_text)
                section_text = decoded_text[start_idx:end_idx].strip()
                if section_text:
                    section_chunks = self.chunker.chunk_text(
                        section_text,
                        file_id=file_id,
                        filename=filename,
                        section=section_title,
                    )
                    chunks.extend(section_chunks)
        else:
            chunks = self.chunker.chunk_text(decoded_text, file_id=file_id, filename=filename)

        return ExtractionResult(
            text=decoded_text,
            chunks=chunks,
            metadata={"char_count": len(decoded_text), "line_count": decoded_text.count("\n") + 1},
        )

