import logging
from typing import List
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.services.search.base import SearchProvider, SearchResult

logger = logging.getLogger("solix.search.tavily")

TAVILY_API_URL = "https://api.tavily.com/search"

# Maximum characters to keep per result content snippet
_MAX_SNIPPET_CHARS = 400
# Maximum total context characters across all results
_MAX_TOTAL_CHARS = 6000


class TavilySearchProvider(SearchProvider):
    """
    Tavily AI Search provider.

    Tavily is designed specifically for LLM-augmented search and returns
    clean, relevant snippets without requiring HTML scraping.
    """

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("TAVILY_API_KEY is required but not configured.")
        self.api_key = api_key
        self.timeout = settings.TAVILY_SEARCH_TIMEOUT

    @staticmethod
    def _extract_domain(url: str) -> str:
        """Extract the root domain from a URL for display purposes."""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc or url
            # Strip www. prefix for display
            if domain.startswith("www."):
                domain = domain[4:]
            return domain
        except Exception:
            return url

    @staticmethod
    def _truncate(text: str, max_chars: int) -> str:
        """Truncate text to max_chars, adding ellipsis if needed."""
        if not text:
            return ""
        text = text.strip()
        if len(text) <= max_chars:
            return text
        return text[:max_chars].rstrip() + "…"

    async def search(
        self,
        query: str,
        max_results: int = 8,
    ) -> List[SearchResult]:
        """
        Call the Tavily API and return filtered, normalised search results.

        Security note: Results are treated as untrusted reference data only.
        Content is sanitised/truncated before being passed to the LLM.
        """
        logger.info(f"[WebSearch] Tavily search — query='{query}', max={max_results}")

        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": "basic",
            "include_answer": False,
            "include_raw_content": False,
            "max_results": min(max_results, 10),  # Tavily cap
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(TAVILY_API_URL, json=payload)

                if response.status_code == 401:
                    raise PermissionError(
                        "Tavily API key is invalid. Check TAVILY_API_KEY in your backend .env."
                    )
                if response.status_code == 429:
                    raise RuntimeError(
                        "Tavily API rate limit exceeded. Please wait before trying again."
                    )
                if response.status_code != 200:
                    raise RuntimeError(
                        f"Tavily API returned HTTP {response.status_code}: {response.text[:200]}"
                    )

                data = response.json()

        except httpx.TimeoutException:
            raise TimeoutError(
                f"Tavily search timed out after {self.timeout}s. Please try again."
            )
        except httpx.ConnectError:
            raise ConnectionError(
                "Cannot reach Tavily API. Check your internet connection."
            )

        raw_results = data.get("results", [])
        logger.info(f"[WebSearch] Tavily returned {len(raw_results)} raw results")

        seen_urls: set = set()
        normalised: List[SearchResult] = []
        total_chars = 0

        for item in raw_results:
            url = (item.get("url") or "").strip()
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)

            # Prefer `content` field (Tavily's clean snippet)
            raw_content = item.get("content") or item.get("raw_content") or ""
            content = self._truncate(raw_content, _MAX_SNIPPET_CHARS)

            # Skip empty snippets — useless to the model
            if not content:
                continue

            # Enforce total context budget
            if total_chars + len(content) > _MAX_TOTAL_CHARS:
                logger.info(
                    f"[WebSearch] Context budget reached at {total_chars} chars; "
                    f"stopping after {len(normalised)} results."
                )
                break

            total_chars += len(content)
            normalised.append(
                SearchResult(
                    title=self._truncate(item.get("title") or url, 120),
                    url=url,
                    domain=self._extract_domain(url),
                    content=content,
                    published_date=item.get("published_date"),
                )
            )

            if len(normalised) >= max_results:
                break

        logger.info(
            f"[WebSearch] {len(normalised)} results kept "
            f"(~{total_chars} chars of context)"
        )
        return normalised

