# AGENTS.md — sqlite/

**Role**: Database layer - connection, migrations, schema
**Layer**: Infrastructure
**Dependencies**: core/

---

## Module Overview

SQLite storage layer with:
- Async connection management (aiosqlite)
- Database migrations
- 13 table schema definitions

### Files

| File | Purpose | Key Classes/Vars |
|------|---------|------------------|
| `connection.py` | Async DB connection | `DatabaseConnection` |
| `migrations.py` | Schema migrations | `run_migrations()` |
| `schema.py` | Table definitions | `TABLE_NAMES`, schema strings |

---

## 13 Database Tables

| Table | Layer | Purpose |
|-------|-------|---------|
| `users` | L0 | User accounts |
| `agents` | L0 | Agent registrations |
| `teams` | L0 | Team definitions |
| `team_members` | L0 | Team membership |
| `memory_index` | L1 | FTS5 metadata index |
| `documents` | L2 | Document content |
| `assets` | L2 | Binary asset storage |
| `tiered_content` | L2 | Pre-computed tiered views |
| `conversations` | L2 | Chat sessions |
| `messages` | L2 | Individual messages |
| `facts` | L3 | Extracted facts |
| `extraction_status` | L3 | Fact extraction tracking |
| `memory_access_log` | Audit | Access logging |

---

## Schema Conventions

- **Snake case**: `user_id`, `created_at`
- **Unix seconds**: Integer timestamps
- **Scope hash**: First 16 chars of SHA256
- **Foreign keys**: Enforced with cascading deletes

---

## Connection API

```python
from agents_mem.sqlite.connection import DatabaseConnection

# Initialize
db = DatabaseConnection(db_path="~/.agents_mem/agents_mem.db")

# Connect
await db.connect()

# Execute
await db.execute(
    "INSERT INTO documents (id, user_id, content) VALUES (?, ?, ?)",
    (doc_id, user_id, content)
)

# Fetch
row = await db.fetch_one(
    "SELECT * FROM documents WHERE id = ?",
    (doc_id,)
)
rows = await db.fetch_all(
    "SELECT * FROM documents WHERE user_id = ?",
    (user_id,)
)

# Close
await db.close()
```

---

## Migrations

Migrations run automatically on startup:

```python
from agents_mem.sqlite.migrations import run_migrations

await run_migrations(db_connection)
```

Current schema version: **2**

---

## Testing

```bash
pytest tests/test_sqlite/ -xvs
```

Tests use in-memory SQLite (`:memory:`) for isolation.
