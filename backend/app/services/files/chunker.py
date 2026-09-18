import uuid
from typing import List, Optional
from app.services.files.models import DocumentChunk


class DocumentChunker:
    """Intelligently splits extracted document text into semantic chunks with metadata preservation."""

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_text(
        self,
        text: str,
        file_id: str,
        filename: str,
        page: Optional[int] = None,
        slide: Optional[int] = None,
        sheet: Optional[str] = None,
        line_start: Optional[int] = None,
        line_end: Optional[int] = None,
        section: Optional[str] = None,
    ) -> List[DocumentChunk]:
        """Split a text block into structured, citation-aware DocumentChunk items."""
        clean_text = text.strip()
        if not clean_text:
            return []

        # If text is smaller than chunk size, return single chunk
        if len(clean_text) <= self.chunk_size:
            return [
                DocumentChunk(
                    chunk_id=f"{file_id}_{uuid.uuid4().hex[:8]}",
                    file_id=file_id,
                    filename=filename,
                    content=clean_text,
                    page=page,
                    slide=slide,
                    sheet=sheet,
                    line_start=line_start,
                    line_end=line_end,
                    section=section,
                )
            ]

        chunks: List[DocumentChunk] = []
        # Split by paragraphs first
        paragraphs = clean_text.split("\n\n")
        current_chunk: List[str] = []
        current_len = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If a single paragraph is larger than chunk_size, split by sentences or lines
            if len(para) > self.chunk_size:
                # Flush current accumulator first
                if current_chunk:
                    chunk_str = "\n\n".join(current_chunk)
                    chunks.append(
                        DocumentChunk(
                            chunk_id=f"{file_id}_{uuid.uuid4().hex[:8]}",
                            file_id=file_id,
                            filename=filename,
                            content=chunk_str,
                            page=page,
                            slide=slide,
                            sheet=sheet,
                            line_start=line_start,
                            line_end=line_end,
                            section=section,
                        )
                    )
                    current_chunk = []
                    current_len = 0

                # Break the large paragraph with sliding window
                start = 0
                while start < len(para):
                    end = start + self.chunk_size
                    # Try to break at newline or space
                    if end < len(para):
                        split_pos = para.rfind(" ", start, end)
                        if split_pos > start + (self.chunk_size // 2):
                            end = split_pos

                    segment = para[start:end].strip()
                    if segment:
                        chunks.append(
                            DocumentChunk(
                                chunk_id=f"{file_id}_{uuid.uuid4().hex[:8]}",
                                file_id=file_id,
                                filename=filename,
                                content=segment,
                                page=page,
                                slide=slide,
                                sheet=sheet,
                                line_start=line_start,
                                line_end=line_end,
                                section=section,
                            )
                        )
                    start = max(start + 1, end - self.chunk_overlap)
                continue

            # Accumulate paragraphs
            if current_len + len(para) + 2 > self.chunk_size and current_chunk:
                chunk_str = "\n\n".join(current_chunk)
                chunks.append(
                    DocumentChunk(
                        chunk_id=f"{file_id}_{uuid.uuid4().hex[:8]}",
                        file_id=file_id,
                        filename=filename,
                        content=chunk_str,
                        page=page,
                        slide=slide,
                        sheet=sheet,
                        line_start=line_start,
                        line_end=line_end,
                        section=section,
                    )
                )
                # Keep last paragraph for overlap if within size
                last_p = current_chunk[-1]
                if len(last_p) <= self.chunk_overlap:
                    current_chunk = [last_p, para]
                    current_len = len(last_p) + 2 + len(para)
                else:
                    current_chunk = [para]
                    current_len = len(para)
            else:
                current_chunk.append(para)
                current_len += len(para) + 2

        # Add remaining accumulated text
        if current_chunk:
            chunk_str = "\n\n".join(current_chunk)
            chunks.append(
                DocumentChunk(
                    chunk_id=f"{file_id}_{uuid.uuid4().hex[:8]}",
                    file_id=file_id,
                    filename=filename,
                    content=chunk_str,
                    page=page,
                    slide=slide,
                    sheet=sheet,
                    line_start=line_start,
                    line_end=line_end,
                    section=section,
                )
            )

        return chunks

