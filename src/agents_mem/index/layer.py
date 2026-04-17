"""
L1 Index Layer Main Module

Implements the Index Layer (L1) for the 4-layer Clean Architecture.

L1 Responsibilities:
- URI System (using URISystem from core)
- Metadata Index (MetadataIndex)
- Vector Search Capability (VectorSearchCapability)

L1 depends on L0 (Identity Layer) for scope validation.

Search Modes:
- fts: Full-text search via MetadataIndex
- semantic: Vector search via VectorSearchCapability
- hybrid: Combines FTS + Vector with Reciprocal Rank Fusion (RRF)
"""

from dataclasses import dataclass
from typing import Any, Protocol

from agents_mem.core.types import Scope, EntityType, SearchResult, SearchMode
from agents_mem.core.uri import URISystem, MaterialURI, Scope as URIScope
from agents_mem.core.exceptions import SearchError
from agents_mem.identity.layer import IdentityLayer
from agents_mem.index.metadata import MetadataIndex, MetadataEntry, SearchOptions
from agents_mem.index.capabilities.vector_search import (
    VectorSearchCapability,
    VectorSearchOptions,
)


# ============================================================================
# Database Connection Protocol
# ============================================================================


class DBConnection(Protocol):
    """Database connection protocol"""

    async def execute(
        self, query: str, params: dict[str, Any] | None = None
    ) -> Any: ...

    async def fetch_one(
        self, query: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any] | None: ...

    async def fetch_all(
        self, query: str, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]: ...


# ============================================================================
# Find Options
# ============================================================================


@dataclass
class FindOptions:
    """Options for IndexLayer.find()"""

    limit: int = 10
    offset: int = 0
    min_importance: float = 0.0
    min_score: float = 0.0
    target_type: str | None = None
    entity_type: EntityType | None = None


# ============================================================================
# Index Result
# ============================================================================


@dataclass
class IndexResult:
    """Result of index_resource operation"""

    uri: str
    metadata_entry: MetadataEntry
    vector_indexed: bool
    vector_task_id: str | None = None


# ============================================================================
# RRF (Reciprocal Rank Fusion) Helper
# ============================================================================


def reciprocal_rank_fusion(
    fts_results: list[SearchResult],
    vector_results: list[SearchResult],
    k: int = 60,
) -> list[SearchResult]:
    """
    Reciprocal Rank Fusion for hybrid search

    Combines ranked lists from FTS and vector search.
    RRF score = sum(1 / (k + rank)) for each result in each list.

    Args:
        fts_results: Results from full-text search
        vector_results: Results from vector search
        k: RRF constant (default 60)

    Returns:
        Fused and ranked results
    """
    # Build URI -> RRF score map
    rrf_scores: dict[str, float] = {}

    # Add FTS rankings
    for rank, result in enumerate(fts_results, start=1):
        uri = result.uri
        if uri not in rrf_scores:
            rrf_scores[uri] = 0.0
        rrf_scores[uri] += 1.0 / (k + rank)

    # Add vector rankings
    for rank, result in enumerate(vector_results, start=1):
        uri = result.uri
        if uri not in rrf_scores:
            rrf_scores[uri] = 0.0
        rrf_scores[uri] += 1.0 / (k + rank)

    # Build fused results (prioritize results with both sources)
    all_results: dict[str, SearchResult] = {}

    for result in fts_results:
        all_results[result.uri] = result

    for result in vector_results:
        if result.uri not in all_results:
            all_results[result.uri] = result
        else:
            # Merge metadata from both sources
            existing = all_results[result.uri]
            merged_metadata = {**existing.metadata, **result.metadata}
            all_results[result.uri] = SearchResult(
                uri=result.uri,
                score=rrf_scores[result.uri],
                title=result.title or existing.title,
                content=result.content or existing.content,
                metadata=merged_metadata,
            )

    # Sort by RRF score
    sorted_results = sorted(
        all_results.values(),
        key=lambda r: rrf_scores[r.uri],
        reverse=True,
    )

    return sorted_results


# ============================================================================
# Index Layer
# ============================================================================


class IndexLayer:
    """
    L1 Index Layer

    Provides indexing and search capabilities:
    - URI System: Build and parse mem:// URIs
    - Metadata Index: Full-text search via SQLite
    - Vector Search: Semantic search via VectorSearchCapability (optional)

    Dependencies:
    - L0 IdentityLayer: Scope validation

    Search Modes:
    - fts: MetadataIndex full-text search
    - semantic: VectorSearchCapability vector search (if available)
    - hybrid: RRF fusion of FTS + Vector results

    Usage:
        layer = IndexLayer(identity_layer, db)
        results = await layer.find("query", scope, mode="hybrid")
    """

    def __init__(
        self,
        identity_layer: IdentityLayer,
        db: DBConnection,
        account: str = "default",
    ):
        """
        Initialize Index Layer

        Args:
            identity_layer: L0 IdentityLayer for scope validation
            db: Database connection
            account: Account name for URI adapter
        """
        self._identity = identity_layer
        self._db = db
        self._uri_system = URISystem

        # Initialize MetadataIndex
        self._metadata_index = MetadataIndex(db, identity_layer)

        # VectorSearchCapability is optional
        self._vector_search: VectorSearchCapability | None = None

    @property
    def metadata_index(self) -> MetadataIndex:
        """Get metadata index"""
        return self._metadata_index

    @property
    def vector_search(self) -> VectorSearchCapability | None:
        """Get vector search capability"""
        return self._vector_search

    @property
    def uri_system(self) -> type[URISystem]:
        """Get URI system class"""
        return self._uri_system

    @property
    def uri_adapter(self) -> URIAdapter:
        """Get URI adapter"""
        return self._uri_adapter

    # =========================================================================
    # Core Search Methods
    # =========================================================================

    async def find(
        self,
        query: str,
        scope: Scope,
        mode: SearchMode | str = SearchMode.HYBRID,
        options: FindOptions | None = None,
    ) -> list[SearchResult]:
        """
        Unified search interface

        Args:
            query: Search query text
            scope: Scope for filtering (user_id required)
            mode: Search mode (fts, semantic, hybrid, progressive)
            options: Search options

        Returns:
            List of SearchResult objects

        Raises:
            ScopeError: Scope validation failed
            SearchError: Search operation failed
        """
        # Validate scope via L0
        self._identity.validate_scope_or_raise(scope)

        options = options or FindOptions()

        # Normalize mode
        mode_str = mode.value if isinstance(mode, SearchMode) else mode

        if mode_str == SearchMode.FTS.value:
            return await self._find_fts(query, scope, options)
        elif mode_str == SearchMode.SEMANTIC.value:
            return await self._find_semantic(query, scope, options)
        elif mode_str == SearchMode.HYBRID.value:
            return await self._find_hybrid(query, scope, options)
        elif mode_str == SearchMode.PROGRESSIVE.value:
            return await self._find_progressive(query, scope, options)
        else:
            raise SearchError(
                message=f"Unknown search mode: {mode}",
                query=query,
                search_mode=mode_str,
            )

    async def _find_fts(
        self,
        query: str,
        scope: Scope,
        options: FindOptions,
    ) -> list[SearchResult]:
        """FTS-only search via MetadataIndex"""
        search_options = SearchOptions(
            limit=options.limit,
            offset=options.offset,
            min_importance=options.min_importance,
            target_type=options.target_type,
        )
        return await self._metadata_index.search(query, scope, search_options)

    async def _find_semantic(
        self,
        query: str,
        scope: Scope,
        options: FindOptions,
    ) -> list[SearchResult]:
        """Vector-only search via VectorSearchCapability"""
        if not self._vector_search:
            raise SearchError(
                message="Vector search capability not configured",
                query=query,
                search_mode="semantic",
            )

        entity_type = options.entity_type or EntityType.DOCUMENTS
        target_uri = self._uri_adapter.build_target_uri(
            user_id=scope.user_id,
            agent_id=scope.agent_id,
            entity_type=entity_type,
        )

        vector_options = VectorSearchOptions(
            limit=options.limit,
            mode="vector",
            min_score=options.min_score,
        )

        return await self._vector_search.find(query, target_uri, vector_options)

    async def _find_hybrid(
        self,
        query: str,
        scope: Scope,
        options: FindOptions,
    ) -> list[SearchResult]:
        """
        Hybrid search (FTS + Vector + RRF)

        Combines results from both sources using Reciprocal Rank Fusion.
        """
        # Run FTS search
        fts_results = await self._find_fts(query, scope, options)

        # Run vector search if available
        vector_results: list[SearchResult] = []
        if self._vector_search:
            try:
                vector_options = FindOptions(
                    limit=options.limit,
                    min_score=options.min_score,
                    entity_type=options.entity_type,
                )
                vector_results = await self._find_semantic(
                    query, scope, vector_options
                )
            except SearchError:
                # Continue with FTS results only if vector fails
                pass

        # Apply RRF fusion
        fused_results = reciprocal_rank_fusion(fts_results, vector_results)

        # Apply limit
        return fused_results[:options.limit]

    async def _find_progressive(
        self,
        query: str,
        scope: Scope,
        options: FindOptions,
    ) -> list[SearchResult]:
        """
        True Progressive Search: L0 → L1 → L2

        Searches progressively through importance tiers:
        - L0: High importance (min_importance=0.7)
        - L1: Medium importance (min_importance=0.4)
        - L2: All content (no importance filter)

        Each result is marked with its tier in metadata.
        """
        results: list[SearchResult] = []
        seen_uris: set[str] = set()

        # Step 1: L0 Search (high importance only)
        l0_options = FindOptions(
            limit=options.limit,
            offset=options.offset,
            min_importance=0.7,
            min_score=options.min_score,
            target_type=options.target_type,
            entity_type=options.entity_type,
        )
        l0_results = await self._find_hybrid(query, scope, l0_options)
        for r in l0_results:
            if r.uri not in seen_uris:
                results.append(self._mark_tier(r, "L0"))
                seen_uris.add(r.uri)

        if len(results) >= options.limit:
            return results[:options.limit]

        # Step 2: L1 Search (medium importance)
        remaining = options.limit - len(results)
        l1_options = FindOptions(
            limit=remaining,
            offset=options.offset,
            min_importance=0.4,
            min_score=options.min_score,
            target_type=options.target_type,
            entity_type=options.entity_type,
        )
        l1_results = await self._find_hybrid(query, scope, l1_options)
        for r in l1_results:
            if r.uri not in seen_uris:
                results.append(self._mark_tier(r, "L1"))
                seen_uris.add(r.uri)

        if len(results) >= options.limit:
            return results[:options.limit]

        # Step 3: L2 Search (all content)
        remaining = options.limit - len(results)
        l2_options = FindOptions(
            limit=remaining,
            offset=options.offset,
            min_importance=0.0,
            min_score=options.min_score,
            target_type=options.target_type,
            entity_type=options.entity_type,
        )
        l2_results = await self._find_hybrid(query, scope, l2_options)
        for r in l2_results:
            if r.uri not in seen_uris:
                results.append(self._mark_tier(r, "L2"))
                seen_uris.add(r.uri)

        return results[:options.limit]

    def _mark_tier(self, result: SearchResult, tier: str) -> SearchResult:
        """
        Mark a SearchResult with tier information

        SearchResult is frozen, so we create a new instance with
        updated metadata containing the tier field.

        Args:
            result: Original SearchResult
            tier: Tier level (L0, L1, L2)

        Returns:
            New SearchResult with tier in metadata
        """
        # Merge existing metadata with tier
        metadata = {**result.metadata, "tier": tier}
        return SearchResult(
            uri=result.uri,
            score=result.score,
            title=result.title,
            content=result.content,
            metadata=metadata,
            entity_type=result.entity_type,
            resource_id=result.resource_id,
        )

    # =========================================================================
    # URI-based Operations
    # =========================================================================

    async def find_by_uri(self, uri: str) -> MetadataEntry:
        """
        Find resource by URI

        Args:
            uri: mem:// URI

        Returns:
            MetadataEntry

        Raises:
            NotFoundError: Resource not found
            URIError: Invalid URI format
        """
        return await self._metadata_index.get_by_uri_or_raise(uri)

    async def find_by_uri_optional(self, uri: str) -> MetadataEntry | None:
        """
        Find resource by URI (optional)

        Args:
            uri: mem:// URI

        Returns:
            MetadataEntry or None
        """
        return await self._metadata_index.get_by_uri(uri)

    # =========================================================================
    # Index Operations
    # =========================================================================

    async def index_resource(
        self,
        scope: Scope,
        target_type: str,
        target_id: str,
        title: str,
        description: str | None = None,
        embedding: list[float] | None = None,
        metadata: dict[str, Any] | None = None,
        content: str | None = None,
        topic: str | None = None,
        entity: str | None = None,
        category: str | None = None,
        tags: list[str] | None = None,
        importance: float = 0.5,
        path: str | None = None,
        is_global: bool = False,
    ) -> IndexResult:
        """
        Index a resource in both metadata and vector store

        Args:
            scope: Scope for the resource
            target_type: Resource type (documents, assets, etc.)
            target_id: Resource ID
            title: Resource title
            description: Optional description
            embedding: Optional embedding vector for semantic search
            metadata: Optional metadata dict
            content: Optional content for L0/L1 generation
            topic: Optional topic
            entity: Optional entity
            category: Optional category
            tags: Optional tags list
            importance: Importance score (0-1)
            path: Optional hierarchical path
            is_global: Global visibility flag

        Returns:
            IndexResult with metadata entry and vector status
        """
        # Validate scope
        self._identity.validate_scope_or_raise(scope)

        # Build URI
        uri = self._uri_system.build(
            scope=self._scope_to_uri_scope(scope),
            resource_type=target_type,
            resource_id=target_id,
        )

        # Index in metadata
        metadata_entry = await self._metadata_index.index_resource(
            uri=uri,
            scope=scope,
            target_type=target_type,
            target_id=target_id,
            title=title,
            description=description,
            topic=topic,
            entity=entity,
            category=category,
            tags=tags,
            importance=importance,
            path=path,
            is_global=is_global,
        )

        # Index in vector store if embedding provided
        vector_indexed = False
        vector_task_id = None

        if embedding and self._vector_search:
            try:
                vector_task_id = await self._vector_search.index(
                    uri=uri,
                    embedding=embedding,
                    metadata=metadata,
                    content=content,
                )
                vector_indexed = True
            except SearchError:
                # Vector indexing failed, but metadata succeeded
                pass

        return IndexResult(
            uri=uri,
            metadata_entry=metadata_entry,
            vector_indexed=vector_indexed,
            vector_task_id=vector_task_id,
        )

    async def update_index(
        self,
        uri: str,
        title: str | None = None,
        description: str | None = None,
        embedding: list[float] | None = None,
        importance: float | None = None,
    ) -> MetadataEntry:
        """
        Update indexed resource metadata

        Args:
            uri: mem:// URI
            title: New title
            description: New description
            embedding: New embedding
            importance: New importance

        Returns:
            Updated MetadataEntry
        """
        # Update metadata
        entry = await self._metadata_index.update(
            uri=uri,
            title=title,
            description=description,
            importance=importance,
        )

        # Update vector index if embedding provided
        if embedding and self._vector_search:
            try:
                await self._vector_search.index(uri=uri, embedding=embedding)
            except SearchError:
                pass

        return entry

    async def delete_index(self, uri: str) -> bool:
        """
        Delete resource from both metadata and vector store

        Args:
            uri: mem:// URI

        Returns:
            True if deleted successfully
        """
        # Delete from metadata
        metadata_deleted = await self._metadata_index.delete(uri)

        # Delete from vector store
        vector_deleted = False
        if self._vector_search:
            try:
                vector_deleted = await self._vector_search.delete(uri)
            except SearchError:
                pass

        return metadata_deleted or vector_deleted

    # =========================================================================
    # URI Helpers
    # =========================================================================

    def build_uri(
        self,
        scope: Scope,
        resource_type: str,
        resource_id: str,
    ) -> str:
        """
        Build mem:// URI

        Args:
            scope: Scope
            resource_type: Resource type
            resource_id: Resource ID

        Returns:
            mem:// URI string
        """
        return self._uri_system.build(
            scope=self._scope_to_uri_scope(scope),
            resource_type=resource_type,
            resource_id=resource_id,
        )

    def parse_uri(self, uri: str) -> MaterialURI:
        """
        Parse mem:// URI

        Args:
            uri: mem:// URI string

        Returns:
            MaterialURI components
        """
        return self._uri_system.parse(uri)

    def validate_uri(self, uri: str) -> bool:
        """
        Validate URI format

        Args:
            uri: URI string

        Returns:
            True if valid
        """
        return self._uri_system.validate(uri)

    def _scope_to_uri_scope(self, scope: Scope) -> URIScope:
        """Convert core.types.Scope to core.uri.Scope"""
        return URIScope(
            user_id=scope.user_id,
            agent_id=scope.agent_id,
            team_id=scope.team_id,
        )

    # =========================================================================
    # Scope Operations
    # =========================================================================

    async def list_by_scope(
        self,
        scope: Scope,
        target_type: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[MetadataEntry]:
        """
        List all resources in a scope

        Args:
            scope: Scope to list
            target_type: Optional type filter
            limit: Result limit
            offset: Result offset

        Returns:
            List of MetadataEntry objects
        """
        return await self._metadata_index.filter_by_scope(
            scope=scope,
            target_type=target_type,
            limit=limit,
            offset=offset,
        )


__all__ = [
    "IndexLayer",
    "IndexResult",
    "FindOptions",
    "DBConnection",
    "reciprocal_rank_fusion",
]