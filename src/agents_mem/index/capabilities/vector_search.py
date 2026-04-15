"""
L1 Vector Search Capability Module

Implements VectorSearchCapability as an L1 built-in capability.
Uses OpenViking client for semantic vector search.

This is NOT a separate layer - it's a capability that L1 Index Layer uses
for semantic search functionality.
"""

from dataclasses import dataclass, field
from typing import Any

from agents_mem.core.types import EntityType, SearchResult
from agents_mem.core.exceptions import SearchError
from agents_mem.openviking.client import (
    OpenVikingClient,
    OpenVikingConfig,
    SearchResult as VikingSearchResult,
    VikingError,
)
from agents_mem.openviking.uri_adapter import URIAdapter


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
# Index Entry
# ============================================================================


@dataclass
class VectorIndexEntry:
    """Entry for vector indexing"""

    uri: str
    embedding: list[float] = field(default_factory=list[float])
    metadata: dict[str, Any] = field(default_factory=dict[str, Any])
    content: str | None = None


# ============================================================================
# Vector Search Capability
# ============================================================================


class VectorSearchCapability:
    """
    Vector Search Capability for L1 Index Layer

    Provides semantic search using OpenViking vector database.
    This is a built-in capability of L1, not a separate layer.

    Features:
    - Semantic vector search (find similar content)
    - Hybrid search (FTS + Vector + RRF fusion)
    - Index resources with embeddings
    - Support for multiple search modes

    Search Modes:
    - hybrid: Combines FTS + Vector with Reciprocal Rank Fusion (RRF)
    - vector: Pure semantic similarity search
    - fts: Full-text search only

    Usage:
        capability = VectorSearchCapability(openviking_client)
        results = await capability.find("query", target_uri, limit=10)
    """

    def __init__(
        self,
        openviking_client: OpenVikingClient,
        uri_adapter: URIAdapter | None = None,
        account: str = "default",
    ):
        """
        Initialize VectorSearchCapability

        Args:
            openviking_client: OpenViking client for vector operations
            uri_adapter: Optional URI adapter (default: new instance)
            account: Account name for Viking URI
        """
        self._client = openviking_client
        self._adapter = uri_adapter or URIAdapter(account=account)

    # =========================================================================
    # Search Methods
    # =========================================================================

    async def find(
        self,
        query: str,
        target_uri: str,
        options: VectorSearchOptions | None = None,
    ) -> list[SearchResult]:
        """
        Semantic search using OpenViking

        Args:
            query: Search query text
            target_uri: Target URI for search scope (viking:// format)
            options: Search options (limit, mode, tier, etc.)

        Returns:
            List of SearchResult objects

        Raises:
            SearchError: Search operation failed
        """
        options = options or VectorSearchOptions()

        try:
            # Call OpenViking find API
            viking_results = await self._client.search(
                query=query,
                target_uri=target_uri,
                limit=options.limit,
                mode=options.mode,
            )

            # Convert to SearchResult
            results: list[SearchResult] = []
            for viking_result in viking_results:
                if viking_result.score >= options.min_score:
                    results.append(self._viking_to_search_result(viking_result))

            return results

        except VikingError as e:
            raise SearchError(
                message=f"Vector search failed: {e.message}",
                query=query,
                search_mode=options.mode,
                details={"viking_error": str(e)},
            )

    async def find_hybrid(
        self,
        query: str,
        user_id: str,
        agent_id: str | None = None,
        entity_type: EntityType = EntityType.DOCUMENTS,
        limit: int = 10,
    ) -> list[SearchResult]:
        """
        Hybrid search (FTS + Vector + RRF)

        Convenience method that builds target URI from scope parameters.

        Args:
            query: Search query text
            user_id: User ID
            agent_id: Optional agent ID
            entity_type: Entity type to search
            limit: Maximum results

        Returns:
            List of SearchResult objects
        """
        # Build target URI for OpenViking
        target_uri = self._adapter.build_target_uri(
            user_id=user_id,
            agent_id=agent_id,
            entity_type=entity_type,
        )

        options = VectorSearchOptions(limit=limit, mode="hybrid")
        return await self.find(query, target_uri, options)

    async def find_semantic(
        self,
        query: str,
        user_id: str,
        agent_id: str | None = None,
        entity_type: EntityType = EntityType.DOCUMENTS,
        limit: int = 10,
    ) -> list[SearchResult]:
        """
        Pure semantic (vector) search

        Args:
            query: Search query text
            user_id: User ID
            agent_id: Optional agent ID
            entity_type: Entity type to search
            limit: Maximum results

        Returns:
            List of SearchResult objects
        """
        target_uri = self._adapter.build_target_uri(
            user_id=user_id,
            agent_id=agent_id,
            entity_type=entity_type,
        )

        options = VectorSearchOptions(limit=limit, mode="vector")
        return await self.find(query, target_uri, options)

    # =========================================================================
    # Index Methods
    # =========================================================================

    async def index(
        self,
        uri: str,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
        content: str | None = None,
    ) -> str:
        """
        Index resource with embedding

        Args:
            uri: mem:// URI for the resource
            embedding: Embedding vector (1024-dim for bge-m3)
            metadata: Optional metadata dict
            content: Optional content text for L0/L1 generation

        Returns:
            OpenViking root URI or task ID

        Raises:
            SearchError: Index operation failed
        """
        # Convert mem:// URI to viking:// URI
        scope_info = self._adapter.extract_scope_from_uri(uri)
        user_id = scope_info.get("user_id", "")
        agent_id = scope_info.get("agent_id")

        if not user_id:
            raise SearchError(
                message="Cannot extract user_id from URI",
                query=uri,
                search_mode="index",
            )

        # Build Viking target URI
        entity_type_str = scope_info.get("entity_type", "documents")
        try:
            entity_type = EntityType(entity_type_str)
        except ValueError:
            entity_type = EntityType.DOCUMENTS

        viking_uri = self._adapter.build_resource_uri(
            user_id=user_id,
            agent_id=agent_id,
            entity_type=entity_type,
            resource_id=self._adapter.extract_id_from_uri(uri),
        )

        try:
            result = await self._client.index(
                uri=viking_uri,
                embedding=embedding,
                metadata=metadata,
                content=content,
            )
            return result.root_uri or result.task_id or ""

        except VikingError as e:
            raise SearchError(
                message=f"Index operation failed: {e.message}",
                query=uri,
                search_mode="index",
                details={"viking_error": str(e)},
            )

    async def index_batch(
        self,
        entries: list[VectorIndexEntry],
    ) -> list[str]:
        """
        Batch index multiple resources

        Args:
            entries: List of VectorIndexEntry

        Returns:
            List of root URIs or task IDs
        """
        results: list[str] = []
        for entry in entries:
            result = await self.index(
                uri=entry.uri,
                embedding=entry.embedding,
                metadata=entry.metadata,
                content=entry.content,
            )
            results.append(result)
        return results

    async def delete(self, uri: str) -> bool:
        """
        Delete indexed resource

        Args:
            uri: mem:// URI to delete

        Returns:
            True if deleted successfully

        Raises:
            SearchError: Delete operation failed
        """
        # Convert to viking URI
        scope_info = self._adapter.extract_scope_from_uri(uri)
        user_id = scope_info.get("user_id", "")
        agent_id = scope_info.get("agent_id")

        entity_type_str = scope_info.get("entity_type", "documents")
        try:
            entity_type = EntityType(entity_type_str)
        except ValueError:
            entity_type = EntityType.DOCUMENTS

        viking_uri = self._adapter.build_resource_uri(
            user_id=user_id,
            agent_id=agent_id,
            entity_type=entity_type,
            resource_id=self._adapter.extract_id_from_uri(uri),
        )

        try:
            return await self._client.delete(viking_uri)
        except VikingError as e:
            raise SearchError(
                message=f"Delete operation failed: {e.message}",
                query=uri,
                search_mode="delete",
                details={"viking_error": str(e)},
            )

    # =========================================================================
    # Health Check
    # =========================================================================

    async def health_check(self) -> tuple[bool, str]:
        """
        Check OpenViking service health

        Returns:
            (is_healthy, message)
        """
        return await self._client.health_check()

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _viking_to_search_result(
        self, viking_result: VikingSearchResult
    ) -> SearchResult:
        """Convert VikingSearchResult to SearchResult"""
        # Convert viking:// URI back to mem:// if possible
        viking_uri = viking_result.uri
        mem_uri = viking_uri  # Default to original if conversion fails

        try:
            if viking_uri.startswith("viking://"):
                mem_uri = self._adapter.to_mem_uri(viking_uri)
        except ValueError:
            pass  # Keep original URI if conversion fails

        return SearchResult(
            uri=mem_uri,
            score=viking_result.score,
            title=viking_result.metadata.get("title"),
            content=viking_result.abstract,
            metadata=viking_result.metadata,
        )

    def build_target_uri(
        self,
        user_id: str,
        agent_id: str | None = None,
        entity_type: EntityType = EntityType.DOCUMENTS,
    ) -> str:
        """
        Build target URI for search

        Args:
            user_id: User ID
            agent_id: Optional agent ID
            entity_type: Entity type

        Returns:
            viking:// target URI
        """
        return self._adapter.build_target_uri(
            user_id=user_id,
            agent_id=agent_id,
            entity_type=entity_type,
        )


# ============================================================================
# Factory Functions
# ============================================================================


def create_vector_search_capability(
    config: OpenVikingConfig | None = None,
    account: str = "default",
) -> VectorSearchCapability:
    """
    Create VectorSearchCapability with default client

    Args:
        config: OpenViking configuration
        account: Account name

    Returns:
        VectorSearchCapability instance
    """
    client = OpenVikingClient(config)
    return VectorSearchCapability(client, account=account)


__all__ = [
    "VectorSearchCapability",
    "VectorSearchOptions",
    "VectorIndexEntry",
    "create_vector_search_capability",
]