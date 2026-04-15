# AGENTS.md — openviking/

**Role**: OpenViking HTTP client for vector search
**Layer**: External integration
**Dependencies**: core/

---

## Module Overview

HTTP client for OpenViking vector search service:
- Vector storage and retrieval
- Scope-aware search
- URI adapter for mem:// format

### Files

| File | Purpose | Key Classes |
|------|---------|-------------|
| `client.py` | HTTP client | `OpenVikingClient`, `OpenVikingConfig` |
| `scope_mapper.py` | Scope → OpenViking format | `ScopeMapper` |
| `uri_adapter.py` | URI conversion | `URIAdapter` |

---

## OpenViking Service

**Address**: `http://localhost:1933` (configurable)

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/search` | POST | Vector similarity search |
| `/upsert` | POST | Store vectors |
| `/delete` | POST | Remove vectors |

---

## Client API

```python
from agents_mem.openviking.client import OpenVikingClient, OpenVikingConfig

# Configure
config = OpenVikingConfig(
    base_url="http://localhost:1933",
    api_key="optional-api-key"
)

# Initialize
client = OpenVikingClient(config)

# Health check
health = await client.health()

# Search
results = await client.search(
    query_vector=[0.1, 0.2, ...],  # Embedding from Ollama
    scope_hash="abc123...",         # From IdentityLayer
    top_k=10
)

# Store vector
await client.upsert(
    uri="mem://user/_/documents/doc-456",
    vector=[0.1, 0.2, ...],
    metadata={"title": "My Doc"}
)
```

---

## Scope Mapping

OpenViking uses scope hash for multi-tenant isolation:

```python
from agents_mem.openviking.scope_mapper import ScopeMapper

# Convert Scope → OpenViking filter
scope_filter = ScopeMapper.to_filter(scope)
# Returns: {"scope_hash": "abc123..."}
```

---

## URI Adapter

Converts between mem:// URIs and OpenViking IDs:

```python
from agents_mem.openviking.uri_adapter import URIAdapter

# mem:// → OpenViking ID
ov_id = URIAdapter.to_openviking_id("mem://user/_/documents/doc-456")
# Returns: "user____documents_doc-456"

# OpenViking ID → mem://
uri = URIAdapter.to_mem_uri("user____documents_doc-456")
# Returns: "mem://user/_/documents/doc-456"
```

---

## Dependencies

| Service | Address | Purpose |
|---------|---------|---------|
| OpenViking | localhost:1933 | Vector search |
| Ollama | localhost:11434 | Embedding (bge-m3) |

---

## Testing

```bash
pytest tests/test_openviking/ -xvs
```

Mock OpenViking responses for unit tests.
