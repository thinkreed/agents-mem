# AGENTS.md — tools/

**Role**: MCP tool handlers for create/read/update/delete/export
**Layer**: Interface
**Dependencies**: All layers (L0-L3)

---

## Module Overview

Implements the 5 MCP tools exposed via FastMCP:
- `mem_create` - Create resources
- `mem_read` - Read/search/tiered views
- `mem_update` - Update resources
- `mem_delete` - Delete resources
- `mem_export` - Export to Markdown

### Files

| File | Tool | Resource Types |
|------|------|----------------|
| `create.py` | `mem_create` | document, asset, conversation, message, fact, team |
| `read.py` | `mem_read` | All types + search + tiered views |
| `update.py` | `mem_update` | All types |
| `delete.py` | `mem_delete` | All types (with cascade) |
| `export.py` | `mem_export` | content, knowledge |

---

## Tool Interface

### mem_create

```python
{
    "resource": "documents",  # EntityType value
    "scope": {"user_id": "user123"},
    "data": {
        "content": "Document content...",
        "title": "My Doc"
    }
}
```

### mem_read

```python
# Read by ID
{
    "resource": "documents",
    "id": "doc-456",
    "scope": {"user_id": "user123"}
}

# Search
{
    "resource": "documents",
    "query": "semantic search",
    "mode": "hybrid",  # fts | semantic | hybrid | progressive
    "tier": "L1",      # L0 | L1 | L2
    "scope": {"user_id": "user123"}
}
```

### mem_update

```python
{
    "resource": "documents",
    "id": "doc-456",
    "scope": {"user_id": "user123"},
    "data": {"title": "New Title"}
}
```

### mem_delete

```python
{
    "resource": "documents",
    "id": "doc-456",
    "scope": {"user_id": "user123"},
    "cascade": true  # Delete related facts
}
```

### mem_export

```python
{
    "type": "content",  # content | knowledge
    "scope": {"user_id": "user123"},
    "format": "markdown"
}
```

---

## Search Modes

| Mode | Description |
|------|-------------|
| `fts` | Full-text search via SQLite FTS5 |
| `semantic` | Vector similarity via OpenViking |
| `hybrid` | RRF fusion of FTS + semantic (default) |
| `progressive` | L0 → L1 → L2 fallback for token limits |

---

## Tier Levels

| Tier | Tokens | Use Case |
|------|--------|----------|
| `L0` | ~100 | Quick overview |
| `L1` | ~2000 | Context window |
| `L2` | Full | Deep analysis |

---

## Testing

```bash
pytest tests/test_tools/ -xvs
```

Test each tool handler with mocked layers.
