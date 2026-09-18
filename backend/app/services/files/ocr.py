from abc import ABC, abstractmethod
import logging
import shutil
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("solix.files.ocr")


class BaseOCRProvider(ABC):
    """Abstract interface for optical character recognition providers."""

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if this OCR engine is installed and operational."""
        pass

    @abstractmethod
    async def extract_text(self, image_bytes: bytes) -> str:
        """Extract plain text from an image byte buffer."""
        pass


class TesseractOCRProvider(BaseOCRProvider):
    """Integrates with local Tesseract executable if installed."""

    def __init__(self):
        self._tesseract_path = shutil.which("tesseract")

    def is_available(self) -> bool:
        return settings.OCR_ENABLED and bool(self._tesseract_path)

    async def extract_text(self, image_bytes: bytes) -> str:
        if not self.is_available():
            return ""

        try:
            import pytesseract
            from PIL import Image
            import io

            img = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(img)
            return text.strip()
        except Exception as exc:
            logger.warning(f"[OCR] Tesseract extraction failed: {exc}")
            return ""


class CompositeOCRProvider(BaseOCRProvider):
    """
    Composite OCR engine that prioritizes Tesseract if installed,
    and seamlessly falls back to Ollama multimodal Vision models.
    """

    def __init__(self, vision_provider=None):
        self.tesseract = TesseractOCRProvider()
        self.vision_provider = vision_provider

    def is_available(self) -> bool:
        if not settings.OCR_ENABLED:
            return False
        if self.tesseract.is_available():
            return True
        return bool(self.vision_provider)

    async def extract_text(self, image_bytes: bytes) -> str:
        if not settings.OCR_ENABLED:
            return ""

        # 1. Try Tesseract first if installed locally
        if self.tesseract.is_available():
            text = await self.tesseract.extract_text(image_bytes)
            if text:
                return text

        # 2. Fallback to vision provider for optical transcription
        if self.vision_provider and await self.vision_provider.is_available():
            prompt = (
                "Perform exact OCR transcription on this image. "
                "Output all readable text, characters, tables, and mathematical formulas verbatim. "
                "Do not add conversational fluff or introductory text."
            )
            return await self.vision_provider.describe_image(image_bytes, prompt=prompt)

        return ""

