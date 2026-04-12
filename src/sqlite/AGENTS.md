# AGENTS.md

## OVERVIEW

SQLite relational layer with 14 tables, CRUD operations, and migration management using bun:sqlite.

## STRUCTURE

| Table | Entity | File |
|-------|--------|------|
| users | User | users.ts |
| agents | Agent | agents.ts |
| teams | Team | teams.ts |
| team_members | TeamMember | team_members.ts |
| memory_index | MemoryIndex | memory_index.ts |
| documents | Document | documents.ts |
| assets | Asset | assets.ts |
| tiered_content | TieredContent | tiered_content.ts |
| conversations | Conversation | conversations.ts |
| messages | Message | messages.ts |
| facts | Fact | facts.ts |
| entity_nodes | EntityNode | entity_nodes.ts |
| extraction_status | ExtractionStatus | extraction_status.ts |
| memory_access_log | AccessLog | access_log.ts |

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Schema definitions | schema.ts | L0-L5 layer comments |
| Run migrations | migrations.ts:runMigrations | MigrationManager class |
| Connection | connection.ts | Singleton getDb() |
| CRUD for entity | {entity}.ts | Each has create/get/update/delete/search |

## CONVENTIONS

- **Snake_case columns**: `user_id`, `created_at`, `updated_at`
- **Unix seconds**: `strftime('%s', 'now')` not milliseconds
- **Each entity file**: Input/Output/Record interfaces + 6 CRUD functions
- **Text columns**: JSON strings for arrays/objects

## ANTI-PATTERNS

- **No transactions**: Individual writes not wrapped in transactions
- **No indexes on foreign keys**: Performance risk at scale
- **No cascading deletes**: Manual cleanup required
- **access_log.ts unused**: Table created but not wired to writes