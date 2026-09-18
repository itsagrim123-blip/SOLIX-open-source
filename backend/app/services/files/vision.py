from abc import ABC, abstractmethod
import base64
import logging
from typing import Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("solix.files.vision")


class BaseVisionProvider(ABC):
    """Abstract interface for multimodal vision and visual document analysis."""

    @abstractmethod
    async def is_available(self) -> bool:
        """Check whether the vision model/provider is connected and ready."""
        pass

    @abstractmethod
    async def describe_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        prompt: Optional[str] = None,
    ) -> str:
        """Analyze image and extract textual content, diagrams, formulas, and structural description."""
        pass


class OllamaVisionProvider(BaseVisionProvider):
    """Integrates with local Ollama vision models (e.g. gemma3:4b, llava, minicpm-v, etc.)."""

    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model = model or settings.VISION_MODEL

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code != 200:
                    return False
                models = res.json().get("models", [])
                # Check if configured model exists or any model with vision capability
                for m in models:
                    name = m.get("name", "")
                    caps = m.get("capabilities", [])
                    if name.startswith(self.model) or self.model in name:
                        return True
                    if "vision" in caps:
                        # Found a vision model
                        return True
                return False
        except Exception as exc:
            logger.debug(f"[Vision] Availability check failed: {exc}")
            return False

    async def describe_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        prompt: Optional[str] = None,
    ) -> str:
        # Downscale large images (e.g. screenshots) to max 768px JPEG for fast visual encoding
        try:
            import io
            from PIL import Image
            with Image.open(io.BytesIO(image_bytes)) as pil_img:
                if pil_img.width > 768 or pil_img.height > 768 or pil_img.format != "JPEG":
                    pil_img.thumbnail((768, 768), Image.Resampling.LANCZOS)
                    buf = io.BytesIO()
                    pil_img.convert("RGB").save(buf, format="JPEG", quality=80)
                    image_bytes = buf.getvalue()
        except Exception as exc:
            logger.debug(f"[Vision] Could not optimize image before inference: {exc}")

        b64_img = base64.b64encode(image_bytes).decode("utf-8")

        system_instruction = (
            prompt
            or (
                "Identify and concisely describe what is shown in this image, "
                "including any prominent people, objects, text, UI elements, and scene context."
            )
        )

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": system_instruction,
                    "images": [b64_img],
                }
            ],
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(f"{self.base_url}/api/chat", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    msg = data.get("message", {})
                    content = msg.get("content", "").strip()
                    logger.info(f"[Vision] Extracted {len(content)} chars from image using {self.model}")
                    return content
                else:
                    logger.warning(f"[Vision] Ollama returned status {res.status_code}: {res.text}")
                    return ""
        except Exception as exc:
            logger.error(f"[Vision] Error performing vision extraction: {exc}")
            return ""

