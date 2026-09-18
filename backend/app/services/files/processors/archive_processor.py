import io
import logging
import os
import zipfile
from typing import Callable, Dict, List
from app.services.files.chunker import DocumentChunker
from app.services.files.models import DocumentChunk, ExtractionResult
from app.services.files.processors.base import BaseFileProcessor

logger = logging.getLogger("solix.files.archive")

# Maximum safety limits for ZIP archives
MAX_ZIP_ENTRIES = 100
MAX_UNCOMPRESSED_TOTAL_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_COMPRESSION_RATIO = 50.0  # Suspected zip bomb if uncompressed is >50x compressed


class ArchiveProcessor(BaseFileProcessor):
    """Safely inspects and extracts supported contents from ZIP archives with zip-bomb protection."""

    def __init__(self, processor_registry_fn: Callable = None):
        self.chunker = DocumentChunker(chunk_size=1000, chunk_overlap=150)
        self.processor_registry_fn = processor_registry_fn

    def can_process(self, category: str, mime_type: str, filename: str) -> bool:
        return category == "archive" or filename.lower().endswith(".zip")

    async def extract(self, file_id: str, filename: str, content_bytes: bytes) -> ExtractionResult:
        if not zipfile.is_zipfile(io.BytesIO(content_bytes)):
            raise ValueError(f"File '{filename}' is not a valid ZIP archive.")

        with zipfile.ZipFile(io.BytesIO(content_bytes)) as z:
            infolist = z.infolist()

            # 1. Zip Bomb Defense: Check entry count
            if len(infolist) > MAX_ZIP_ENTRIES:
                raise ValueError(
                    f"ZIP archive contains too many files ({len(infolist)} entries; maximum limit is {MAX_ZIP_ENTRIES})."
                )

            # 2. Zip Bomb Defense: Check total uncompressed size and compression ratio
            total_uncompressed = sum(info.file_size for info in infolist)
            compressed_size = max(1, len(content_bytes))
            ratio = total_uncompressed / compressed_size

            if total_uncompressed > MAX_UNCOMPRESSED_TOTAL_BYTES:
                raise ValueError(
                    f"ZIP archive uncompressed size ({total_uncompressed / (1024*1024):.1f} MB) exceeds maximum allowed limit (50 MB)."
                )

            if ratio > MAX_COMPRESSION_RATIO and total_uncompressed > 5 * 1024 * 1024:
                raise ValueError("Suspicious high-ratio ZIP compression detected (possible zip bomb). Rejected for safety.")

            manifest_lines = [f"Archive: {filename}", f"Total Items: {len(infolist)}\nManifest:"]
            all_chunks: List[DocumentChunk] = []
            processed_files: List[str] = []

            for info in infolist:
                # 3. Path Traversal Defense
                entry_name = info.filename
                # Check for path traversal attempts
                norm_name = os.path.normpath(entry_name).replace("\\", "/")
                if (
                    norm_name.startswith("../")
                    or "/../" in norm_name
                    or norm_name.startswith("/")
                    or ".." in norm_name.split("/")
                    or "\x00" in norm_name
                ):
                    logger.warning(f"[Archive] Skipped dangerous entry '{entry_name}' in ZIP.")
                    continue

                # Skip directory entries
                if info.is_dir() or entry_name.endswith("/"):
                    continue

                file_size_kb = info.file_size / 1024
                manifest_lines.append(f" - {entry_name} ({file_size_kb:.1f} KB)")

                # Process supported text / code / document files inside archive
                child_ext = os.path.splitext(entry_name.lower())[1]
                if child_ext in (
                    ".txt", ".md", ".json", ".yaml", ".yml", ".xml", ".csv", ".tsv",
                    ".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".css", ".sql",
                    ".sh", ".java", ".c", ".cpp", ".h", ".cs", ".go", ".rs",
                ):
                    try:
                        child_data = z.read(entry_name)
                        child_text = child_data.decode("utf-8", errors="replace")
                        if child_text.strip():
                            processed_files.append(entry_name)
                            child_chunks = self.chunker.chunk_text(
                                f"Archive: {filename} | File: {entry_name}\n\n{child_text}",
                                file_id=file_id,
                                filename=f"{filename}/{entry_name}",
                                section=f"Archived file: {entry_name}",
                            )
                            all_chunks.extend(child_chunks)
                    except Exception as exc:
                        logger.warning(f"[Archive] Error reading child file '{entry_name}': {exc}")

            full_manifest = "\n".join(manifest_lines)
            if not all_chunks:
                # Chunk the manifest itself so user knows what's inside
                all_chunks = self.chunker.chunk_text(
                    full_manifest,
                    file_id=file_id,
                    filename=filename,
                    section="Archive Manifest",
                )

            summary_text = (
                f"{full_manifest}\n\nProcessed {len(processed_files)} readable source/data files inside archive: "
                + ", ".join(processed_files[:20])
            )

            return ExtractionResult(
                text=summary_text,
                chunks=all_chunks,
                metadata={"total_entries": len(infolist), "processed_files": processed_files},
            )

