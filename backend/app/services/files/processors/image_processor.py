import io
import logging
import os
import xml.etree.ElementTree as ET
from PIL import Image
from app.services.files.chunker import DocumentChunker
from app.services.files.models import DocumentChunk, ExtractionResult
from app.services.files.processors.base import BaseFileProcessor

logger = logging.getLogger("solix.files.image")


class ImageProcessor(BaseFileProcessor):
    """Extracts visual content, descriptions, text, and metadata from images."""

    def __init__(self, vision_provider=None, ocr_provider=None):
        self.chunker = DocumentChunker(chunk_size=1000, chunk_overlap=150)
        self.vision_provider = vision_provider
        self.ocr_provider = ocr_provider

    def can_process(self, category: str, mime_type: str, filename: str) -> bool:
        ext = os.path.splitext(filename.lower())[1]
        return category == "image" or ext in (
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".gif",
            ".bmp",
            ".tiff",
            ".tif",
            ".svg",
        )

    async def extract(self, file_id: str, filename: str, content_bytes: bytes) -> ExtractionResult:
        ext = os.path.splitext(filename.lower())[1]

        # 1. Special case: SVG image (XML-based vector)
        if ext == ".svg":
            try:
                root = ET.fromstring(content_bytes)
                svg_texts = [elem.text.strip() for elem in root.iter() if elem.text and elem.text.strip()]
                text_content = f"SVG Image: {filename}\nEmbedded Text:\n" + "\n".join(svg_texts)
                chunks = self.chunker.chunk_text(text_content, file_id=file_id, filename=filename, section="Vector Graphic Text")
                return ExtractionResult(text=text_content, chunks=chunks, metadata={"format": "SVG"})
            except Exception:
                pass

        # 2. Raster images (PNG, JPG, WEBP, GIF, BMP, TIFF)
        width, height, img_format = None, None, None
        try:
            with Image.open(io.BytesIO(content_bytes)) as pil_img:
                width, height = pil_img.size
                img_format = pil_img.format
        except Exception as exc:
            logger.error(f"[Image] Failed to open image: {exc}")
            raise ValueError(f"Corrupted or unsupported image file: {exc}")

        image_desc = ""
        transcription_source = "Metadata only"

        # 1. Fast OCR first if local tesseract is installed (<100ms)
        if self.ocr_provider and self.ocr_provider.is_available():
            try:
                ocr_result = await self.ocr_provider.extract_text(content_bytes)
                if ocr_result and ocr_result.strip():
                    image_desc = f"Extracted Text (OCR):\n{ocr_result.strip()}"
                    transcription_source = "OCR Engine"
            except Exception as e:
                logger.debug(f"[Image] OCR call failed: {e}")

        # 2. Try Vision Provider with downscaled image and fast timeout
        if not image_desc and self.vision_provider and await self.vision_provider.is_available():
            try:
                vision_result = await self.vision_provider.describe_image(
                    content_bytes,
                    mime_type=f"image/{img_format.lower() if img_format else 'png'}",
                    prompt="Identify and concisely describe what is shown in this image, including any prominent people, objects, text, UI elements, and scene context.",
                )
                if vision_result:
                    image_desc = vision_result
                    transcription_source = "Ollama Multimodal Vision"
            except Exception as e:
                logger.warning(f"[Image] Vision model call failed: {e}")

        if not image_desc:
            image_desc = (
                f"[Image: {filename}]\n"
                f"Dimensions: {width}x{height} pixels | Format: {img_format}\n"
                f"Visual content ready for AI analysis."
            )

        full_text = f"Image: {filename} ({width}x{height}px, {img_format})\nAnalysis ({transcription_source}):\n{image_desc}"

        chunks = self.chunker.chunk_text(
            full_text,
            file_id=file_id,
            filename=filename,
            section=f"Image Analysis ({width}x{height})",
        )

        return ExtractionResult(
            text=full_text,
            chunks=chunks,
            metadata={
                "width": width,
                "height": height,
                "format": img_format,
                "transcription_source": transcription_source,
            },
        )

