import io
import logging
from typing import List, Optional
from pypdf import PdfReader
from app.services.files.chunker import DocumentChunker
from app.services.files.models import DocumentChunk, ExtractionResult
from app.services.files.processors.base import BaseFileProcessor

logger = logging.getLogger("solix.files.pdf")


class PdfProcessor(BaseFileProcessor):
    """Extracts text, page numbers, and structural metadata from PDF documents."""

    def __init__(self, ocr_service=None, vision_service=None):
        self.chunker = DocumentChunker(chunk_size=1000, chunk_overlap=150)
        self.ocr_service = ocr_service
        self.vision_service = vision_service

    def can_process(self, category: str, mime_type: str, filename: str) -> bool:
        return category == "pdf" or filename.lower().endswith(".pdf")

    async def extract(self, file_id: str, filename: str, content_bytes: bytes) -> ExtractionResult:
        stream = io.BytesIO(content_bytes)
        try:
            reader = PdfReader(stream)
        except Exception as exc:
            logger.error(f"[PDF] Error loading PDF reader: {exc}")
            raise ValueError(f"Corrupted or invalid PDF file: {exc}")

        # Check for password protection / encryption
        if reader.is_encrypted:
            raise PermissionError("This file is password protected and cannot be processed.")

        page_count = len(reader.pages)
        if page_count == 0:
            return ExtractionResult(
                text="",
                chunks=[],
                page_count=0,
                warning="PDF contains no pages.",
            )

        all_page_texts: List[str] = []
        all_chunks: List[DocumentChunk] = []
        total_extracted_chars = 0

        for page_idx, page in enumerate(reader.pages):
            page_num = page_idx + 1
            try:
                page_text = page.extract_text() or ""
            except Exception as e:
                logger.warning(f"[PDF] Error extracting text from page {page_num}: {e}")
                page_text = ""

            page_text = page_text.strip()
            total_extracted_chars += len(page_text)
            all_page_texts.append(f"--- Page {page_num} ---\n{page_text}")

            if page_text:
                page_chunks = self.chunker.chunk_text(
                    page_text,
                    file_id=file_id,
                    filename=filename,
                    page=page_num,
                )
                all_chunks.extend(page_chunks)

        # Check if scanned PDF (average < 30 characters per page)
        avg_chars_per_page = total_extracted_chars / max(1, page_count)
        is_scanned = avg_chars_per_page < 30

        warning = None
        if is_scanned:
            logger.info(f"[PDF] Scanned PDF detected for '{filename}' (avg {avg_chars_per_page:.1f} chars/page)")
            # Attempt OCR / Vision on embedded page images if available
            ocr_text_parts = []
            if self.ocr_service or self.vision_service:
                for page_idx, page in enumerate(reader.pages[:10]):  # Cap at 10 pages for OCR performance
                    page_num = page_idx + 1
                    for img_obj in page.images:
                        img_bytes = img_obj.data
                        extracted_ocr = ""
                        if self.ocr_service and self.ocr_service.is_available():
                            extracted_ocr = await self.ocr_service.extract_text(img_bytes)
                        elif self.vision_service and self.vision_service.is_available():
                            extracted_ocr = await self.vision_service.describe_image(img_bytes, prompt="Transcribe all readable text and formulas on this scanned page accurately.")
                        
                        if extracted_ocr and extracted_ocr.strip():
                            ocr_text_parts.append(f"--- Page {page_num} (OCR) ---\n{extracted_ocr.strip()}")
                            page_chunks = self.chunker.chunk_text(
                                extracted_ocr.strip(),
                                file_id=file_id,
                                filename=filename,
                                page=page_num,
                                section=f"Page {page_num} (Scanned OCR)",
                            )
                            all_chunks.extend(page_chunks)

            if ocr_text_parts:
                all_page_texts.extend(ocr_text_parts)
                warning = "Scanned PDF detected; text extracted via OCR/Vision fallback."
            else:
                warning = "Scanned PDF detected with minimal text. Visual OCR is currently not available for this document."

        full_text = "\n\n".join(all_page_texts)

        # PDF metadata
        pdf_metadata = {}
        if reader.metadata:
            for k, v in reader.metadata.items():
                clean_k = str(k).lstrip("/")
                if isinstance(v, (str, int, float, bool)):
                    pdf_metadata[clean_k] = v

        return ExtractionResult(
            text=full_text,
            chunks=all_chunks,
            page_count=page_count,
            metadata=pdf_metadata,
            is_scanned=is_scanned,
            warning=warning,
        )

