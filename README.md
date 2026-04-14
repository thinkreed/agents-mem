# agents-mem

Six-layer progressive disclosure memory system for 169+ agents. Saves 80-91% token costs through tiered content loading.

面向 169+ Agents 的六层渐进式记忆系统，节省 80-91% Token 成本。

## What is Progressive Disclosure?

Instead of loading full context, the system progressively reveals detail:

```
L0 Summary (~100 tokens) → L1 Overview (~2k) → L2 Full Content → Facts → Agentic Search
```

This keeps initial responses fast and cheap while allowing deep dives when needed.

## Quick Start

### 1. Prerequisites

| Service | URL | Purpose |
|---------|-----|---------|
| [Ollama](https://ollama.com) | localhost:11434 | Embeddings (bge-m3, 1024-dim) |
| [OpenViking](https://github.com/thinkreed/openviking) | localhost:1933 | Vector search & semantic retrieval |
| SQLite | auto | Primary data storage (~/.agents_mem/) |

### 2. Install & Run

```bash
bun install
bun test
bun run src/mcp_server.ts
```

### 3. Use MCP Tools

Four tools available via MCP protocol:

```typescript
// Create a document
mem_create({
  resource: "document",
  data: { content: "Meeting notes: ..." },
  scope: { userId: "user123", agentId: "agent1" }
})

// Search with hybrid mode (FTS + vector + Chinese support)
mem_read({
  resource: "document",
  query: { search: "项目进度", searchMode: "hybrid" },
  scope: { userId: "user123" }
})

// Read with tiered loading (L0/L1/L2)
mem_read({
  resource: "document",
  query: { id: "doc-123", tier: "L0" },
  scope: { userId: "user123" }
})
```

**Resources:** `document`, `asset`, `conversation`, `message`, `fact`, `team`

**Scope:** `{ userId (required), agentId?, teamId? }`

## Architecture

```
┌─────────────────────────────────────────────┐
│  L5: Facts & Entity Tree (traceability)     │
│  L4: OpenViking Semantic Search             │
│  L3: Tiered Content (L0/L1/L2 summaries)    │
│  L2: Documents & Assets (raw content)       │
│  L1: Index & Metadata (mem:// URI)          │
│  L0: Scope & Identity (user/agent/team)     │
├─────────────────────────────────────────────┤
│  Storage: SQLite (primary) + OpenViking (vector) │
└─────────────────────────────────────────────┘
```

Full design details: [DESIGN.md](DESIGN.md)

## Project Structure

```
src/
├── core/           # URI scheme, scope types, constants
├── sqlite/         # 15 tables, CRUD, migrations
├── openviking/     # HTTP client, URI adapter, scope mapper
├── embedder/       # Ollama client (bge-m3) + cache
├── queue/          # Async embedding queue
├── tiered/         # L0/L1 content generation
├── facts/          # Fact extraction, verification, linking
├── entity_tree/    # Entity aggregation & threshold tree
├── materials/      # URI resolution, tracing, storage
├── llm/            # LLM prompts & streaming
├── utils/          # Logging, audit, shutdown
└── tools/          # 4 MCP CRUD tools
```

## Documentation

| Document | Purpose |
|----------|---------|
| [DESIGN.md](DESIGN.md) | Full architecture, algorithms, API specs |
| [AGENTS.md](AGENTS.md) | Developer guide, conventions, troubleshooting |
| [SPEC.md](SPEC.md) | Task specifications & requirements |

## Tech Stack

- **Runtime:** Bun 1.x | **Language:** TypeScript (strict)
- **Storage:** SQLite (better-sqlite3) | **Vector Search:** OpenViking HTTP
- **Embeddings:** Ollama (bge-m3, 1024-dim) | **Testing:** Vitest (100% coverage)

## License

MIT
