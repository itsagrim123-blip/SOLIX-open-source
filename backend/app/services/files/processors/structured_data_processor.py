import json
import os
import xml.etree.ElementTree as ET
from typing import List
import yaml
from app.services.files.chunker import DocumentChunker
from app.services.files.models import DocumentChunk, ExtractionResult
from app.services.files.processors.base import BaseFileProcessor


class StructuredDataProcessor(BaseFileProcessor):
    """Processes JSON, YAML, and XML documents preserving hierarchy and schema."""

    def __init__(self):
        self.chunker = DocumentChunker(chunk_size=1200, chunk_overlap=100)

    def can_process(self, category: str, mime_type: str, filename: str) -> bool:
        ext = os.path.splitext(filename.lower())[1]
        return category in ("json", "yaml", "xml") or ext in (
            ".json",
            ".yaml",
            ".yml",
            ".xml",
        )

    def _decode(self, content_bytes: bytes) -> str:
        for enc in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                return content_bytes.decode(enc)
            except UnicodeDecodeError:
                continue
        return content_bytes.decode("utf-8", errors="replace")

    async def extract(self, file_id: str, filename: str, content_bytes: bytes) -> ExtractionResult:
        text = self._decode(content_bytes)
        ext = os.path.splitext(filename.lower())[1]
        chunks: List[DocumentChunk] = []
        structured_type = "structured"

        if ext == ".json" or (text.strip().startswith(("{", "["))):
            structured_type = "JSON"
            try:
                parsed = json.loads(text)
                # Pretty-printed JSON
                formatted = json.dumps(parsed, indent=2)
                # If top-level is dict with multiple keys, chunk by top-level keys
                if isinstance(parsed, dict) and len(parsed) > 1 and len(formatted) > 1200:
                    for key, val in parsed.items():
                        key_text = f"Key: {key}\n" + json.dumps({key: val}, indent=2)
                        chunks.extend(
                            self.chunker.chunk_text(
                                key_text,
                                file_id=file_id,
                                filename=filename,
                                section=f"Key: {key}",
                            )
                        )
                elif isinstance(parsed, list) and len(parsed) > 1 and len(formatted) > 1200:
                    # Chunk array in batches
                    batch_size = max(1, 1200 // (len(formatted) // len(parsed) + 1))
                    for i in range(0, len(parsed), batch_size):
                        batch = parsed[i : i + batch_size]
                        batch_text = f"Items {i} to {i + len(batch) - 1}:\n" + json.dumps(batch, indent=2)
                        chunks.extend(
                            self.chunker.chunk_text(
                                batch_text,
                                file_id=file_id,
                                filename=filename,
                                section=f"Items [{i}–{i + len(batch) - 1}]",
                            )
                        )
                else:
                    chunks = self.chunker.chunk_text(formatted, file_id=file_id, filename=filename)
                text = formatted
            except Exception:
                # Fallback to plain text chunking if JSON is slightly malformed
                chunks = self.chunker.chunk_text(text, file_id=file_id, filename=filename)

        elif ext in (".yaml", ".yml"):
            structured_type = "YAML"
            try:
                parsed = yaml.safe_load(text)
                formatted = yaml.dump(parsed, sort_keys=False, default_flow_style=False)
                if isinstance(parsed, dict) and len(parsed) > 1 and len(formatted) > 1200:
                    for key, val in parsed.items():
                        key_text = f"Key: {key}\n" + yaml.dump({key: val}, sort_keys=False)
                        chunks.extend(
                            self.chunker.chunk_text(
                                key_text,
                                file_id=file_id,
                                filename=filename,
                                section=f"Section: {key}",
                            )
                        )
                else:
                    chunks = self.chunker.chunk_text(formatted, file_id=file_id, filename=filename)
                text = formatted
            except Exception:
                chunks = self.chunker.chunk_text(text, file_id=file_id, filename=filename)

        elif ext == ".xml":
            structured_type = "XML"
            try:
                # Parse XML safely
                root = ET.fromstring(text)
                lines = [f"XML Root: <{root.tag}>"]

                def walk_element(elem, depth=0):
                    indent = "  " * depth
                    attribs = f" {elem.attrib}" if elem.attrib else ""
                    text_val = elem.text.strip() if elem.text and elem.text.strip() else ""
                    if text_val:
                        lines.append(f"{indent}<{elem.tag}{attribs}>{text_val}</{elem.tag}>")
                    else:
                        lines.append(f"{indent}<{elem.tag}{attribs}>")
                    for child in elem:
                        walk_element(child, depth + 1)

                walk_element(root)
                formatted = "\n".join(lines)
                chunks = self.chunker.chunk_text(formatted, file_id=file_id, filename=filename)
                text = formatted
            except Exception:
                chunks = self.chunker.chunk_text(text, file_id=file_id, filename=filename)

        return ExtractionResult(
            text=text,
            chunks=chunks,
            metadata={"format": structured_type, "char_count": len(text)},
        )

