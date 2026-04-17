"""
L1 Index Layer Module

Implements the Index Layer for the 6-layer progressive disclosure architecture.

L1 Responsibilities:
- URI System (mem:// scheme)
- Metadata Index (SQLite FTS)
- Vector Search Capability (optional, via embeddings)

Dependencies:
- L0 IdentityLayer: Scope validation

Key Classes:
- IndexLayer: Main L1 class with unified search
- MetadataIndex: Full-text search via SQLite
- VectorSearchCapability: Semantic search (optional)

Search Modes:
- fts: Full-text search
- semantic: Vector search (if available)
- hybrid: FTS + Vector with RRF fusion
- progressive: Hybrid with tiered loading

Usage:
    from agents_mem.index import IndexLayer
    from agents_mem.identity import IdentityLayer

    identity = IdentityLayer()
    index_layer = IndexLayer(identity, db)

    results = await index_layer.find("query", scope, mode="hybrid")
"""

# Main Layer
from agents_mem.index.layer import (
    IndexLayer,
    IndexResult,
    FindOptions,
    DBConnection,
    reciprocal_rank_fusion,
)

# Metadata Index
from agents_mem.index.metadata import (
    MetadataIndex,
    MetadataEntry,
    SearchOptions,
)

# Capabilities
from agents_mem.index.capabilities import (
    VectorSearchCapability,
    VectorSearchOptions,
    VectorIndexEntry,
    create_vector_search_capability,
)

__all__ = [
    # Layer
    "IndexLayer",
    "IndexResult",
    "FindOptions",
    "DBConnection",
    "reciprocal_rank_fusion",
    # Metadata
    "MetadataIndex",
    "MetadataEntry",
    "SearchOptions",
    # Capabilities
    "VectorSearchCapability",
    "VectorSearchOptions",
    "VectorIndexEntry",
    "create_vector_search_capability",
]