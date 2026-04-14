# src/core

Foundation layer. All modules import from here.

## TYPES

| Symbol | Location | Role |
|--------|----------|------|
| MaterialURI | types.ts:10 | mem:// URI structure |
| Scope | types.ts:49 | User/Agent/Team isolation |
| EntityType | types.ts:60 | Entity union |
| FactType | types.ts:73 | Fact categorization |
| TieredContent | types.ts:113 | L0/L1 content wrapper |

## URI

- `buildURI()` - constructs mem:// URI
- `parseURI()` - extracts MaterialURI
- `URI_FORMAT` - regex pattern

## SCOPE

- `createScope(userId, agentId?, teamId?)` - factory
- `validateScope()` - validates required fields

## CONSTANTS

```typescript
EMBED_DIMENSION = 1024    // bge-m3
L0_TOKEN_BUDGET = 100
L1_TOKEN_BUDGET = 2000
BASE_THRESHOLD = 0.7      // entity tree
DEPTH_FACTOR = 0.1
STORAGE_DIR = ~/.agents_mem/
```

## ANTI-PATTERNS

- **No public index.ts**: No root export barrel