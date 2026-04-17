# AGENTS.md — embedder/

**Role**: Text embedding vector generation for semantic search
**Layer**: Foundation (used by L1 Index, L2 Content)
**Dependencies**: httpx, numpy

---

## Module Overview

This module provides text embedding generation using Ollama's bge-m3 model. Embeddings enable semantic search across the 4-layer memory system.

### Files

| File | Purpose | Key Classes |
|------|---------|-------------|
| `__init__.py` | Main module (360 lines) | `OllamaEmbedder`, `MockEmbedder`, `EmbedderError` |

---

## Key Classes

### OllamaEmbedder

Production embedder connecting to Ollama service.

```python
embedder = OllamaEmbedder()
embedding = await embedder.embed("text content")
# Returns: np.ndarray (1024-dimensional vector)
```

| Method | Description | Return Type |
|--------|-------------|-------------|
| `embed(text)` | Generate single embedding | `np.ndarray` (1024-dim) |
| `embed_batch(texts)` | Batch embedding | `list[np.ndarray]` |
| `embed_document(content, title, ...)` | Document with chunking | `dict` with chunks |
| `compute_similarity(v1, v2)` | Cosine similarity | `float` (-1.0 to 1.0) |

### MockEmbedder

Testing embedder with deterministic output (hash-based reproducibility).

---

## Layer Connections

| Layer | Usage |
|-------|-------|
| **L1 Index** | `VectorSearchCapability` uses embedder for indexing |
| **L2 Content** | Document storage triggers async embedding |

---

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `OLLAMA_HOST` | `localhost:11434` | Ollama service address |
| `OLLAMA_EMBEDDING_MODEL` | `bge-m3` | Embedding model |

---

## Token Budget

Embedding model: **bge-m3** (BAAI)
- Dimensions: 1024
- Multilingual (Chinese-native support)
- Chunk size: 512 chars (default)

---

## Testing

```bash
pytest tests/test_embedder/ -xvs
```

**Coverage requirement**: 100%

---

## Error Handling

```python
try:
    embedding = await embedder.embed(text)
except EmbedderError as e:
    # Handle: Ollama unavailable, empty embedding, etc.
    logger.warning(f"Embedding failed: {e}")
```