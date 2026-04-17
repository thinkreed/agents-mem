# AGENTS.md — agents-mem-py

**Role**: Python developer for 4-layer agent memory system  
**Stack**: Python 3.11+ / FastMCP / SQLite / Ollama  
**Constraint**: 100% test coverage | L0-L3 architecture

---

## Agent Role

You are an expert Python developer working on a **4-layer progressive memory system** for AI agents. Priorities:

1. **Token efficiency**: L0 (~100 tokens) → L1 (~2000 tokens) → L2 (full)  
2. **Scope isolation**: Every operation filtered by `user_id` (required) + `agent_id/team_id` (optional)  
3. **Test coverage**: 100% required, pytest-asyncio for async code

---

## Quick Commands

```bash
# Development
pip install -e ".[dev]"          # Install with dev dependencies
python -m agents_mem              # Start MCP server
agents-mem-py                     # CLI entry point

# Testing
pytest --cov=agents_mem --cov-fail-under=100  # Run tests with coverage
pytest -xvs tests/test_content/    # Run specific test module

# Quality
pyright src/agents_mem             # Type check (strict mode)
ruff check src/agents_mem          # Lint check
```

---

## Architecture (L0-L3)

```
┌────────────────────────────────────────────────────────┐
│  L3: Knowledge Layer                                   │
│  ├─ Facts (fact extraction & validation)              │
│  ├─ Entities (entity aggregation & linking)           │
│  └─ Trace (knowledge provenance chains)               │
├────────────────────────────────────────────────────────┤
│  L2: Content Layer ⭐ Core Value                        │
│  ├─ Documents/Assets (raw content storage)            │
│  ├─ Tiered Views (L0/L1/L2 built-in capability)       │
│  └─ Conversations/Messages (conversation content)     │
├────────────────────────────────────────────────────────┤
│  L1: Index Layer                                       │
│  ├─ URI System (mem:// addressing)                    │
│  ├─ Metadata Index (metadata search)                  │
│  └─ Vector Search (semantic search - built-in)        │
├────────────────────────────────────────────────────────┤
│  L0: Identity Layer                                    │
│  ├─ Scope (user_id/agent_id/team_id)                  │
│  └─ Access Control (permission validation)            │
└────────────────────────────────────────────────────────┘
```

**Dependency rule**: L3 → L2 → L1 → L0 (inner layers don't depend on outer)

---

## Directory Map

```
src/agents_mem/
├── core/              # Pydantic models, URI system, constants, exceptions
├── identity/          # L0: Scope validation, access control
├── index/             # L1: Metadata index, vector search capability
├── content/           # L2: Document storage, tiered view capability
├── knowledge/         # L3: Fact extraction, entity tree, trace
├── export/            # Markdown export with Jinja2 templates
├── sqlite/            # Database connection, migrations, 13 tables
├── embedder/           # Ollama embedding client
├── llm/               # LLM client integration
├── tools/             # MCP tool handlers (create/read/update/delete/export)
├── mcp_server.py      # FastMCP server entry
└── __main__.py        # CLI entry point

tests/                 # Test suite (100% coverage target)
├── test_core/         # Core type tests
├── test_identity/     # L0 tests
├── test_index/        # L1 tests
├── test_content/      # L2 tests
├── test_knowledge/    # L3 tests
├── test_export/       # Export tests
└── test_tools/        # MCP tool tests
```

---

## Critical Constraints

| Constraint | Value | Notes |
|------------|-------|-------|
| **Scope** | `user_id` required, others optional | All queries auto-filtered |
| **Naming** | snake_case for SQLite/JSON fields | `user_id`, `created_at` |
| **Timestamp** | Unix seconds (int) | Not milliseconds |
| **Token budget** | L0≈100, L1≈2000 | Hard limits for tiered views |
| **Retry** | maxRetries=3, retryDelay=100ms | Exponential backoff |
| **Coverage** | 100% | pytest-cov fail-under=100 |

---

## MCP Tools

| Tool | Action | Resource Types |
|------|--------|----------------|
| `mem_create` | Create resource | document, asset, conversation, message, fact, team |
| `mem_read` | Read/Search/List/Tiered view | Same as above |
| `mem_update` | Update (scope validated) | Same as above |
| `mem_delete` | Delete (cascade) | Same as above |
| `mem_export` | Export Markdown | content, knowledge |

**Search modes**: `hybrid` (default, Chinese-friendly) | `fts` | `semantic` | `progressive`  
**Tiers**: `tier=L0` (~100t) | `tier=L1` (~2000t) | `tier=L2` (full)

See → `docs/agents-mem-py-QUICKSTART-v2.md` for detailed API

---

## What to Read Before Modifying

| If you're working on... | Read first |
|-------------------------|------------|
| L0 Identity | `src/agents_mem/identity/layer.py` |
| L1 Index | `src/agents_mem/index/layer.py` + `capabilities/vector_search.py` |
| L2 Content | `src/agents_mem/content/layer.py` + `capabilities/tiered.py` |
| L3 Knowledge | `src/agents_mem/knowledge/layer.py` |
| MCP Tools | `src/agents_mem/tools/handlers/` + `mcp_server.py` |
| Database | `src/agents_mem/sqlite/schema.py` (13 tables) |
| URI System | `src/agents_mem/core/uri.py` |

---

## Code Style

```python
# Naming
snake_case_for_functions_and_variables
PascalCaseForClassesAndModels
UPPER_SNAKE_CASE_FOR_CONSTANTS

# Type hints (required)
from typing import Optional

def search(
    scope: Scope,
    query: str,
    limit: int = 10
) -> list[SearchResult]:
    ...

# Pydantic models
from pydantic import BaseModel, Field

class Document(BaseModel):
    id: str
    user_id: str = Field(..., description="Required scope field")
    content: str
    created_at: int  # Unix seconds

# Error handling
class MemoryError(Exception):
    """Base exception for memory operations."""
    pass

# Never suppress type errors with `Any` unless absolutely necessary
```

---

## Documentation Map

```
docs/
├── agents-mem-py-DESIGN-v2.md      # Architecture design (read this first)
├── agents-mem-py-EXPORT-v2.md      # Export system design
├── agents-mem-py-QUICKSTART-v2.md  # API usage guide
├── QUALITY_SCORE.md                # Quality metrics
├── RELIABILITY.md                  # Reliability guidelines
├── SECURITY.md                     # Security specifications
├── GOLDEN_RULES.md                 # Engineering principles
├── FRONTEND.md                     # MCP interface spec
└── design-docs/index.md            # Design doc registry
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Ollama connection fail | Start service on `localhost:11434`, verify `OLLAMA_HOST` |
| Search returns empty | Wait for async processing, check Ollama on `localhost:11434`, verify scope match |
| Chinese search no results | Use `search_mode: 'hybrid'` |
| URI path mismatch | Always use `URISystem.build_target_uri()` for consistency |
| Type check fails | Run `pyright src/agents_mem`, fix all strict errors |
| Test coverage < 100% | Add tests for uncovered lines, check `htmlcov/index.html` |

---

## External Services

| Service | Address | Purpose | Check |
|---------|---------|---------|-------|
| Ollama | `localhost:11434` | Embedding (bge-m3) + LLM | `curl http://localhost:11434/api/tags` |
| SQLite | `~/.agents_mem/` | Primary + Vector storage | Auto-created on first run |

---

**End of Document** — For detailed architecture, see `docs/agents-mem-py-DESIGN-v2.md`
