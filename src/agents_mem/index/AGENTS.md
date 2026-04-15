# AGENTS.md — index/

**Role**: L1 Index Layer implementation
**Layer**: L1
**Dependencies**: core/, identity/, openviking/

---

## Module Overview

L1 provides indexing and search capabilities:
- URI system for resource addressing
- Metadata index (SQLite FTS5)
- Vector search via OpenViking
- Hybrid search (FTS + Vector with RRF)

### Files

| File | Purpose | Key Classes |
|------|---------|-------------|
| `layer.py` | Main L1 class | `IndexLayer` |
| `metadata.py` | FTS metadata index | `MetadataIndex`, `SearchOptions` |
| `capabilities/vector_search.py` | Vector search | `VectorSearchCapability` |

---

## Search Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `fts` | Full-text search (BM25) | Exact keyword matching |
| `semantic` | Vector similarity | Semantic relevance |
| `hybrid` | FTS + Vector + RRF | **Default** - Best for Chinese |
| `progressive` | L0 → L1 → L2 fallback | Token-limited contexts |

### Hybrid Search (RRF)

```python
# Reciprocal Rank Fusion
score_rrf = sum(1.0 / (k + rank) for k=60)
```

Combines FTS and semantic results intelligently.

---

## IndexLayer API

```python
# Initialize
index = IndexLayer(identity_layer, db_connection)

# Search
results = await index.search(
    scope=scope,
    query="semantic search",
    mode=SearchMode.HYBRID,
    limit=10
)

# Index document
await index.index_document(uri, content, metadata)
```

---

## Vector Search Flow

1. **Text** → Ollama (bge-m3) → **Embedding vector**
2. **Vector** → OpenViking → **Similarity search**
3. **Results** → RRF fusion with FTS → **Final ranking**

---

## External Services

| Service | Address | Purpose |
|---------|---------|---------|
| OpenViking | localhost:1933 | Vector storage/search |
| Ollama | localhost:11434 | Embedding generation |

---

## Testing

```bash
pytest tests/test_index/ -xvs
```

**Note**: Tests may need mocking for OpenViking/Ollama in CI.
