# AGENTS.md — core/

**Role**: Core types and shared infrastructure for agents-mem
**Layer**: Foundation (used by L0-L3)

---

## Module Overview

This module contains the foundational types, URI system, constants, and exceptions used across all layers.

### Files

| File | Purpose | Key Classes |
|------|---------|-------------|
| `types.py` | Pydantic models | `Scope`, `Content`, `Fact`, `Entity`, `SearchResult` |
| `uri.py` | URI parsing/building | `URISystem`, `MaterialURI` |
| `constants.py` | Project constants | `DEFAULT_EMBEDDING_MODEL`, `MAX_RETRIES` |
| `exceptions.py` | Custom exceptions | `MemoryError`, `ScopeError`, `NotFoundError` |

---

## Critical Constraints

### Scope Model

```python
from pydantic import BaseModel

class Scope(BaseModel):
    user_id: str              # Required - user isolation
    agent_id: str | None = None   # Optional - agent isolation
    team_id: str | None = None    # Optional - team isolation
```

**Rule**: `user_id` is mandatory. All queries auto-filter by scope.

### URI Format

```
mem://{user_id}/{agent_id}/{team_id}/{entity_type}/{entity_id}
```

Example: `mem://user123/agent1/_/documents/doc-456`

Use `URISystem.build_target_uri()` for consistency.

---

## Enums

| Enum | Values | Usage |
|------|--------|-------|
| `EntityType` | documents, assets, conversations, messages, facts | Resource type |
| `ContentType` | article, note, url, file, conversation | Content categorization |
| `FactType` | preference, decision, observation, conclusion | Fact classification |
| `SearchMode` | fts, semantic, hybrid, progressive | Search strategy |
| `TierLevel` | L0, L1, L2 | Token budget tier |

---

## Code Style

- Always use Pydantic v2 models with `Field(..., description="...")`
- Use `from __future__ import annotations` for forward references
- Prefer `str | None` over `Optional[str]`
- Unix seconds (int) for timestamps

---

## Testing

Run core-specific tests:

```bash
pytest tests/test_core/ -xvs
```

**Coverage requirement**: 100%
