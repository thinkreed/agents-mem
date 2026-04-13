# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-12T10:30:00
**Commit:** 6104fab
**Branch:** main

## OVERVIEW

Six-layer progressive disclosure memory system for 169+ agents. TypeScript/Bun runtime with dual SQLite+LanceDB storage. Token cost optimization via tiered content loading (L0→L1→L2).

## STRUCTURE

```
src/
├── core/        # Types, URI, Scope, Constants (foundation)
├── sqlite/      # 15 tables, CRUD, migrations (relational)
├── lance/       # Vector ops, hybrid search (semantic)
├── queue/       # NEW: Background job queue (async embedding)
├── tools/       # MCP CRUD handlers (API layer)
├── tiered/      # L0/L1 content generation
├── facts/       # Extraction, linking, verification
├── entity_tree/ # Aggregation, threshold-based tree
├── embedder/    # Ollama client + cache
├── llm/         # LLM prompts, streaming
├── materials/   # URI resolver, trace, store
└── mcp_server.ts # Entry point (MCP stdio)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add entity type | `src/core/types.ts` | EntityType union |
| SQLite CRUD | `src/sqlite/{entity}.ts` | Pattern: create/get/update/delete/search |
| Vector search | `src/lance/hybrid_search.ts` | RRF: vector + FTS |
| FTS only search | `src/lance/fts_search.ts` | BM25 scoring |
| Assets vector | `src/lance/assets_vec.ts` | Asset embeddings CRUD |
| MCP tool | `src/tools/crud_handlers.ts` | 4 unified tools |
| URI parsing | `src/core/uri.ts` | mem:// scheme |
| Scope filtering | `src/core/scope.ts` | SQL + LanceDB filters |
| Tiered content | `src/tiered/generator.ts` | L0/L1 generation |
| Fact extraction | `src/facts/extractor.ts` | Ollama-based |
| Fact verification | `src/facts/verifier.ts` | Cross-check with sources |
| Fact linking | `src/facts/linker.ts` | Deduplication |
| **Background queue** | `src/queue/embedding_queue.ts` | NEW: Async embedding jobs |
| **Queue converters** | `src/queue/converters.ts` | NEW: Type conversions |
| **Queue jobs CRUD** | `src/sqlite/queue_jobs.ts` | NEW: Job persistence |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| Scope | interface | core/types.ts:49 | User/Agent/Team isolation |
| EntityType | type | core/types.ts:60 | Entity union |
| MaterialURI | interface | core/types.ts:10 | mem:// URI structure |
| handleMemCreate | function | tools/crud_handlers.ts:62 | MCP create dispatcher |
| handleMemRead | function | tools/crud_handlers.ts:191 | MCP read dispatcher |
| hybridSearchDocuments | function | lance/hybrid_search.ts | Vector + FTS + RRF |
| ScopeFilter | class | core/scope.ts:141 | SQL/Lance filter builder |
| runMigrations | function | sqlite/migrations.ts | Schema init |
| createDocumentsVecSchema | function | lance/schema.ts:59 | Arrow schema |
| **EmbeddingQueue** | class | queue/embedding_queue.ts | NEW: Async job queue |
| **getEmbeddingQueue** | function | queue/index.ts | NEW: Singleton queue |
| **QueueJob** | interface | queue/types.ts | NEW: Job definition |
| **recordToJob** | function | queue/converters.ts | NEW: Type converter (DB → TS) |
| **jobToRecord** | function | queue/converters.ts | NEW: Type converter (TS → DB) |

## CONVENTIONS

- **Bun runtime**: No Node.js. Uses `bun:sqlite`, `bun test`
- **No build step**: TypeScript runs directly via Bun
- **Snake_case in SQLite**: Records use `user_id`, `created_at`
- **Unix timestamps**: `Math.floor(Date.now() / 1000)` (seconds)
- **Scope required**: `userId` mandatory, `agentId/teamId` optional
- **Embedding dim**: 768 (nomic-embed-text)
- **Token budgets**: L0=100, L1=2000
- **Async queue**: Background jobs for embedding/FTS index (maxRetries=3)

## ERROR MESSAGES

Validation errors include usage hints to guide LLM callers:

| Error Type | Message Format |
|------------|----------------|
| userId missing | `"userId is required for {resource}. Provide scope: { userId: \"...\" }"` |
| query missing | `"query is required for mem_read. Valid formats: { id }, { search }, { list }, { filters }"` |
| Invalid query | `"Invalid query for {resource}. Valid keys: {keys}"` |

Example valid keys per resource:
- document: `id, search, list, tier`
- asset: `id, list`
- conversation: `id, list`
- message: `id, conversationId`
- fact: `id, filters`
- team: `id, list, filters`

## ANTI-PATTERNS (THIS PROJECT)

- **No logger usage**: `src/utils/logger.ts` defined but unused
- **No public index.ts**: Package has no root export barrel

## UNIQUE STYLES

- **Layered schema comments**: L0-L5 markers in `sqlite/schema.ts`
- **Dynamic imports in tests**: `await import(...)` for isolation
- **4-tool MCP interface**: Unified CRUD for 6 resource types
- **Threshold formula**: θ(d) = θ₀ × e^(λd) for entity tree depth

## COMMANDS

```bash
bun install          # Dependencies
bun test             # All tests (Vitest)
bun run typecheck    # TypeScript check
bun run src/mcp_server.ts  # Start MCP server
docker-compose run agents-mem-test bun test tests/lance  # LanceDB tests
```

## NOTES

- **No CI/CD**: No GitHub Actions; Docker-based testing locally
- **MCP stdio**: Server runs as subprocess, not HTTP
- **Ollama required**: Embeddings need localhost:11434
- **Storage**: `~/.agents_mem/` (SQLite + LanceDB vectors)