# src/core

Foundation layer. All other modules import from here.

## OVERVIEW

TypeScript types, mem:// URI parsing, scope filtering, and constants. No runtime logic.

## TYPES

| Symbol | Location | Role |
|--------|----------|------|
| MaterialURI | types.ts:10 | mem:// URI structure |
| Scope | types.ts:49 | User/Agent/Team isolation |
| EntityType | types.ts:60 | Entity union (Document, Asset, Conversation, Message, Fact, Team) |
| FactType | types.ts:66 | Fact categorization |
| Fact | types.ts:70 | Extracted fact with source/target |
| TieredContent | types.ts:80 | L0/L1 content wrapper |
| HybridSearchResult | types.ts:90 | Vector + FTS combined result |

## URI

mem:// scheme parser and builder.

- `buildURI(resource, id, scope)` - constructs URI string
- `parseURI(uri: string)` - extracts MaterialURI object
- `validateURI(uri: string)` - boolean validation
- `URI_FORMAT` - regex pattern at uri.ts:8

## SCOPE

ScopeFilter class exists (scope.ts:141) but is NOT wired to queries.

- `createScope(userId, agentId?, teamId?)` - Scope factory
- `validateScope(scope)` - validates required fields
- `scopeToString(scope)` - serialization

## CONSTANTS

```typescript
EMBED_DIMENSION = 768           // nomic-embed-text
L0_TOKEN_BUDGET = 100           // minimal summary
L1_TOKEN_BUDGET = 2000          // full content
BASE_THRESHOLD = 0.5            // entity tree base
DEPTH_FACTOR = 0.1              // exponential growth
calculateThreshold(depth)       // θ(d) = 0.5 × e^(0.1d)
STORAGE_DIR = ~/.agents_mem/    // SQLite + LanceDB
```

## ANTI-PATTERNS

- **ScopeFilter unused**: Class at scope.ts:141 exists but never imported by query modules
- **No public index.ts**: Package has no root export barrel