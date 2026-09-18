import os
import uuid
from typing import List
from app.services.files.models import DocumentChunk, ExtractionResult
from app.services.files.processors.base import BaseFileProcessor

# Language mapping by extension
_EXT_LANG_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript (react)",
    ".ts": "typescript",
    ".tsx": "typescript (react)",
    ".java": "java",
    ".c": "c",
    ".cpp": "c++",
    ".cc": "c++",
    ".cxx": "c++",
    ".h": "c/c++ header",
    ".hpp": "c++ header",
    ".cs": "c#",
    ".go": "go",
    ".r": "r",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".bat": "batch",
    ".ps1": "powershell",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".ini": "ini config",
    ".toml": "toml config",
    ".conf": "config",
    ".config": "config",
    ".env": "environment variables",
}


class CodeProcessor(BaseFileProcessor):
    """Processes source code and configuration files as data, preserving line numbers and functions."""

    def can_process(self, category: str, mime_type: str, filename: str) -> bool:
        ext = os.path.splitext(filename.lower())[1]
        return category == "code" or ext in _EXT_LANG_MAP

    def _decode_code(self, content_bytes: bytes) -> str:
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                return content_bytes.decode(enc)
            except UnicodeDecodeError:
                continue
        return content_bytes.decode("utf-8", errors="replace")

    async def extract(self, file_id: str, filename: str, content_bytes: bytes) -> ExtractionResult:
        code_text = self._decode_code(content_bytes)
        ext = os.path.splitext(filename.lower())[1]
        language = _EXT_LANG_MAP.get(ext, "source code")

        lines = code_text.splitlines()
        total_lines = len(lines)

        # Chunk code by 60 lines with 10 line overlap
        CHUNK_LINES = 60
        OVERLAP_LINES = 10

        chunks: List[DocumentChunk] = []

        if total_lines <= CHUNK_LINES:
            # Code with line numbers prefixed for grounding
            formatted_lines = [f"{idx + 1}: {line}" for idx, line in enumerate(lines)]
            chunks.append(
                DocumentChunk(
                    chunk_id=f"{file_id}_{uuid.uuid4().hex[:8]}",
                    file_id=file_id,
                    filename=filename,
                    content="\n".join(formatted_lines),
                    line_start=1,
                    line_end=total_lines,
                    section=f"{language} ({total_lines} lines)",
                )
            )
        else:
            step = CHUNK_LINES - OVERLAP_LINES
            for start_idx in range(0, total_lines, step):
                end_idx = min(start_idx + CHUNK_LINES, total_lines)
                segment_lines = lines[start_idx:end_idx]

                # Format with 1-based line numbers
                formatted_segment = [
                    f"{start_idx + idx + 1}: {line}"
                    for idx, line in enumerate(segment_lines)
                ]

                chunks.append(
                    DocumentChunk(
                        chunk_id=f"{file_id}_{uuid.uuid4().hex[:8]}",
                        file_id=file_id,
                        filename=filename,
                        content="\n".join(formatted_segment),
                        line_start=start_idx + 1,
                        line_end=end_idx,
                        section=f"{language} [Lines {start_idx + 1}–{end_idx}]",
                    )
                )

                if end_idx >= total_lines:
                    break

        return ExtractionResult(
            text=code_text,
            chunks=chunks,
            metadata={
                "language": language,
                "line_count": total_lines,
                "char_count": len(code_text),
            },
        )

