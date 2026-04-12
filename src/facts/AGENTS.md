# src/facts

Fact extraction, verification, and linking layer.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Fact extraction | extractor.ts | LLM-based fact extraction |
| Fact verification | verifier.ts | Cross-check with source documents |
| Fact linking | linker.ts | Deduplication by user_id + entity_name |

## CONVENTIONS

- **Verification**: Cross-checks facts with source documents, recalculates confidence
- **Linking**: Deduplicates entities by user_id + entity_name
- **Source types**: documents, messages, conversations

## NOTES

- All fact operations require userId scope
- Facts are immutable after creation (content cannot be modified)
- Trace functionality links facts back to original documents via tiered_content