import asyncio
import logging
import os
import time
import uuid
from typing import Dict, List, Optional
from app.core.config import settings
from app.services.files.detector import detect_file_type
from app.services.files.models import DocumentChunk, ExtractionResult, FileMetadata
from app.services.files.ocr import CompositeOCRProvider
from app.services.files.processors.archive_processor import ArchiveProcessor
from app.services.files.processors.base import BaseFileProcessor
from app.services.files.processors.code_processor import CodeProcessor
from app.services.files.processors.doc_processor import DocLegacyProcessor
from app.services.files.processors.docx_processor import DocxProcessor
from app.services.files.processors.html_processor import HtmlProcessor
from app.services.files.processors.image_processor import ImageProcessor
from app.services.files.processors.pdf_processor import PdfProcessor
from app.services.files.processors.presentation_processor import PresentationProcessor
from app.services.files.processors.spreadsheet_processor import SpreadsheetProcessor
from app.services.files.processors.structured_data_processor import StructuredDataProcessor
from app.services.files.processors.text_processor import TextProcessor
from app.services.files.retriever import DocumentRetriever
from app.services.files.validator import compute_sha256, sanitize_filename, validate_file_size
from app.services.files.vision import OllamaVisionProvider

logger = logging.getLogger("solix.files.service")


class FileService:
    """
    Central orchestration service for File Intelligence in Solix.
    Manages uploads, format detection, extraction, chunking, indexing,
    deduplication, retrieval, and telemetry.
    """

    def __init__(self):
        self.storage_dir = os.path.abspath(settings.FILE_STORAGE_PATH)
        os.makedirs(self.storage_dir, exist_ok=True)

        # Vision & OCR providers
        self.vision_provider = OllamaVisionProvider()
        self.ocr_provider = CompositeOCRProvider(vision_provider=self.vision_provider)

        # Initialize modular format processors
        self.processors: List[BaseFileProcessor] = [
            PdfProcessor(ocr_service=self.ocr_provider, vision_service=self.vision_provider),
            DocxProcessor(),
            DocLegacyProcessor(),
            SpreadsheetProcessor(),
            PresentationProcessor(),
            HtmlProcessor(),
            StructuredDataProcessor(),
            ImageProcessor(vision_provider=self.vision_provider, ocr_provider=self.ocr_provider),
            CodeProcessor(),
            TextProcessor(),
            ArchiveProcessor(),
        ]

        self.retriever = DocumentRetriever(max_chunks=settings.MAX_CONTEXT_CHUNKS)

        # In-memory indices & state (keyed by file_id)
        self._metadata_store: Dict[str, FileMetadata] = {}
        self._chunks_store: Dict[str, List[DocumentChunk]] = {}
        self._raw_text_store: Dict[str, str] = {}
        # SHA256 -> original file_id cache for deduplication
        self._hash_cache: Dict[str, str] = {}

        # Telemetry metrics
        self._total_processed: int = 0
        self._active_processing: int = 0
        self._error_count: int = 0
        self._total_processing_time_ms: float = 0.0

    def _select_processor(self, category: str, mime_type: str, filename: str) -> Optional[BaseFileProcessor]:
        for proc in self.processors:
            if proc.can_process(category, mime_type, filename):
                return proc
        return None

    async def process_upload(
        self,
        filename: str,
        content_bytes: bytes,
        claimed_mime: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> FileMetadata:
        """
        Full lifecycle: validate, detect type, deduplicate, extract, chunk, and index.
        """
        start_time = time.perf_counter()
        clean_name = sanitize_filename(filename)
        size_bytes = len(content_bytes)
        file_id = str(uuid.uuid4())

        logger.info(f"[Files] File upload started: '{clean_name}' ({size_bytes} bytes)")
        self._active_processing += 1

        try:
            # 1. Size limit validation
            size_err = validate_file_size(size_bytes, settings.MAX_FILE_SIZE_MB)
            if size_err:
                logger.warning(f"[Files] Size check failed for '{clean_name}': {size_err}")
                self._error_count += 1
                meta = FileMetadata(
                    file_id=file_id,
                    filename=clean_name,
                    content_type=claimed_mime or "application/octet-stream",
                    detected_type="unsupported",
                    size_bytes=size_bytes,
                    sha256_hash="",
                    status="error",
                    error=size_err,
                )
                self._metadata_store[file_id] = meta
                return meta

            # 2. Compute SHA-256 for deduplication
            sha256_hash = compute_sha256(content_bytes)

            # 3. Deduplication Check
            if sha256_hash in self._hash_cache:
                cached_id = self._hash_cache[sha256_hash]
                cached_meta = self._metadata_store.get(cached_id)
                if cached_meta and cached_meta.status == "ready":
                    logger.info(f"[Files] Reusing deduplicated cache for '{clean_name}' (hash={sha256_hash[:10]})")
                    # Replicate chunks under new file_id
                    existing_chunks = self._chunks_store.get(cached_id, [])
                    new_chunks = [
                        DocumentChunk(
                            chunk_id=f"{file_id}_{i}",
                            file_id=file_id,
                            filename=clean_name,
                            content=c.content,
                            page=c.page,
                            slide=c.slide,
                            sheet=c.sheet,
                            line_start=c.line_start,
                            line_end=c.line_end,
                            section=c.section,
                        )
                        for i, c in enumerate(existing_chunks)
                    ]
                    self._chunks_store[file_id] = new_chunks
                    self._raw_text_store[file_id] = self._raw_text_store.get(cached_id, "")

                    meta = FileMetadata(
                        file_id=file_id,
                        filename=clean_name,
                        content_type=cached_meta.content_type,
                        detected_type=cached_meta.detected_type,
                        size_bytes=size_bytes,
                        sha256_hash=sha256_hash,
                        status="ready",
                        page_count=cached_meta.page_count,
                        sheet_count=cached_meta.sheet_count,
                        slide_count=cached_meta.slide_count,
                        chunk_count=len(new_chunks),
                    )
                    self._metadata_store[file_id] = meta
                    self._total_processed += 1
                    return meta

            # 4. Multi-tier format detection & security sniffing
            category, detected_mime, detection_error = detect_file_type(
                clean_name,
                content_bytes[:4096],
                claimed_mime,
            )

            if detection_error:
                logger.warning(f"[Files] File detection error for '{clean_name}': {detection_error}")
                self._error_count += 1
                meta = FileMetadata(
                    file_id=file_id,
                    filename=clean_name,
                    content_type=detected_mime,
                    detected_type=category,
                    size_bytes=size_bytes,
                    sha256_hash=sha256_hash,
                    status="error",
                    error=detection_error,
                )
                self._metadata_store[file_id] = meta
                return meta

            logger.info(f"[Files] Detected format: '{category}' (MIME: {detected_mime}) for '{clean_name}'")

            # 5. Safe file persistence
            file_dir = os.path.join(self.storage_dir, file_id)
            os.makedirs(file_dir, exist_ok=True)
            saved_path = os.path.join(file_dir, clean_name)
            with open(saved_path, "wb") as f:
                f.write(content_bytes)

            # 6. Parser Selection
            processor = self._select_processor(category, detected_mime, clean_name)
            if not processor:
                msg = f"Solix can't read this file type yet ({clean_name})."
                self._error_count += 1
                meta = FileMetadata(
                    file_id=file_id,
                    filename=clean_name,
                    content_type=detected_mime,
                    detected_type=category,
                    size_bytes=size_bytes,
                    sha256_hash=sha256_hash,
                    status="error",
                    error=msg,
                )
                self._metadata_store[file_id] = meta
                return meta

            # 7. Extract content
            extraction: ExtractionResult = await processor.extract(file_id, clean_name, content_bytes)

            # 8. Index chunks and text
            self._chunks_store[file_id] = extraction.chunks
            self._raw_text_store[file_id] = extraction.text
            self._hash_cache[sha256_hash] = file_id

            elapsed_ms = (time.perf_counter() - start_time) * 1000
            self._total_processing_time_ms += elapsed_ms
            self._total_processed += 1

            meta = FileMetadata(
                file_id=file_id,
                filename=clean_name,
                content_type=detected_mime,
                detected_type=category,
                size_bytes=size_bytes,
                sha256_hash=sha256_hash,
                status="ready",
                page_count=extraction.page_count,
                sheet_count=extraction.sheet_count,
                slide_count=extraction.slide_count,
                chunk_count=len(extraction.chunks),
                error=extraction.warning,
            )
            self._metadata_store[file_id] = meta

            logger.info(
                f"[Files] File ready: '{clean_name}' (ID: {file_id}, Chunks: {len(extraction.chunks)}, Elapsed: {elapsed_ms:.1f}ms)"
            )
            return meta

        except Exception as exc:
            logger.error(f"[Files] Processing failure for '{clean_name}': {exc}", exc_info=True)
            self._error_count += 1
            meta = FileMetadata(
                file_id=file_id,
                filename=clean_name,
                content_type=claimed_mime or "application/octet-stream",
                detected_type="error",
                size_bytes=size_bytes,
                sha256_hash="",
                status="error",
                error=str(exc),
            )
            self._metadata_store[file_id] = meta
            return meta

        finally:
            self._active_processing = max(0, self._active_processing - 1)

    def get_metadata(self, file_id: str) -> Optional[FileMetadata]:
        return self._metadata_store.get(file_id)

    def get_chunks(self, file_ids: List[str]) -> List[DocumentChunk]:
        all_chunks: List[DocumentChunk] = []
        for fid in file_ids:
            chunks = self._chunks_store.get(fid, [])
            all_chunks.extend(chunks)
        return all_chunks

    def delete_file(self, file_id: str) -> bool:
        if file_id in self._metadata_store:
            del self._metadata_store[file_id]
        if file_id in self._chunks_store:
            del self._chunks_store[file_id]
        if file_id in self._raw_text_store:
            del self._raw_text_store[file_id]

        file_dir = os.path.join(self.storage_dir, file_id)
        if os.path.isdir(file_dir):
            try:
                import shutil
                shutil.rmtree(file_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"[Files] Failed removing directory {file_dir}: {e}")
        return True

    def get_stats(self) -> Dict[str, object]:
        avg_time = (
            (self._total_processing_time_ms / max(1, self._total_processed))
            if self._total_processed > 0
            else 0.0
        )
        return {
            "status": "ready",
            "files_processed": self._total_processed,
            "files_active": self._active_processing,
            "errors": self._error_count,
            "avg_processing_time_ms": round(avg_time, 1),
            "ocr": "available" if self.ocr_provider.is_available() else "unavailable",
            "vision": "ready" if bool(settings.VISION_MODEL) else "unavailable",
        }


# Global singleton instance
file_service = FileService()
