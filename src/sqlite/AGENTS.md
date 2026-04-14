# src/sqlite

SQLite 关系层，14 张表，CRUD 操作和迁移管理 (bun:sqlite)。

## 表结构

| 表名 | 实体 | 文件 |
|------|------|------|
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

## 关键文件

- **schema.ts** - 表定义 (L0-L5 层注释)
- **migrations.ts** - 迁移管理 (MigrationManager)
- **connection.ts** - 单例 getDb()

## 约定

- **蛇形列名**: `user_id`, `created_at`, `updated_at`
- **Unix 秒**: `strftime('%s', 'now')` (非毫秒)
- **每个实体文件**: Input/Output/Record 接口 + 6 个 CRUD 函数
- **文本列**: JSON 字符串存储数组/对象

## 已知问题

- 无事务包装 (单个写入操作)
- 外键无索引 (大规模性能风险)
- 无级联删除 (需手动清理)
- access_log.ts 未连接到写入
