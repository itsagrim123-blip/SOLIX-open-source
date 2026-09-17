import json
import logging
from typing import AsyncGenerator, Dict, List, Optional
import httpx
from app.core.config import settings
from app.providers.base import AIProvider

logger = logging.getLogger("solix.providers.ollama")


class ModelNotFoundError(Exception):
    """Raised when a requested AI model is not installed or available in Ollama."""
    pass


class OllamaConnectionError(Exception):
    """Raised when the Ollama server cannot be reached."""
    pass


class OllamaProvider(AIProvider):
    """Ollama local AI Provider implementation with VRAM and model-lifecycle management."""

    def __init__(self, base_url: Optional[str] = None, default_model: Optional[str] = None):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.default_model = default_model or settings.OLLAMA_MODEL
        self.active_model = self.default_model
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
                            "is_default": (name == self.active_model or name.startswith(self.default_model)),
                        })
                    return models
        except Exception as e:
            logger.warning(f"Failed to list Ollama models: {e}")
        return []

    async def resolve_model_name(self, model_name: str) -> Optional[str]:
        """Resolve a model name or alias against installed Ollama models."""
        models = await self.list_models()
        installed_names = [m["id"] for m in models]

        # Exact match
        if model_name in installed_names:
            return model_name

        # Match with :latest tag
        if f"{model_name}:latest" in installed_names:
            return f"{model_name}:latest"

        # Match without tag if unique
        for name in installed_names:
            if name.split(":")[0] == model_name:
                return name

        return None

    async def model_exists(self, model_name: str) -> bool:
        """Check whether a model exists in local Ollama."""
        resolved = await self.resolve_model_name(model_name)
        return resolved is not None

    async def get_running_models(self) -> List[Dict]:
        """Retrieve list of currently loaded models in VRAM via Ollama /api/ps."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/ps")
                if res.status_code == 200:
                    data = res.json()
                    return data.get("models", [])
        except Exception as e:
            logger.debug(f"Failed to inspect running Ollama models: {e}")
        return []

    async def unload_model(self, model_name: str) -> bool:
        """Unload a model from GPU/VRAM by setting keep_alive: 0."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    f"{self.base_url}/api/generate",
                    json={"model": model_name, "keep_alive": 0},
                )
                if res.status_code == 200:
                    logger.info(f"[Ollama] Unloaded model '{model_name}' from VRAM.")
                    return True
        except Exception as e:
            logger.warning(f"Failed to unload model '{model_name}': {e}")
        return False

    async def unload_other_models(self, keep_model: str) -> None:
        """Unload all currently running models in VRAM except keep_model (optimizes RTX 4050 6GB VRAM)."""
        running = await self.get_running_models()
        resolved_keep = await self.resolve_model_name(keep_model) or keep_model

        for item in running:
            running_name = item.get("name") or item.get("model")
            if running_name and running_name != resolved_keep:
                logger.info(f"[Ollama] Freeing VRAM: unloading '{running_name}' before loading '{resolved_keep}'")
                await self.unload_model(running_name)

    async def preload_model(self, model_name: str) -> bool:
        """Preload a model into VRAM and verify readiness."""
        resolved = await self.resolve_model_name(model_name) or model_name
        try:
            logger.info(f"[Ollama] Preloading model '{resolved}' into VRAM...")
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    f"{self.base_url}/api/generate",
                    json={"model": resolved},
                )
                if res.status_code == 200:
                    logger.info(f"[Ollama] Model '{resolved}' is preloaded and ready in VRAM.")
                    return True
                else:
                    logger.error(f"[Ollama] Failed to preload model '{resolved}': {res.text}")
        except Exception as e:
            logger.error(f"[Ollama] Exception while preloading model '{resolved}': {e}")
        return False

    async def switch_model(self, target_model: str) -> Dict:
        """Coordinate full model switch: verify, unload previous, preload new, and confirm ready."""
        logger.info(f"[Ollama] Model switch requested -> '{target_model}'")
        resolved = await self.resolve_model_name(target_model)
        if not resolved:
            logger.error(f"[Ollama] ERROR: Model '{target_model}' not found in Ollama.")
            raise ModelNotFoundError(f"MODEL_NOT_FOUND: Model '{target_model}' is not installed in Ollama.")

        # 1. Unload other active models to manage 6GB VRAM
        await self.unload_other_models(resolved)

        # 2. Preload target model
        success = await self.preload_model(resolved)
        if not success:
            raise RuntimeError(f"Failed to prepare model '{resolved}' in Ollama.")

        # 3. Update active model
        self.active_model = resolved

        # 4. Check VRAM footprint
        vram_usage = None
        running = await self.get_running_models()
        for r in running:
            if (r.get("name") == resolved) or (r.get("model") == resolved):
                vram_usage = r.get("size_vram")
                break

        logger.info(f"[Ollama] Model '{resolved}' ready. VRAM usage: {vram_usage} bytes.")
        return {
            "status": "ready",
            "model": resolved,
            "message": f"Model {resolved} is loaded and ready.",
            "vram_usage": vram_usage,
        }

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream conversational tokens from Ollama chat endpoint with proper error handling and logging."""
        requested = model or self.active_model or self.default_model
        resolved_model = await self.resolve_model_name(requested)

        if not resolved_model:
            logger.error(f"[Ollama] ERROR\nModel: {requested}\nError: Model not found in Ollama.")
            raise ModelNotFoundError(f"MODEL_NOT_FOUND: Model '{requested}' is not installed in Ollama.")

        # Ensure other models are unloaded from 6GB VRAM
        await self.unload_other_models(resolved_model)

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
            "model": resolved_model,
            "messages": payload_messages,
            "stream": True,
            "options": options,
        }

        logger.info(f"[Ollama] Model: {resolved_model}")
        logger.info(f"[Ollama] URL: {self.base_url}")
        logger.info(f"[Ollama] Request started (messages: {len(payload_messages)})")

        token_count = 0
        response_started = False

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(self.timeout, connect=5.0)) as client:
                async with client.stream("POST", endpoint, json=payload) as response:
                    if response.status_code == 404:
                        err_body = (await response.aread()).decode("utf-8", errors="ignore")
                        logger.error(f"[Ollama] ERROR\nModel: {resolved_model}\nError: {err_body}")
                        raise ModelNotFoundError(f"MODEL_NOT_FOUND: Model '{resolved_model}' not found in Ollama.")

                    if response.status_code != 200:
                        err_body = (await response.aread()).decode("utf-8", errors="ignore")
                        logger.error(f"[Ollama] ERROR\nModel: {resolved_model}\nStatus: {response.status_code}\nError: {err_body}")
                        raise RuntimeError(f"Ollama returned HTTP {response.status_code}: {err_body}")

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            if not response_started:
                                response_started = True
                                logger.info("[Ollama] Response started")

                            if "message" in chunk and "content" in chunk["message"]:
                                content = chunk["message"]["content"]
                                if content:
                                    token_count += 1
                                    yield content

                            if chunk.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue

            logger.info(f"[Ollama] Stream completed (tokens yielded: {token_count})")
            if token_count == 0:
                logger.warning(f"[Ollama] Stream ended with 0 tokens generated for model '{resolved_model}'.")

        except httpx.ConnectError:
            logger.error(f"[Ollama] ERROR\nModel: {resolved_model}\nError: Cannot connect to Ollama at {self.base_url}")
            raise OllamaConnectionError(
                f"Could not connect to Ollama at {self.base_url}. Please ensure Ollama is running."
            )
        except httpx.TimeoutException:
            logger.error(f"[Ollama] ERROR\nModel: {resolved_model}\nError: Request timed out after {self.timeout}s.")
            raise TimeoutError(f"Ollama request timed out after {self.timeout} seconds.")
        except (ModelNotFoundError, OllamaConnectionError, TimeoutError):
            raise
        except Exception as e:
            logger.error(f"[Ollama] ERROR\nModel: {resolved_model}\nError: {e}", exc_info=True)
            raise e
