"""
L1 Vector Search Capability Module

Implements VectorSearchCapability as an L1 built-in capability.
Uses SQLite-based embedding storage for vector search.

This is NOT a separate layer - it's a capability that L1 Index Layer uses
for semantic search functionality.
"""

from dataclasses import dataclass, field
from typing import Any

from agents_mem.core.types import EntityType, SearchResult
from agents_mem.core.exceptions import SearchError


# ============================================================================
# Vector Search Options
# ============================================================================


@dataclass
class VectorSearchOptions:
    """Options for vector search"""

    limit: int = 10
    mode: str = "hybrid"  # hybrid, vector, fts
    tier: str | None = None  # L0, L1, L2 filter
    min_score: float = 0.0


# ============================================================================
# Vector Search Capability
# ============================================================================


class VectorSearchCapability:
    """
    Vector search capability for semantic search.

    Currently disabled as OpenViking is not available on Windows.
    """

    def __init__(self):
        """Initialize vector search capability"""
        self._enabled = False

    async def search(
        self,
        query: str,
        scope: Any,
        options: VectorSearchOptions | None = None,
    ) -> list[SearchResult]:
        """
        Semantic search (currently disabled)

        Args:
            query: Search query
            scope: Scope for filtering
            options: Search options

        Returns:
            Empty list (capability disabled)
        """
        return []


def create_vector_search_capability(
    config: Any | None = None,
) -> VectorSearchCapability | None:
    """
    Create vector search capability (currently returns None)

    Args:
        config: Configuration (unused)

    Returns:
        None (capability disabled)
    """
    return None
