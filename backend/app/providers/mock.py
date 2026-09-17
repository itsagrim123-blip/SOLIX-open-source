import asyncio
from typing import AsyncGenerator, Dict, List, Optional
from app.providers.base import AIProvider


class MockProvider(AIProvider):
    """Fallback / Demonstration AI Provider when local Ollama is not responding."""

    @property
    def name(self) -> str:
        return "mock_preview"

    async def check_health(self) -> bool:
        return True

    async def list_models(self) -> List[Dict]:
        return [
            {
                "id": "solix-preview-mode",
                "name": "Solix Preview (Local Ollama Offline)",
                "size": 0,
                "modified_at": "Now",
                "details": "Simulation & Demo Fallback",
                "is_default": True,
            },
            {
                "id": "llama3.2",
                "name": "llama3.2 (Awaiting Ollama)",
                "size": 2000000000,
                "details": "Llama 3.2 via Ollama",
                "is_default": False,
            },
        ]

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream simulated response chunks to showcase UI features."""
        user_query = messages[-1].get("content", "") if messages else "Hello"

        header = (
            "> **Note:** Ollama is currently offline at `http://localhost:11434`.\n"
            "> Solix is operating in **Interactive Simulation Mode** so you can preview all UI features.\n"
            "> Start Ollama with `ollama serve` to connect your local model.\n\n"
        )

        # Generate contextual sample text based on prompt
        body_chunks = [
            header,
            f"### Response to: *\"{user_query}\"*\n\n",
            "Hello! I am **Solix**, your futuristic AI assistant. Here is a demonstration of what I can do:\n\n",
            "- **Markdown Support**: Headings, lists, bold text, and tables.\n",
            "- **Clean Typography**: High contrast readability over glassmorphic panels.\n",
            "- **Code Execution & Syntax Highlighting**: Clean syntax formatting with language labels and one-click copy.\n\n",
            "```python\n",
            "# Example Python code block\n",
            "def greet_solix(user_name: str) -> str:\n",
            "    \"\"\"Return a greeting from Solix AI.\"\"\"\n",
            "    return f\"Welcome to Solix, {user_name}! Enjoy the glassmorphic interface.\"\n\n",
            "print(greet_solix(\"Developer\"))\n",
            "```\n\n",
            "| Feature | Status | Notes |\n",
            "| :--- | :--- | :--- |\n",
            "| **Streaming** | Active | Server-Sent Events (SSE) |\n",
            "| **Glassmorphism** | Active | Backdrop blur & ambient glow |\n",
            "| **Database** | Active | SQLite async conversation history |\n",
            "| **AI Provider** | Ready | Connects directly to local Ollama |\n\n",
            "Feel free to ask questions, explore conversations in the sidebar, or adjust settings!",
        ]

        # Break text into small tokens to simulate realistic streaming
        for chunk in body_chunks:
            words = chunk.split(" ")
            for i, word in enumerate(words):
                to_send = word + (" " if i < len(words) - 1 else "")
                yield to_send
                await asyncio.sleep(0.02)

