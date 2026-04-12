# agents-mem 执行计划 v1.0

**版本**: 1.0
**日期**: 2026-04-12
**状态**: 待执行
**开发模式**: TDD (100% 测试覆盖，所有测试必须通过)

---

## 📊 进度追踪表（实时更新）

**更新规则**: 每完成一个任务，立即更新此表状态。

| Task ID | 任务 | 状态 | 完成时间 | 完成者 | 备注 |
|---------|------|------|----------|--------|------|
| **Wave 1** | | | | | |
| W1-T1 | core/types.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 168 tests pass |
| W1-T2 | core/constants.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W1-T3 | core/uri.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W1-T4 | core/scope.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W1-T5 | utils/uuid.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W1-T6 | utils/token_estimate.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W1-T7 | utils/logger.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W1-T8 | utils/file.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| **Wave 2** | | | | | |
| W2-T1 | sqlite/schema.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 354 tests pass |
| W2-T2 | sqlite/connection.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T3 | sqlite/migrations.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T4 | sqlite/users.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T5 | sqlite/agents.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T6 | sqlite/teams.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T7 | sqlite/team_members.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T8 | sqlite/memory_index.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T9 | sqlite/documents.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T10 | sqlite/assets.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T11 | sqlite/tiered_content.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T12 | sqlite/conversations.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T13 | sqlite/messages.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T14 | sqlite/facts.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T15 | sqlite/entity_nodes.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T16 | sqlite/extraction_status.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W2-T17 | sqlite/access_log.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| **Wave 3** | | | | | |
| W3-T1 | lance/schema.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| W3-T2 | lance/connection.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| W3-T3 | lance/documents_vec.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| W3-T4 | lance/messages_vec.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| W3-T5 | lance/facts_vec.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| W3-T6 | lance/tiered_vec.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| W3-T7 | lance/index.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| W3-T8 | lance/hybrid_search.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| W3-T9 | lance/semantic_search.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| W3-T10 | lance/fts_search.ts | ✅ 已完成 | 2026-04-12 | Agent-A | Windows需文件路径 |
| **Wave 4** | | | | | |
| W4-T1 | embedder/ollama.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 383 tests pass |
| W4-T2 | embedder/cache.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W4-T3 | embedder/batch.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| **Wave 5** | | | | | |
| W5-T1 | tiered/config.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W5-T2 | tiered/generator.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W5-T3 | tiered/queue.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| **Wave 6** | | | | | |
| W6-T1 | materials/uri_resolver.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W6-T2 | materials/store.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W6-T3 | materials/filesystem.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W6-T4 | materials/trace.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| **Wave 7** | | | | | |
| W7-T1 | facts/extractor.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W7-T2 | facts/verifier.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W7-T3 | facts/linker.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| **Wave 8** | | | | | |
| W8-T1 | entity_tree/threshold.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W8-T2 | entity_tree/aggregator.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W8-T3 | entity_tree/builder.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W8-T4 | entity_tree/search.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| **Wave 9** | | | | | |
| W9-T1 | tools/definitions.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W9-T2 | tools/handlers.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| W9-T3 | tools/registry.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |
| **Wave 10** | | | | | |
| W10-T1 | server.ts | ✅ 已完成 | 2026-04-12 | Agent-A | 测试通过 |

**状态图标说明**:
- ⏳ 待开始 - 任务未开始
- 🔄 进行中 - 任务正在执行
- ✅ 已完成 - 任务完成，测试通过
- ❌ 失败 - 任务失败，需要修复
- ⏸️ 阻塞 - 依赖任务未完成

**统计**:
- 总任务数: 51
- 已完成: 51
- 进行中: 0
- 待开始: 0

---

## 执行原则

### TDD 流程（强制）

```
1. 编写测试文件（测试必须 FAIL）
2. 编写最小实现代码
3. 运行测试（测试必须 PASS）
4. 代码审查 + 优化
5. 确保测试仍然 PASS
```

### 质量标准

- ✅ 100% 测试覆盖率
- ✅ 所有测试必须通过
- ✅ TypeScript strict mode，无 any
- ✅ 每个模块独立可测试

---

## 任务分解

### Wave 1: 核心基础层（可并行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W1-T1 | core/types.ts | 无 | ✅ | tests/core/types.test.ts | src/core/types.ts |
| W1-T2 | core/constants.ts | 无 | ✅ | tests/core/constants.test.ts | src/core/constants.ts |
| W1-T3 | core/uri.ts | W1-T1 | ✅ | tests/core/uri.test.ts | src/core/uri.ts |
| W1-T4 | core/scope.ts | W1-T1 | ✅ | tests/core/scope.test.ts | src/core/scope.ts |
| W1-T5 | utils/uuid.ts | 无 | ✅ | tests/utils/uuid.test.ts | src/utils/uuid.ts |
| W1-T6 | utils/token_estimate.ts | 无 | ✅ | tests/utils/token_estimate.test.ts | src/utils/token_estimate.ts |
| W1-T7 | utils/logger.ts | 无 | ✅ | tests/utils/logger.test.ts | src/utils/logger.ts |
| W1-T8 | utils/file.ts | 无 | ✅ | tests/utils/file.test.ts | src/utils/file.ts |

**并行说明**: W1-T1/W1-T2/W1-T5/W1-T6/W1-T7/W1-T8 可同时开始，W1-T3/W1-T4 依赖 W1-T1 完成后可并行。

---

### Wave 2: SQLite 层（部分可并行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W2-T1 | sqlite/schema.ts | W1-T1 | ❌ (基准) | tests/sqlite/schema.test.ts | src/sqlite/schema.ts |
| W2-T2 | sqlite/connection.ts | W2-T1 | ✅ | tests/sqlite/connection.test.ts | src/sqlite/connection.ts |
| W2-T3 | sqlite/migrations.ts | W2-T1, W2-T2 | ❌ | tests/sqlite/migrations.test.ts | src/sqlite/migrations.ts |
| W2-T4 | sqlite/users.ts | W2-T3 | ✅ | tests/sqlite/users.test.ts | src/sqlite/users.ts |
| W2-T5 | sqlite/agents.ts | W2-T3, W2-T4 | ✅ | tests/sqlite/agents.test.ts | src/sqlite/agents.ts |
| W2-T6 | sqlite/teams.ts | W2-T3 | ✅ | tests/sqlite/teams.test.ts | src/sqlite/teams.ts |
| W2-T7 | sqlite/team_members.ts | W2-T3, W2-T6 | ✅ | tests/sqlite/team_members.test.ts | src/sqlite/team_members.ts |
| W2-T8 | sqlite/memory_index.ts | W2-T3, W1-T3 | ✅ | tests/sqlite/memory_index.test.ts | src/sqlite/memory_index.ts |
| W2-T9 | sqlite/documents.ts | W2-T3 | ✅ | tests/sqlite/documents.test.ts | src/sqlite/documents.ts |
| W2-T10 | sqlite/assets.ts | W2-T3 | ✅ | tests/sqlite/assets.test.ts | src/sqlite/assets.ts |
| W2-T11 | sqlite/tiered_content.ts | W2-T3 | ✅ | tests/sqlite/tiered_content.test.ts | src/sqlite/tiered_content.ts |
| W2-T12 | sqlite/conversations.ts | W2-T3 | ✅ | tests/sqlite/conversations.test.ts | src/sqlite/conversations.ts |
| W2-T13 | sqlite/messages.ts | W2-T3, W2-T12 | ✅ | tests/sqlite/messages.test.ts | src/sqlite/messages.ts |
| W2-T14 | sqlite/facts.ts | W2-T3 | ✅ | tests/sqlite/facts.test.ts | src/sqlite/facts.ts |
| W2-T15 | sqlite/entity_nodes.ts | W2-T3 | ✅ | tests/sqlite/entity_nodes.test.ts | src/sqlite/entity_nodes.ts |
| W2-T16 | sqlite/extraction_status.ts | W2-T3 | ✅ | tests/sqlite/extraction_status.test.ts | src/sqlite/extraction_status.ts |
| W2-T17 | sqlite/access_log.ts | W2-T3 | ✅ | tests/sqlite/access_log.test.ts | src/sqlite/access_log.ts |

**并行说明**: 
- W2-T1 必须先完成（Schema 定义）
- W2-T2 完成后 W2-T3 执行（Migration 依赖 Connection）
- W2-T3 完成后，W2-T4 ~ W2-T17 可**并行执行**（无交叉依赖）

---

### Wave 3: LanceDB 层（部分可并行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W3-T1 | lance/schema.ts | W1-T1 | ❌ (基准) | tests/lance/schema.test.ts | src/lance/schema.ts |
| W3-T2 | lance/connection.ts | W3-T1 | ❌ | tests/lance/connection.test.ts | src/lance/connection.ts |
| W3-T3 | lance/documents_vec.ts | W3-T2 | ✅ | tests/lance/documents_vec.test.ts | src/lance/documents_vec.ts |
| W3-T4 | lance/messages_vec.ts | W3-T2 | ✅ | tests/lance/messages_vec.test.ts | src/lance/messages_vec.ts |
| W3-T5 | lance/facts_vec.ts | W3-T2 | ✅ | tests/lance/facts_vec.test.ts | src/lance/facts_vec.ts |
| W3-T6 | lance/tiered_vec.ts | W3-T2 | ✅ | tests/lance/tiered_vec.test.ts | src/lance/tiered_vec.ts |
| W3-T7 | lance/index.ts | W3-T3~T6 | ❌ | tests/lance/index.test.ts | src/lance/index.ts |
| W3-T8 | lance/hybrid_search.ts | W3-T7 | ❌ | tests/lance/hybrid_search.test.ts | src/lance/hybrid_search.ts |
| W3-T9 | lance/semantic_search.ts | W3-T7 | ✅ | tests/lance/semantic_search.test.ts | src/lance/semantic_search.ts |
| W3-T10 | lance/fts_search.ts | W3-T7 | ✅ | tests/lance/fts_search.test.ts | src/lance/fts_search.ts |

**并行说明**:
- W3-T1 必须先完成（Schema 定义）
- W3-T2 完成后 W3-T3~T6 可并行
- W3-T7 依赖 W3-T3~T6 完成（索引创建）
- W3-T8~T10 依赖 W3-T7，其中 T9/T10 可与 T8 并行

---

### Wave 4: Embedder 层（可并行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W4-T1 | embedder/ollama.ts | 无 | ✅ | tests/embedder/ollama.test.ts | src/embedder/ollama.ts |
| W4-T2 | embedder/cache.ts | W4-T1 | ✅ | tests/embedder/cache.test.ts | src/embedder/cache.ts |
| W4-T3 | embedder/batch.ts | W4-T1 | ✅ | tests/embedder/batch.test.ts | src/embedder/batch.ts |

**并行说明**: W4-T1 先完成，W4-T2/W4-T3 可并行。

---

### Wave 5: Tiered 层（串行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W5-T1 | tiered/config.ts | W1-T6 | ❌ | tests/tiered/config.test.ts | src/tiered/config.ts |
| W5-T2 | tiered/generator.ts | W4-T1, W5-T1 | ❌ | tests/tiered/generator.test.ts | src/tiered/generator.ts |
| W5-T3 | tiered/queue.ts | W5-T2 | ❌ | tests/tiered/queue.test.ts | src/tiered/queue.ts |

**并行说明**: 串行依赖链。

---

### Wave 6: Materials 层（部分可并行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W6-T1 | materials/uri_resolver.ts | W1-T3, W2-T8 | ✅ | tests/materials/uri_resolver.test.ts | src/materials/uri_resolver.ts |
| W6-T2 | materials/store.ts | W2-T9, W2-T10, W3-T3 | ❌ | tests/materials/store.test.ts | src/materials/store.ts |
| W6-T3 | materials/filesystem.ts | W6-T2 | ✅ | tests/materials/filesystem.test.ts | src/materials/filesystem.ts |
| W6-T4 | materials/trace.ts | W2-T14, W2-T11 | ✅ | tests/materials/trace.test.ts | src/materials/trace.ts |

**并行说明**: W6-T2 依赖最多，需等待后执行。T1/T4 可并行。

---

### Wave 7: Facts 层（部分可并行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W7-T1 | facts/extractor.ts | W4-T1, W2-T14 | ❌ | tests/facts/extractor.test.ts | src/facts/extractor.ts |
| W7-T2 | facts/verifier.ts | W7-T1 | ✅ | tests/facts/verifier.test.ts | src/facts/verifier.ts |
| W7-T3 | facts/linker.ts | W7-T1, W2-T15 | ✅ | tests/facts/linker.test.ts | src/facts/linker.ts |

**并行说明**: W7-T1 先完成，T2/T3 可并行。

---

### Wave 8: Entity Tree 层（串行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W8-T1 | entity_tree/threshold.ts | W1-T1 | ❌ | tests/entity_tree/threshold.test.ts | src/entity_tree/threshold.ts |
| W8-T2 | entity_tree/aggregator.ts | W4-T1, W8-T1 | ❌ | tests/entity_tree/aggregator.test.ts | src/entity_tree/aggregator.ts |
| W8-T3 | entity_tree/builder.ts | W8-T1, W8-T2, W2-T15 | ❌ | tests/entity_tree/builder.test.ts | src/entity_tree/builder.ts |
| W8-T4 | entity_tree/search.ts | W8-T3, W3-T5 | ❌ | tests/entity_tree/search.test.ts | src/entity_tree/search.ts |

**并行说明**: 串行依赖链。

---

### Wave 9: Tools 层（部分可并行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W9-T1 | tools/definitions.ts | W1-T1 | ❌ | tests/tools/definitions.test.ts | src/tools/definitions.ts |
| W9-T2 | tools/handlers.ts | **全部 Wave 1-8** | ❌ | tests/tools/handlers.test.ts | src/tools/handlers.ts |
| W9-T3 | tools/registry.ts | W9-T1 | ✅ | tests/tools/registry.test.ts | src/tools/registry.ts |

**并行说明**: W9-T2 依赖全部基础模块完成。

---

### Wave 10: Server 入口（串行）

| Task ID | 任务 | 依赖 | 可并行 | 测试文件 | 实现文件 |
|---------|------|------|--------|----------|----------|
| W10-T1 | server.ts | W9-T2, W9-T3 | ❌ | tests/server.test.ts | src/server.ts |

---

## 并行执行矩阵

### 可完全并行（无依赖）

```
Wave 1 完全并行组:
┌─────────────────────────────────────┐
│ W1-T1  W1-T2  W1-T5  W1-T6  W1-T7  W1-T8 │  (6 个任务可同时开始)
└─────────────────────────────────────┘

Wave 2 后期并行组 (Migration 完成后):
┌─────────────────────────────────────┐
│ W2-T4  W2-T5  W2-T6  W2-T7  W2-T8  │
│ W2-T9  W2-T10 W2-T11 W2-T12 W2-T13 │
│ W2-T14 W2-T15 W2-T16 W2-T17        │  (14 个任务可同时开始)
└─────────────────────────────────────┘

Wave 3 表操作并行组 (Connection 完成后):
┌─────────────────────────────────────┐
│ W3-T3  W3-T4  W3-T5  W3-T6          │  (4 个任务可同时开始)
└─────────────────────────────────────┘

Wave 3 搜索并行组 (Index 完成后):
┌─────────────────────────────────────┐
│ W3-T8  W3-T9  W3-T10                │  (hybrid/semantic/fts 可同时开始)
└─────────────────────────────────────┘

Wave 4 并行组:
┌─────────────────────────────────────┐
│ W4-T2  W4-T3                        │  (cache/batch 可同时开始)
└─────────────────────────────────────┘

Wave 6/7 并行组:
┌─────────────────────────────────────┐
│ W6-T1  W6-T4                        │
│ W7-T2  W7-T3                        │
└─────────────────────────────────────┘
```

---

## SQLite Schema 完整定义

```sql
-- ============================================================================
-- agents-mem SQLite Schema v1.0
-- ============================================================================

-- Layer 0: SCOPE & IDENTITY
-- ============================================================================

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  preferences TEXT,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  capabilities TEXT,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_agents_user ON agents(user_id);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT NOT NULL,
  visibility TEXT DEFAULT 'private',
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE team_members (
  team_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  permissions TEXT,
  joined_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (team_id, agent_id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_agent ON team_members(agent_id);

-- ============================================================================
-- Layer 1: INDEX & METADATA
-- ============================================================================

CREATE TABLE memory_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  team_id TEXT,
  is_global BOOLEAN DEFAULT FALSE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT,
  entity TEXT,
  category TEXT,
  tags TEXT,
  importance REAL DEFAULT 0.5,
  path TEXT,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_memory_uri ON memory_index(uri);
CREATE INDEX idx_memory_scope ON memory_index(user_id, agent_id, team_id);
CREATE INDEX idx_memory_target ON memory_index(target_type, target_id);
CREATE INDEX idx_memory_topic ON memory_index(topic) WHERE topic IS NOT NULL;
CREATE INDEX idx_memory_entity ON memory_index(entity) WHERE entity IS NOT NULL;
CREATE INDEX idx_memory_category ON memory_index(category) WHERE category IS NOT NULL;

-- ============================================================================
-- Layer 2: DOCUMENTS & ASSETS
-- ============================================================================

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  team_id TEXT,
  is_global BOOLEAN DEFAULT FALSE,
  doc_type TEXT NOT NULL,
  source_url TEXT,
  source_path TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  lance_id TEXT,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  content_length INTEGER,
  token_count INTEGER
);
CREATE INDEX idx_documents_scope ON documents(user_id, agent_id, team_id);
CREATE INDEX idx_documents_type ON documents(doc_type);
CREATE INDEX idx_documents_lance ON documents(lance_id) WHERE lance_id IS NOT NULL;

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  team_id TEXT,
  is_global BOOLEAN DEFAULT FALSE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  source_url TEXT,
  source_path TEXT,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  title TEXT,
  description TEXT,
  metadata TEXT,
  lance_id TEXT,
  text_extracted BOOLEAN DEFAULT FALSE,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_assets_scope ON assets(user_id, agent_id, team_id);
CREATE INDEX idx_assets_type ON assets(file_type);

-- ============================================================================
-- Layer 3: TIERED CONTENT
-- ============================================================================

CREATE TABLE tiered_content (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  team_id TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  abstract TEXT NOT NULL,
  overview TEXT,
  original_uri TEXT,
  importance REAL DEFAULT 0.5,
  lance_id_l0 TEXT,
  lance_id_l1 TEXT,
  l0_generated_at REAL,
  l1_generated_at REAL,
  generation_mode TEXT,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_tiered_scope ON tiered_content(user_id, agent_id, team_id);
CREATE INDEX idx_tiered_source ON tiered_content(source_type, source_id);

-- ============================================================================
-- Layer 4: CONVERSATIONS
-- ============================================================================

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  team_id TEXT,
  title TEXT,
  source TEXT DEFAULT 'mcp',
  message_count INTEGER DEFAULT 0,
  token_count_input INTEGER DEFAULT 0,
  token_count_output INTEGER DEFAULT 0,
  started_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  ended_at REAL,
  last_message_at REAL
);
CREATE INDEX idx_conversations_scope ON conversations(user_id, agent_id, team_id);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  tool_calls TEXT,
  tool_results TEXT,
  reasoning TEXT,
  lance_id TEXT,
  tiered_id TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  timestamp REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  source_document_id TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (source_document_id) REFERENCES documents(id)
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_lance ON messages(lance_id) WHERE lance_id IS NOT NULL;

-- ============================================================================
-- Layer 5: FACTS & ENTITY TREE
-- ============================================================================

CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  team_id TEXT,
  is_global BOOLEAN DEFAULT FALSE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_uri TEXT,
  content TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  entities TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  confidence REAL DEFAULT 0.8,
  verified BOOLEAN DEFAULT FALSE,
  lance_id TEXT,
  extraction_mode TEXT,
  extracted_at REAL,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_facts_scope ON facts(user_id, agent_id, team_id);
CREATE INDEX idx_facts_source ON facts(source_type, source_id);
CREATE INDEX idx_facts_type ON facts(fact_type);
CREATE INDEX idx_facts_lance ON facts(lance_id) WHERE lance_id IS NOT NULL;

CREATE TABLE entity_nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  path TEXT,
  child_count INTEGER DEFAULT 0,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  team_id TEXT,
  is_global BOOLEAN DEFAULT FALSE,
  entity_name TEXT NOT NULL,
  aggregated_content TEXT,
  threshold REAL,
  lance_id TEXT,
  linked_fact_ids TEXT,
  created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (parent_id) REFERENCES entity_nodes(id)
);
CREATE INDEX idx_entity_parent ON entity_nodes(parent_id);
CREATE INDEX idx_entity_depth ON entity_nodes(depth);
CREATE INDEX idx_entity_scope ON entity_nodes(user_id, agent_id, team_id);

-- ============================================================================
-- AUDIT & LOGGING
-- ============================================================================

CREATE TABLE extraction_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  extraction_mode TEXT,
  facts_count INTEGER DEFAULT 0,
  entities_count INTEGER DEFAULT 0,
  started_at REAL,
  completed_at REAL,
  error_message TEXT
);
CREATE INDEX idx_extraction_target ON extraction_status(target_type, target_id);
CREATE INDEX idx_extraction_status ON extraction_status(status);

CREATE TABLE memory_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  memory_type TEXT NOT NULL,
  memory_id TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT,
  timestamp REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  success BOOLEAN NOT NULL,
  reason TEXT
);
CREATE INDEX idx_access_log_user ON memory_access_log(user_id);
CREATE INDEX idx_access_log_memory ON memory_access_log(memory_type, memory_id);
CREATE INDEX idx_access_log_time ON memory_access_log(timestamp);
```

---

## LanceDB Schema 定义

```typescript
// src/lance/schema.ts
import * as arrow from 'apache-arrow';

const EMBED_DIMENSION = 768;

// documents_vec
export const documentsVecSchema = new arrow.Schema([
  arrow.field('id', new arrow.Utf8()),
  arrow.field('content', new arrow.Utf8()),
  arrow.field('vector', new arrow.FixedSizeList(EMBED_DIMENSION, new arrow.Float32())),
  arrow.field('title', new arrow.Utf8()),
  arrow.field('user_id', new arrow.Utf8()),
  arrow.field('agent_id', new arrow.Utf8()),
  arrow.field('team_id', new arrow.Utf8()),
  arrow.field('is_global', new arrow.Bool()),
  arrow.field('topic', new arrow.Utf8()),
  arrow.field('entity', new arrow.Utf8()),
  arrow.field('category', new arrow.Utf8()),
  arrow.field('importance', new arrow.Float32()),
  arrow.field('created_at', new arrow.Timestamp('ms')),
]);

// messages_vec
export const messagesVecSchema = new arrow.Schema([
  arrow.field('id', new arrow.Utf8()),
  arrow.field('content', new arrow.Utf8()),
  arrow.field('vector', new arrow.FixedSizeList(EMBED_DIMENSION, new arrow.Float32())),
  arrow.field('user_id', new arrow.Utf8()),
  arrow.field('agent_id', new arrow.Utf8()),
  arrow.field('team_id', new arrow.Utf8()),
  arrow.field('conversation_id', new arrow.Utf8()),
  arrow.field('role', new arrow.Utf8()),
  arrow.field('timestamp', new arrow.Timestamp('ms')),
]);

// facts_vec
export const factsVecSchema = new arrow.Schema([
  arrow.field('id', new arrow.Utf8()),
  arrow.field('content', new arrow.Utf8()),
  arrow.field('vector', new arrow.FixedSizeList(EMBED_DIMENSION, new arrow.Float32())),
  arrow.field('user_id', new arrow.Utf8()),
  arrow.field('agent_id', new arrow.Utf8()),
  arrow.field('team_id', new arrow.Utf8()),
  arrow.field('is_global', new arrow.Bool()),
  arrow.field('fact_type', new arrow.Utf8()),
  arrow.field('importance', new arrow.Float32()),
  arrow.field('confidence', new arrow.Float32()),
  arrow.field('source_type', new arrow.Utf8()),
  arrow.field('source_id', new arrow.Utf8()),
]);

// tiered_vec
export const tieredVecSchema = new arrow.Schema([
  arrow.field('id', new arrow.Utf8()),
  arrow.field('content', new arrow.Utf8()),
  arrow.field('vector', new arrow.FixedSizeList(EMBED_DIMENSION, new arrow.Float32())),
  arrow.field('tier', new arrow.Int32()),
  arrow.field('user_id', new arrow.Utf8()),
  arrow.field('agent_id', new arrow.Utf8()),
  arrow.field('team_id', new arrow.Utf8()),
  arrow.field('source_type', new arrow.Utf8()),
  arrow.field('source_id', new arrow.Utf8()),
  arrow.field('original_uri', new arrow.Utf8()),
]);
```

---

## 测试文件结构

```
tests/
├── core/
│   ├── types.test.ts
│   ├── constants.test.ts
│   ├── uri.test.ts
│   └── scope.test.ts
│
├── sqlite/
│   ├── schema.test.ts
│   ├── connection.test.ts
│   ├── migrations.test.ts
│   ├── users.test.ts
│   ├── agents.test.ts
│   ├── teams.test.ts
│   ├── team_members.test.ts
│   ├── memory_index.test.ts
│   ├── documents.test.ts
│   ├── assets.test.ts
│   ├── tiered_content.test.ts
│   ├── conversations.test.ts
│   ├── messages.test.ts
│   ├── facts.test.ts
│   ├── entity_nodes.test.ts
│   ├── extraction_status.test.ts
│   └── access_log.test.ts
│
├── lance/
│   ├── schema.test.ts
│   ├── connection.test.ts
│   ├── documents_vec.test.ts
│   ├── messages_vec.test.ts
│   ├── facts_vec.test.ts
│   ├── tiered_vec.test.ts
│   ├── index.test.ts
│   ├── hybrid_search.test.ts
│   ├── semantic_search.test.ts
│   └ fts_search.test.ts
│
├── embedder/
│   ├── ollama.test.ts
│   ├── cache.test.ts
│   └ batch.test.ts
│
├── tiered/
│   ├── config.test.ts
│   ├── generator.test.ts
│   └ queue.test.ts
│
├── materials/
│   ├── uri_resolver.test.ts
│   ├── store.test.ts
│   ├── filesystem.test.ts
│   └ trace.test.ts
│
├── facts/
│   ├── extractor.test.ts
│   ├── verifier.test.ts
│   ├── linker.test.ts
│
├── entity_tree/
│   ├── threshold.test.ts
│   ├── aggregator.test.ts
│   ├── builder.test.ts
│   └ search.test.ts
│
├── tools/
│   ├── definitions.test.ts
│   ├── handlers.test.ts
│   ├── registry.test.ts
│
├── utils/
│   ├── uuid.test.ts
│   ├── token_estimate.test.ts
│   ├── logger.test.ts
│   ├── file.test.ts
│
└── server.test.ts
```

---

## 执行顺序建议

### 单 Agent 执行顺序

```
Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5 → Wave 6 → Wave 7 → Wave 8 → Wave 9 → Wave 10
```

### 多 Agent 并行执行建议

```
Agent A: Wave 1 (core/types, constants) + Wave 2 前期 (schema, connection)
Agent B: Wave 1 (utils/*) + Wave 2 后期 (users, agents, teams...)
Agent C: Wave 3 (lance/*) + Wave 4 (embedder/*)
Agent D: Wave 5 (tiered/*) + Wave 6 (materials/*)
Agent E: Wave 7 (facts/*) + Wave 8 (entity_tree/*)
Agent F: Wave 9 (tools/*) + Wave 10 (server)
```

---

## 验证检查点

### Wave 完成标准

每个 Wave 完成后必须满足：
- ✅ 所有测试 PASS
- ✅ 测试覆盖率 100%
- ✅ TypeScript strict 无错误
- ✅ 无 ESLint 错误

### 全项目完成标准

- ✅ `bun run test` 全部 PASS
- ✅ `bun run typecheck` 无错误
- ✅ 测试覆盖率 100%
- ✅ MCP server 可启动
- ✅ 所有工具定义完整

---

**执行计划结束**