# src/lance

Vector storage layer with hybrid search (vector + FTS + RRF).

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Connection | connection.ts | Async singleton, LanceConnection |
| Schema defs | schema.ts | Arrow schemas, EMBED_DIMENSION=768 |
| Vector tables | documents_vec.ts, messages_vec.ts, facts_vec.ts, tiered_vec.ts | Per-resource tables |
| Hybrid search | hybrid_search.ts | RRF reranking of vector+FTS |
| FTS only | fts_search.ts | Keyword search fallback |
| Vector only | semantic_search.ts | Pure vector similarity |

## CONVENTIONS

- **Async-first**: All LanceDB ops are async (unlike SQLite sync)
- **Arrow schemas**: Use `Schema`, `Field`, `FixedSizeList`, `Float32` from apache-arrow
- **768 dims**: EMBED_DIMENSION imported from core/constants
- **Table naming**: `{resource}_vec` (documents_vec, messages_vec, facts_vec, tiered_vec)

## NOTES

- Uses `@lancedb/lancedb` + `apache-arrow`
- Hybrid search = vector + FTS with RRF reranking