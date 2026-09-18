from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class SearchResult:
    """A single normalised web search result."""
    title: str
    url: str
    domain: str
    content: str
    published_date: Optional[str] = None


class SearchProvider(ABC):
    """Abstract base class for web search providers."""

    @abstractmethod
    async def search(
        self,
        query: str,
        max_results: int = 8,
    ) -> List[SearchResult]:
        """
        Execute a web search and return a list of normalised results.

        Args:
            query:       User search query string.
            max_results: Maximum number of results to return.

        Returns:
            List of SearchResult objects, already filtered and deduped.
        """
        pass

