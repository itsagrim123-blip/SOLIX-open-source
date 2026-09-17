from typing import Tuple
from app.core.config import settings
from app.providers.base import AIProvider
from app.providers.mock import MockProvider
from app.providers.ollama import OllamaProvider

_ollama_instance = OllamaProvider()
_mock_instance = MockProvider()


async def get_active_provider() -> Tuple[AIProvider, bool]:
    """Retrieve the primary AI provider (Ollama) if available, or fall back to mock.

    Returns:
        Tuple of (provider_instance, is_connected)
    """
    is_connected = await _ollama_instance.check_health()
    if is_connected:
        return _ollama_instance, True
    return _mock_instance, False


def get_ollama_provider() -> OllamaProvider:
    """Return the raw Ollama provider instance."""
    return _ollama_instance

