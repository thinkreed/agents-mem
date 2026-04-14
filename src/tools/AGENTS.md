# src/tools

MCP interface layer exposing 4 unified CRUD tools for 6 resource types.

## HANDLERS

| Tool | Handler | Role |
|------|---------|------|
| `mem_create` | handleMemCreate | Create all 6 resources |
| `mem_read` | handleMemRead | Read, search, list, tier, trace |
| `mem_update` | handleMemUpdate | Update with scope validation |
| `mem_delete` | handleMemDelete | Delete with cascade |

## CONVENTIONS

- `validateResource()` → document|asset|conversation|message|fact|team
- `validRoles` → user|assistant|system|tool
- `validSourceTypes` → documents|messages|conversations
- `validTiers` → L0|L1|L2
- `validModes` → hybrid|fts|semantic|progressive

## API REFERENCE

| Tool | Parameters | Returns |
|------|------------|---------|
| `mem_create` | resource, data, scope? | Created resource |
| `mem_read` | resource, query, scope? | Resource(s) or search results |
| `mem_update` | resource, id, data, scope? | Updated resource |
| `mem_delete` | resource, id, scope? | {success, id} |

## SEARCH MODES

- `hybrid` → OpenViking hybrid search
- `fts` → Full-text search
- `semantic` → Vector similarity
- `progressive` → L0 tier with fallback