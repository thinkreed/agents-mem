# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-14T03:00:00
**Commit:** Latest
**Branch:** fix/openviking-integration

## OVERVIEW

Six-layer progressive disclosure memory system for 169+ agents. TypeScript/Bun runtime with SQLite + OpenViking HTTP storage. Token cost optimization via tiered content loading (L0→L1→L2).

## STRUCTURE

```
src/
├── core/        # Types, URI, Scope, Constants (foundation)
├── sqlite/      # 15 tables, CRUD, migrations (relational)
├── openviking/  # HTTP client, URI adapter, scope mapper (semantic)
├── queue/       # Background job queue (async embedding)
├── tools/       # MCP CRUD handlers (API layer)
├── tiered/      # L0/L1 content generation
├── facts/       # Extraction, linking, verification
├── entity_tree/ # Aggregation, threshold-based tree
├── embedder/    # Ollama client + cache
├── llm/         # LLM prompts, streaming
├── materials/   # URI resolver, trace, store
├── utils/       # Logger, LogBuffer, AuditLogger, Shutdown
└── mcp_server.ts # Entry point (MCP stdio)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add entity type | `src/core/types.ts` | EntityType union |
| SQLite CRUD | `src/sqlite/{entity}.ts` | Pattern: create/get/update/delete/search |
| Vector search | `src/openviking/http_client.ts` | OpenViking HTTP API |
| URI conversion | `src/openviking/uri_adapter.ts` | mem:// ↔ viking:// |
| Scope mapping | `src/openviking/scope_mapper.ts` | OpenViking scope filter |
| MCP tool | `src/tools/crud_handlers.ts` | 4 unified tools |
| URI parsing | `src/core/uri.ts` | mem:// scheme |
| Scope filtering | `src/core/scope.ts` | SQL + OpenViking filters |
| Tiered content | `src/tiered/generator.ts` | L0/L1 generation |
| Fact extraction | `src/facts/extractor.ts` | Ollama-based |
| Fact verification | `src/facts/verifier.ts` | Cross-check with sources |
| Fact linking | `src/facts/linker.ts` | Deduplication |
| Background queue | `src/queue/embedding_queue.ts` | Async embedding jobs |
| Queue jobs CRUD | `src/sqlite/queue_jobs.ts` | Job persistence |
| LogBuffer | `src/utils/log_buffer.ts` | Async log queue |
| AuditLogger | `src/utils/audit_logger.ts` | CRUD audit trail |
| Logger config | `src/utils/config.ts` | Env var parser |
| Shutdown | `src/utils/shutdown.ts` | Graceful handlers |
| Document storage | `src/materials/store.ts` | Queues embedding jobs |
| Mock fetch helper | `tests/utils/mock_fetch.ts` | Bun compatible mock |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| Scope | interface | core/types.ts:49 | User/Agent/Team isolation |
| EntityType | type | core/types.ts:60 | Entity union |
| MaterialURI | interface | core/types.ts:10 | mem:// URI structure |
| handleMemCreate | function | tools/crud_handlers.ts:62 | MCP create dispatcher |
| handleMemRead | function | tools/crud_handlers.ts:191 | MCP read dispatcher |
| OpenVikingHTTPClient | class | openviking/http_client.ts:20 | HTTP SDK |
| getOpenVikingClient | function | openviking/http_client.ts | Singleton client |
| URIAdapter | class | openviking/uri_adapter.ts | URI conversion |
| getURIAdapter | function | openviking/uri_adapter.ts | Singleton adapter |
| ScopeMapper | class | openviking/scope_mapper.ts | Scope filter builder |
| ScopeFilter | class | core/scope.ts:141 | SQL filter builder |
| runMigrations | function | sqlite/migrations.ts | Schema init |
| EmbeddingQueue | class | queue/embedding_queue.ts | Async job queue |
| getEmbeddingQueue | function | queue/index.ts | Singleton queue |
| QueueJob | interface | queue/types.ts | Job definition |
| QueueStats | interface | queue/types.ts:120 | Queue statistics |
| getStats | method | queue/embedding_queue.ts | Get queue stats |
| processAll | method | queue/embedding_queue.ts | Process all jobs |
| LogBuffer | class | utils/log_buffer.ts | Async log buffer |
| AuditLogger | class | utils/audit_logger.ts | Audit trail |
| mockFetchSuccess | function | tests/utils/mock_fetch.ts | Test helper |

## CONVENTIONS

- **Bun runtime**: No Node.js. Uses `bun:sqlite`, `bun test`
- **No build step**: TypeScript runs directly via Bun
- **Snake_case in SQLite**: Records use `user_id`, `created_at`
- **Unix timestamps**: `Math.floor(Date.now() / 1000)` (seconds)
- **Scope required**: `userId` mandatory, `agentId/teamId` optional
- **Embedding dim**: 1024 (bge-m3 via OpenViking)
- **Token budgets**: L0=100, L1=2000
- **OpenViking HTTP**: localhost:1933, POST /api/v1/search/find
- **Async queue**: Background jobs for embedding (maxRetries=3)
- **Log buffer**: Async queue 1000, flush 5s, audit sampling rate 1.0
- **Job retries**: maxRetries=3, retryDelay=100ms
- **Mock helper**: Use tests/utils/mock_fetch.ts for Bun compatibility

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

- **Logger now integrated**: `src/utils/logger.ts` fully used with async buffering
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
```

## NOTES

- **No CI/CD**: No GitHub Actions; Docker-based testing locally
- **MCP stdio**: Server runs as subprocess, not HTTP
- **Ollama required**: Embeddings need localhost:11434
- **OpenViking required**: Vector search needs localhost:1933
- **Storage**: `~/.agents_mem/` (SQLite for metadata)

## Troubleshooting

### OpenViking Connection Issues

**Symptom:** Search returns connection errors

**Causes:**
1. OpenViking server not running (localhost:1933)
2. API key mismatch
3. Network connectivity issues

**Fixes:**
1. Start OpenViking server
2. Verify API key in configuration
3. Check network connectivity

### Search Returns Empty Results

**Symptom:** Document stored successfully, but search returns `[]`

**Causes:**
1. OpenViking not yet processed document (async delay)
2. Embedding service unavailable (Ollama not running)
3. Scope mismatch (searching with different userId)

**Fixes:**
1. Wait and retry (OpenViking async processing)
2. Verify Ollama: `curl http://localhost:11434/api/tags`
3. Check scope matches document scope: `{ userId: '...' }`

### Chinese Search Issues

**Symptom:** Chinese queries return no results or poor results

**Solution:** Use `searchMode: 'hybrid'` - OpenViking embeddings support Chinese semantically