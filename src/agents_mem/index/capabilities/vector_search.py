"""
L1 Vector Search Capability Module

Implements VectorSearchCapability using SQLite + Ollama embeddings.
Provides semantic search functionality without external dependencies.
"""

from dataclasses import dataclass, field
from typing import Any, Protocol

import numpy as np

from agents_mem.core.types import EntityType, SearchResult
from agents_mem.core.exceptions import SearchError
from agents_mem.embedder import OllamaEmbedder, MockEmbedder


# ============================================================================
# Vector Search Options
# ============================================================================


@dataclass
class VectorSearchOptions:
    """Options for vector search"""

    limit: int = 10
    min_score: float = 0.0
    resource_type: str | None = None


# ============================================================================
# Vector Index Entry
# ============================================================================


@dataclass
class VectorIndexEntry:
    """Entry for vector indexing"""

    uri: str
    embedding: list[float] = field(default_factory=list)
    content: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


# ============================================================================
# Database Protocol
# ============================================================================


class VectorDBConnection(Protocol):
    """Database connection protocol for vector operations"""

    async def run(self, query: str, params: list[Any] | None = None) -> Any: ...

    async def fetch_all(
        self, query: str, params: list[Any] | None = None
    ) -> list[dict[str, Any]]: ...


# ============================================================================
# Vector Search Capability
# ============================================================================


class VectorSearchCapability:
    """
    Vector search capability for semantic search.

    Uses Ollama embeddings + SQLite for vector storage and similarity search.
    """

    def __init__(
        self,
        db: VectorDBConnection,
        embedder: OllamaEmbedder | None = None,
        use_mock: bool = False,
    ):
        """
        Initialize vector search capability

        Args:
            db: Database connection
            embedder: Ollama embedder instance (creates default if None)
            use_mock: Use mock embedder for testing
        """
        self._db = db
        self._use_mock = use_mock

        if use_mock:
            self._embedder: OllamaEmbedder | MockEmbedder = MockEmbedder()
        else:
            self._embedder = embedder or OllamaEmbedder()

        self._initialized = False

    async def initialize(self) -> None:
        """Initialize vector search tables"""
        if self._initialized:
            return

        # Create vector index table
        await self._db.run(
            """
            CREATE TABLE IF NOT EXISTS vector_index (
                id TEXT PRIMARY KEY,
                uri TEXT NOT NULL,
                user_id TEXT NOT NULL,
                agent_id TEXT,
                team_id TEXT,
                resource_type TEXT NOT NULL,
                embedding BLOB NOT NULL,
                content TEXT,
                metadata TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """
        )

        # Create indexes
        await self._db.run(
            "CREATE INDEX IF NOT EXISTS idx_vector_uri ON vector_index(uri)"
        )
        await self._db.run(
            "CREATE INDEX IF NOT EXISTS idx_vector_user ON vector_index(user_id)"
        )
        await self._db.run(
            "CREATE INDEX IF NOT EXISTS idx_vector_type ON vector_index(resource_type)"
        )

        self._initialized = True

    async def index_document(
        self,
        uri: str,
        content: str,
        user_id: str,
        resource_type: str,
        agent_id: str | None = None,
        team_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Index a document for vector search

        Args:
            uri: Document URI
            content: Document content to embed
            user_id: User ID
            resource_type: Resource type
            agent_id: Optional agent ID
            team_id: Optional team ID
            metadata: Optional metadata

        Returns:
            Vector index entry ID
        """
        import json
        import time

        await self.initialize()

        # Generate embedding
        embedding = await self._embedder.embed(content)
        embedding_bytes = embedding.tobytes()

        entry_id = f"vec-{uri.split('/')[-1]}"
        now = int(time.time())
        metadata_json = json.dumps(metadata or {})

        # Insert or replace
        await self._db.run(
            """
            INSERT OR REPLACE INTO vector_index (
                id, uri, user_id, agent_id, team_id, resource_type,
                embedding, content, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                entry_id,
                uri,
                user_id,
                agent_id,
                team_id,
                resource_type,
                embedding_bytes,
                content[:1000],  # Store preview
                metadata_json,
                now,
                now,
            ],
        )

        return entry_id

    async def search(
        self,
        query: str,
        scope: Any,
        options: VectorSearchOptions | None = None,
    ) -> list[SearchResult]:
        """
        Semantic search using vector similarity

        Args:
            query: Search query
            scope: Scope for filtering (user_id, agent_id, team_id)
            options: Search options

        Returns:
            List of search results sorted by similarity
        """
        import json

        await self.initialize()

        if not query or not query.strip():
            return []

        # Generate query embedding
        query_embedding = await self._embedder.embed(query)

        # Fetch all vectors in scope
        params: list[Any] = [scope.user_id]
        where_clause = "WHERE user_id = ?"

        if scope.agent_id:
            where_clause += " AND agent_id = ?"
            params.append(scope.agent_id)
        elif scope.team_id:
            where_clause += " AND team_id = ?"
            params.append(scope.team_id)

        if options and options.resource_type:
            where_clause += " AND resource_type = ?"
            params.append(options.resource_type)

        rows = await self._db.fetch_all(
            f"SELECT id, uri, embedding, content, metadata, resource_type FROM vector_index {where_clause}",
            params,
        )

        if not rows:
            return []

        # Calculate similarities
        results: list[tuple[float, dict[str, Any]]] = []
        for row in rows:
            try:
                # Convert bytes back to numpy array
                embedding = np.frombuffer(row["embedding"], dtype=np.float32)

                # Calculate cosine similarity
                similarity = self._cosine_similarity(query_embedding, embedding)

                if similarity >= (options.min_score if options else 0.0):
                    metadata = json.loads(row["metadata"]) if row["metadata"] else {}
                    results.append((
                        float(similarity),
                        {
                            "uri": row["uri"],
                            "content": row["content"],
                            "metadata": metadata,
                            "resource_type": row["resource_type"],
                        },
                    ))
            except Exception:
                # Skip invalid embeddings
                continue

        # Sort by similarity (descending)
        results.sort(key=lambda x: x[0], reverse=True)

        # Apply limit
        limit = options.limit if options else 10
        results = results[:limit]

        # Convert to SearchResult objects
        search_results = []
        for score, data in results:
            search_results.append(
                SearchResult(
                    uri=data["uri"],
                    score=score,
                    abstract=data["content"],
                    context_type=data["resource_type"],
                    is_leaf=True,
                    metadata=data["metadata"],
                )
            )

        return search_results

    async def delete(self, uri: str) -> bool:
        """
        Delete vector index entry by URI

        Args:
            uri: Document URI

        Returns:
            True if deleted
        """
        await self.initialize()

        await self._db.run(
            "DELETE FROM vector_index WHERE uri = ?",
            [uri],
        )
        return True

    async def reindex(
        self,
        uri: str,
        content: str,
        user_id: str,
        resource_type: str,
        agent_id: str | None = None,
        team_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Re-index a document (update embedding)

        Args:
            uri: Document URI
            content: New content
            user_id: User ID
            resource_type: Resource type
            agent_id: Optional agent ID
            team_id: Optional team ID
            metadata: Optional metadata

        Returns:
            Vector index entry ID
        """
        return await self.index_document(
            uri, content, user_id, resource_type, agent_id, team_id, metadata
        )

    def _cosine_similarity(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray,
    ) -> float:
        """
        Calculate cosine similarity between two embeddings

        Args:
            embedding1: First embedding
            embedding2: Second embedding

        Returns:
            Similarity score (0.0 to 1.0)
        """
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        similarity = float(np.dot(embedding1, embedding2) / (norm1 * norm2))
        # Clamp to [0, 1] range
        return max(0.0, min(1.0, similarity))

    async def close(self) -> None:
        """Close embedder connection"""
        if hasattr(self._embedder, "close"):
            await self._embedder.close()


# ============================================================================
# Factory Function
# ============================================================================


def create_vector_search_capability(
    db: VectorDBConnection,
    embedder: OllamaEmbedder | None = None,
    use_mock: bool = False,
) -> VectorSearchCapability:
    """
    Create vector search capability

    Args:
        db: Database connection
        embedder: Ollama embedder instance
        use_mock: Use mock embedder for testing

    Returns:
        VectorSearchCapability instance
    """
    return VectorSearchCapability(db, embedder, use_mock)


__all__ = [
    "VectorSearchCapability",
    "VectorSearchOptions",
    "VectorIndexEntry",
    "create_vector_search_capability",
]
