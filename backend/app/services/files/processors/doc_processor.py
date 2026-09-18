import io
import logging
import os
import xml.etree.ElementTree as ET
import zipfile
from striprtf.striprtf import rtf_to_text
from app.services.files.chunker import DocumentChunker
from app.services.files.models import ExtractionResult
from app.services.files.processors.base import BaseFileProcessor

logger = logging.getLogger("solix.files.doc")


class DocLegacyProcessor(BaseFileProcessor):
    """Handles legacy .doc, .rtf, and OpenDocument .odt files gracefully."""

    def __init__(self):
        self.chunker = DocumentChunker(chunk_size=1000, chunk_overlap=150)

    def can_process(self, category: str, mime_type: str, filename: str) -> bool:
        ext = os.path.splitext(filename.lower())[1]
        return category in ("doc", "rtf", "odt") or ext in (".doc", ".rtf", ".odt")

    async def extract(self, file_id: str, filename: str, content_bytes: bytes) -> ExtractionResult:
        ext = os.path.splitext(filename.lower())[1]

        # 1. RTF Handling
        if ext == ".rtf" or content_bytes.startswith(b"{\\rtf"):
            try:
                rtf_content = content_bytes.decode("utf-8", errors="replace")
                plain_text = rtf_to_text(rtf_content)
                chunks = self.chunker.chunk_text(plain_text, file_id=file_id, filename=filename)
                return ExtractionResult(
                    text=plain_text,
                    chunks=chunks,
                    metadata={"format": "RTF"},
                )
            except Exception as exc:
                logger.error(f"[RTF] Failed to parse RTF: {exc}")
                raise ValueError(f"Failed to parse RTF file: {exc}")

        # 2. ODT Handling (OpenDocument Text)
        if ext == ".odt" or (content_bytes.startswith(b"PK\x03\x04") and "odt" in filename.lower()):
            try:
                with zipfile.ZipFile(io.BytesIO(content_bytes)) as z:
                    if "content.xml" in z.namelist():
                        content_xml = z.read("content.xml")
                        root = ET.fromstring(content_xml)
                        # Extract all text elements
                        text_fragments = []
                        for elem in root.iter():
                            if elem.text and elem.text.strip():
                                text_fragments.append(elem.text.strip())
                            if elem.tail and elem.tail.strip():
                                text_fragments.append(elem.tail.strip())
                        odt_text = "\n".join(text_fragments)
                        chunks = self.chunker.chunk_text(odt_text, file_id=file_id, filename=filename)
                        return ExtractionResult(
                            text=odt_text,
                            chunks=chunks,
                            metadata={"format": "ODT"},
                        )
            except Exception as exc:
                logger.warning(f"[ODT] Failed parsing ODT: {exc}")

        # 3. Legacy Binary .doc Handling
        # Binary OLE compound document: do NOT treat as plain text!
        # Provide a clear, friendly unsupported/conversion message rather than crashing or filling with gibberish.
        logger.info(f"[DOC] Legacy binary .doc format detected for '{filename}'")
        raise ValueError(
            f"Solix can't read legacy binary '{filename}' format yet in this environment. "
            f"Please save or convert the file to .docx or .pdf for full analysis."
        )

