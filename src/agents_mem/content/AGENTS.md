# AGENTS.md — content/

**Role**: L2 Content Layer implementation ⭐ Core Value
**Layer**: L2
**Dependencies**: core/, identity/, index/

---

## Module Overview

L2 is the **core value layer**. It manages:
- Raw content storage (Documents, Assets, Conversations, Messages)
- **Tiered views** - Progressive disclosure (L0/L1/L2)
- CRUD operations with scope validation
- Search integration

### Files

| File | Purpose | Key Classes |
|------|---------|-------------|
| `layer.py` | Main L2 class | `ContentLayer` |
| `capabilities/tiered.py` | Tiered views | `TieredViewCapability` |
| `resources/document.py` | Document CRUD | `DocumentRepository` |
| `resources/conversation.py` | Conversation CRUD | `ConversationRepository` |

---

## Tiered View System

Progressive content disclosure based on token budget:

| Tier | Tokens | Content | Use Case |
|------|--------|---------|----------|
| **L0** | ~100 | Summary, metadata | Quick overview |
| **L1** | ~2000 | Chunked summary | Context understanding |
| **L2** | Full | Original content | Deep analysis |

### How It Works

```python
# Get L0 summary (~100 tokens)
content = await content_layer.get(uri, tier=TierLevel.L0)

# Get L1 overview (~2000 tokens)
content = await content_layer.get(uri, tier=TierLevel.L1)

# Get full content (unlimited)
content = await content_layer.get(uri, tier=TierLevel.L2)
```

---

## ContentLayer API

```python
# Initialize
content = ContentLayer(identity_layer, index_layer)

# Create
doc = await content.create_document(
    data=DocumentCreateInput(content="...", title="..."),
    scope=scope
)

# Read (with tier)
doc = await content.get_document(uri, tier=TierLevel.L1)

# Update
doc = await content.update_document(uri, data={"title": "New"})

# Delete
success = await content.delete_document(uri)

# Search
results = await content.search(
    query="semantic search",
    scope=scope,
    mode=SearchMode.HYBRID,
    tier=TierLevel.L1  # Return L1 summaries
)
```

---

## Resource Types

- **documents**: Articles, notes, files
- **assets**: Binary data (images, PDFs)
- **conversations**: Chat sessions
- **messages**: Individual chat messages

---

## Testing

```bash
pytest tests/test_content/ -xvs
```

Test tiered views, CRUD operations, and search integration.
