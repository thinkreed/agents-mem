# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-14T03:00:00  
**Branch:** fix/openviking-integration

## OVERVIEW

Six-layer progressive disclosure memory system for 169+ agents. TypeScript/Bun runtime with SQLite + OpenViking HTTP storage. Token cost optimization via tiered content loading (L0→L1→L2).

## STRUCTURE

```
src/
├── core/        # Types, URI, Scope, Constants
├── sqlite/      # 15 tables, CRUD, migrations
├── openviking/  # HTTP client, URI adapter, scope mapper
├── queue/       # Background job queue (async embedding)
├── tools/       # MCP CRUD handlers
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
| SQLite CRUD | `src/sqlite/{entity}.ts` | create/get/update/delete/search |
| Vector search | `src/openviking/http_client.ts` | OpenViking HTTP API |
| URI conversion | `src/openviking/uri_adapter.ts` | mem:// ↔ viking:// |
| Scope mapping | `src/openviking/scope_mapper.ts` | OpenViking scope filter |
| MCP tool | `src/tools/crud_handlers.ts` | 4 unified tools |
| Tiered content | `src/tiered/generator.ts` | L0/L1 generation |
| Fact extraction | `src/facts/extractor.ts` | Ollama-based |
| Background queue | `src/queue/embedding_queue.ts` | Async embedding jobs |
| LogBuffer | `src/utils/log_buffer.ts` | Async log buffer |
| Document storage | `src/materials/store.ts` | Queues embedding jobs |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| Scope | interface | core/types.ts | User/Agent/Team isolation |
| EntityType | type | core/types.ts | Entity union |
| MaterialURI | interface | core/types.ts | mem:// URI structure |
| handleMemCreate | function | tools/crud_handlers.ts | MCP create dispatcher |
| handleMemRead | function | tools/crud_handlers.ts | MCP read dispatcher |
| OpenVikingHTTPClient | class | openviking/http_client.ts | HTTP SDK |
| URIAdapter | class | openviking/uri_adapter.ts | URI conversion |
| ScopeMapper | class | openviking/scope_mapper.ts | Scope filter builder |
| ScopeFilter | class | core/scope.ts | SQL filter builder |
| EmbeddingQueue | class | queue/embedding_queue.ts | Async job queue |
| QueueJob | interface | queue/types.ts | Job definition |
| QueueStats | interface | queue/types.ts | Queue statistics |
| LogBuffer | class | utils/log_buffer.ts | Async log buffer |
| AuditLogger | class | utils/audit_logger.ts | Audit trail |

## CONVENTIONS

- **Bun runtime**: TypeScript runs directly via Bun, no Node.js
- **Snake_case in SQLite**: `user_id`, `created_at`
- **Unix timestamps**: `Math.floor(Date.now() / 1000)` (seconds)
- **Scope required**: `userId` mandatory, `agentId/teamId` optional
- **Embedding dim**: 1024 (bge-m3 via OpenViking)
- **Token budgets**: L0=100, L1=2000
- **OpenViking HTTP**: localhost:1933, POST /api/v1/search/find
- **Async queue**: Background jobs for embedding (maxRetries=3)
- **Job retries**: maxRetries=3, retryDelay=100ms

## ERROR MESSAGES

| Error Type | Message Format |
|------------|----------------|
| userId missing | `"userId is required for {resource}. Provide scope: { userId: \"...\" }"` |
| query missing | `"query is required for mem_read. Valid formats: { id }, { search }, { list }, { filters }"` |
| Invalid query | `"Invalid query for {resource}. Valid keys: {keys}"` |

Valid keys per resource:
- document: `id, search, list, tier`
- asset: `id, list`
- conversation: `id, list`
- message: `id, conversationId`
- fact: `id, filters`
- team: `id, list, filters`

## ANTI-PATTERNS

- **Logger integrated**: `src/utils/logger.ts` with async buffering
- **No public index.ts**: Package has no root export barrel

## UNIQUE STYLES

- **Layered schema comments**: L0-L5 markers in `sqlite/schema.ts`
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

- **No CI/CD**: Docker-based testing locally
- **MCP stdio**: Server runs as subprocess, not HTTP
- **Ollama required**: Embeddings need localhost:11434
- **OpenViking required**: Vector search needs localhost:1933
- **Storage**: `~/.agents_mem/` (SQLite for metadata)

## TROUBLESHOOTING

### OpenViking Connection Issues

**Symptom:** Search returns connection errors  
**Causes:** OpenViking server not running (localhost:1933), API key mismatch, network issues  
**Fixes:** Start OpenViking server, verify API key, check connectivity

### Search Returns Empty Results

**Symptom:** Document stored but search returns `[]`  
**Causes:** OpenViking not yet processed (async), Ollama unavailable, **URI path mismatch**  
**Fixes:** Wait and retry, verify Ollama (`curl http://localhost:11434/api/tags`), check scope matches

**URI Path Alignment (Fixed 2026-04-14):**
- Storage: `uriAdapter.buildTargetUri(scope, 'documents')` → `viking://default/userId/agentId/resources/documents`
- Search: Same path now - uses `uriAdapter.buildTargetUri(scope, 'documents')` for all search modes
- Both storage and search use `resources/documents` path for proper vector matching

### Chinese Search Issues

**Symptom:** Chinese queries return no results  
**Solution:** Use `searchMode: 'hybrid'` - OpenViking embeddings support Chinese semantically