# AGENTS.md

## OVERVIEW

MCP interface layer exposing 4 unified CRUD tools for 6 resource types. Acts as dispatcher to sqlite, lance, materials, facts, and embedder modules.

## WHERE TO LOOK

| Tool | Handler | File | Role |
|------|---------|------|------|
| `mem_create` | handleMemCreate | crud_handlers.ts:62 | Create all 6 resource types |
| `mem_read` | handleMemRead | crud_handlers.ts:191 | Read, search, list, tier, trace |
| `mem_update` | handleMemUpdate | crud_handlers.ts:432 | Update with scope validation |
| `mem_delete` | handleMemDelete | crud_handlers.ts:553 | Delete with cascade handling + LanceDB vector sync |

## CONVENTIONS

Validation patterns used across handlers:

- `validateResource(resource)` → checks: document|asset|conversation|message|fact|team
- `validRoles` → ['user','assistant','system','tool']
- `validSourceTypes` → ['documents','messages','conversations']
- `validTiers` → ['L0','L1','L2']
- `validModes` → ['hybrid','fts','semantic','progressive']

Scope enforcement: userId required for most operations. Scope mismatch throws error.

## VECTOR SYNC ON DELETE

When deleting resources, LanceDB vectors are also cleaned up:

| Resource | SQLite Delete | LanceDB Vector Delete | Error Handling |
|----------|--------------|----------------------|----------------|
| document | `deleteDocument(id)` | `await deleteDocumentVector(id)` | Log error, don't block |
| asset | `deleteAsset(id)` | `await deleteAssetVector(id)` | Log error, don't block |
| message | `deleteMessage(id)` | `await deleteMessageVector(id)` | Log error, don't block |
| fact | `deleteFact(id)` | `await deleteFactVector(id)` | Log error, don't block |
| conversation | `deleteConversation(id)` | N/A (no vector table) | - |
| team | `deleteTeam(id)` | N/A (no vector table) | - |

**Design decision**: Vector deletion failures are logged but don't block the main delete flow. This ensures users can always delete resources even if LanceDB is temporarily unavailable.

## API REFERENCE

### 4 MCP Tools

| Tool | Parameters | Returns |
|------|------------|---------|
| `mem_create` | resource, data, scope? | Created resource |
| `mem_read` | resource, query, scope? | Resource(s) or search results |
| `mem_update` | resource, id, data, scope? | Updated resource |
| `mem_delete` | resource, id, scope? | {success, id} |

### 6 Resource Types

| Resource | Create Required | Query Modes |
|----------|-----------------|-------------|
| document | userId, title, content | id, search, list, tier |
| asset | userId, filename, fileType, fileSize, storagePath | id, list |
| conversation | userId, agentId | id, list |
| message | conversationId, role, content | id, conversationId |
| fact | userId, sourceType, sourceId, content | id (+trace), filters |
| team | name, ownerId | id (+members), list |

### Search Modes (mem_read document)

- `hybrid` → FTS + vector + RRF reranking
- `fts` → Full-text search only
- `semantic` → Vector similarity only
- `progressive` → L0 tier with fallback