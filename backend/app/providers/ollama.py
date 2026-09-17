import json
import logging
from typing import AsyncGenerator, Dict, List, Optional
import httpx
from app.core.config import settings
from app.providers.base import AIProvider

logger = logging.getLogger("solix.providers.ollama")


class OllamaProvider(AIProvider):
    """Ollama local AI Provider implementation."""

    def __init__(self, base_url: Optional[str] = None, default_model: Optional[str] = None):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.default_model = default_model or settings.OLLAMA_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT_SECONDS

    @property
    def name(self) -> str:
        return "ollama"

    async def check_health(self) -> bool:
        """Check if Ollama server is responding."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception as e:
            logger.debug(f"Ollama health check failed: {e}")
            return False

    async def list_models(self) -> List[Dict]:
        """Fetch available models from Ollama /api/tags."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = []
                    for item in data.get("models", []):
                        name = item.get("name", "unknown")
                        models.append({
                            "id": name,
                            "name": name,
                            "size": item.get("size"),
                            "modified_at": item.get("modified_at"),
                            "details": item.get("details", {}).get("family", "Ollama"),
                            "is_default": name.startswith(self.default_model),
                        })
                    return models
        except Exception as e:
            logger.warning(f"Failed to list Ollama models: {e}")
        return []

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream conversational tokens from Ollama chat endpoint."""
        target_model = model or self.default_model
        endpoint = f"{self.base_url}/api/chat"

        payload_messages = []
        if system_prompt:
            payload_messages.append({"role": "system", "content": system_prompt})

        for msg in messages:
            payload_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

        options = {}
        if temperature is not None:
            options["temperature"] = float(temperature)

        payload = {
            "model": target_model,
            "messages": payload_messages,
            "stream": True,
            "options": options,
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(self.timeout, connect=5.0)) as client:
                async with client.stream("POST", endpoint, json=payload) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        logger.error(f"Ollama error {response.status_code}: {err_body.decode('utf-8', errors='ignore')}")
                        yield f"Error from Ollama ({response.status_code}): {err_body.decode('utf-8', errors='ignore')}"
                        return

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            if "message" in chunk and "content" in chunk["message"]:
                                content = chunk["message"]["content"]
                                if content:
                                    yield content
                            if chunk.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue

        except httpx.ConnectError:
            logger.error(f"Cannot connect to Ollama at {self.base_url}")
            raise ConnectionError(
                f"Could not connect to Ollama at {self.base_url}. Please ensure Ollama is installed and running (`ollama serve`)."
            )
        except httpx.TimeoutException:
            logger.error("Ollama connection timed out")
            raise TimeoutError("Ollama request timed out while generating response.")
        except Exception as e:
            logger.error(f"Unexpected error in Ollama streaming: {e}")
            raise e

