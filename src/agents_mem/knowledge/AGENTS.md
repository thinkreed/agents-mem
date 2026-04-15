# AGENTS.md — knowledge/

**Role**: L3 Knowledge Layer implementation
**Layer**: L3 (Top)
**Dependencies**: core/, content/ (read-only)

---

## Module Overview

L3 extracts and manages knowledge from L2 content:
- **Fact extraction**: Pull facts from documents/conversations
- **Entity aggregation**: Build entity relationship networks
- **Knowledge trace**: Full provenance chain (Fact → Source → Content)

**Key Constraint**: L3 is **read-only** on L2. Never modify original content.

### Files

| File | Purpose | Key Classes |
|------|---------|-------------|
| `layer.py` | Main L3 class | `KnowledgeLayer` |
| `facts.py` | Fact extraction | `FactExtractor`, `FactRecord` |
| `entities.py` | Entity networks | `EntityTree`, `EntityAggregator` |
| `trace.py` | Provenance chains | `TraceBuilder`, `TraceChain` |

---

## Fact Extraction

```python
# Extract facts from content
facts = await knowledge_layer.extract_facts(
    content_uri="mem://user/_/documents/doc-123",
    fact_types=[FactType.PREFERENCE, FactType.DECISION]
)

# Each fact links back to source
fact.source_uri  # → Original document
fact.confidence  # 0.0 - 1.0
```

---

## Entity Aggregation

Build entity trees with dynamic thresholds:

```python
# Threshold formula: θ(d) = θ₀ × e^(λd)
# θ(0) = 0.70 (root)
# θ(1) = 0.77 (level 1)
# θ(2) = 0.85 (level 2)

entities = await knowledge_layer.aggregate_entities(scope)
```

---

## Knowledge Trace

Full provenance from fact to original content:

```python
# Build trace chain
trace = await knowledge_layer.build_trace(fact_id="fact-456")

# trace.chain: Fact → Extraction → Document → User
```

---

## KnowledgeLayer API

```python
# Initialize (read-only access to L2)
knowledge = KnowledgeLayer(content_layer)

# Extract facts
facts = await knowledge.extract_facts(uri, scope)

# Search facts
facts = await knowledge.search_facts(
    query="user preferences",
    scope=scope
)

# Build entity tree
entities = await knowledge.build_entity_tree(scope)

# Build trace chain
trace = await knowledge.build_trace(fact_id)
```

---

## Testing

```bash
pytest tests/test_knowledge/ -xvs
```

Test fact extraction, entity aggregation, and trace building.
