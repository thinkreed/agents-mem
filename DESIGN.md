# agents-mem 设计文档 v1.0

**版本**: 1.1
**日期**: 2026-04-12
**状态**: 实施完成，4 CRUD 工具已上线

---

## 一、项目概述

### 1.1 定位

agents-mem 是面向 **169+ agents** 的**六层渐进式披露记忆系统**，核心目标是 **Token 成本节省**。

### 1.2 核心设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **向量数据库** | LanceDB | TypeScript SDK + Bun 兼容 + 原生混合搜索 |
| **混合搜索** | LanceDB FTS + 向量 + RRF Reranker | 内置 Tantivy BM25 + 向量融合 |
| **多 Agent Scope** | 应用层实现 (user_id/agent_id/team_id) | LanceDB scope 字段 + SQLite 过滤 |
| **分层加载** | L0/L1/L2 三层 | 借鉴 OpenViking，Token 节省 80-91% |
| **文件系统范式** | `mem://` URI | 借鉴 OpenViking viking:// |
| **事实追溯** | facts → tiered → documents/assets | 原子事实完整语境 + 可追溯 |

### 1.3 设计参数

| 参数 | 值 | 说明 |
|------|-----|------|
| Embedding 维度 | 768 | nomic-embed-text |
| L0 Token 预算 | ~50-100 | 一句话摘要，快速定位 |
| L1 Token 预算 | ~500-2000 | 结构化概述，理解上下文 |
| θ₀ 基础阈值 | 0.7 | 实体树自适应阈值 |
| λ 深度因子 | 0.1 | θ(d) = θ₀ × e^(λd) |
| 数据存储路径 | `~/.agents_mem/` | SQLite + LanceDB |
| LanceDB 路径 | `~/.agents_mem/vectors/` | 向量存储 |

---

## 二、架构设计

### 2.1 六层架构全景图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    agents-mem 六层渐进式披露架构                               │
│                    (LanceDB + 借鉴 OpenViking)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   存储层: SQLite (主数据) + LanceDB (向量 + FTS + 混合搜索)                  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │ Layer 0: SCOPE & IDENTITY                                            │ │
│   │ SQLite: users, agents, teams, team_members                           │ │
│   │ 作用域: user_id + agent_id + team_id + is_global                     │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │ Layer 1: INDEX & METADATA (mem:// URI)                              │ │
│   │ SQLite: memory_index                                                │ │
│   │ URI: mem://{userId}/{agentId?}/{teamId?}/{type}/{id}               │ │
│   │ 元数据过滤: topic/entity/category/tags/importance                   │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │ Layer 2: DOCUMENTS & ASSETS                                         │ │
│   │ SQLite: documents, assets (原始素材完整保留)                        │ │
│   │ LanceDB: documents_vec, assets_vec                                  │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │ Layer 3: TIERED CONTENT (L0/L1/L2)                                  │ │
│   │ SQLite: tiered_content                                              │ │
│   │ LanceDB: tiered_vec (L0/L1 向量)                                    │ │
│   │ L0: ~50-100 tokens | L1: ~500-2000 tokens | L2: 完整               │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │ Layer 4: VECTOR + HYBRID SEARCH                                     │ │
│   │ LanceDB: documents_vec, messages_vec, facts_vec, tiered_vec        │ │
│   │ 搜索: FTS + 向量 + RRF Reranker                                     │ │
│   │ Scope 过滤: user_id/agent_id/team_id                               │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │ Layer 5: FACTS & ENTITY TREE                                        │ │
│   │ SQLite: facts, entity_nodes                                         │ │
│   │ LanceDB: facts_vec                                                  │ │
│   │ 追溯: fact → tiered → documents/assets                             │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│   ═══════════════════════════════════════════════════════════════════════│
│                                                                             │
│   渐进式披露流程:                                                            │
│   Level 1: 元数据定位 (SQLite memory_index)     ~50 tokens  1-5ms        │
│   Level 2: L0 概览 (LanceDB tiered_vec L0)      ~100 tokens 10-50ms      │
│   Level 3: L1 概要 (LanceDB tiered_vec L1)      ~2k tokens  10-50ms      │
│   Level 4: L2 完整 (LanceDB documents_vec)      不限       20-100ms      │
│   Level 5: 事实追溯 (facts → documents)         ~1k tokens 20-100ms      │
│   Level 6: Agentic 推理 (多轮补检)              ~2k tokens 100-500ms     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
src/
├── core/                   # 核心抽象
│   ├── uri.ts              # URI 解析和构建 (mem://)
│   ├── scope.ts            # 作用域定义 (user_id/agent_id/team_id)
│   ├── types.ts            # 共享类型定义
│   └── constants.ts        # 常量配置
│
├── sqlite/                 # SQLite 层
│   ├── connection.ts       # DB 连接管理 (单例)
│   ├── schema.ts           # Schema SQL 定义
│   ├── migrations.ts       # Migration 执行
│   ├── users.ts            # users 表操作
│   ├── agents.ts           # agents 表操作
│   ├── teams.ts            # teams/team_members 表操作
│   ├── memory_index.ts     # memory_index 表操作
│   ├── documents.ts        # documents 表操作
│   ├── assets.ts           # assets 表操作
│   ├── tiered_content.ts   # tiered_content 表操作
│   ├── conversations.ts    # conversations/messages 表操作
│   ├── facts.ts            # facts 表操作
│   ├── entity_nodes.ts     # entity_nodes 表操作
│   └ extraction_status.ts  # extraction_status 表操作
│   └── access_log.ts       # memory_access_log 表操作
│
├── lance/                  # LanceDB 层
│   ├── connection.ts       # LanceDB 连接管理
│   ├── schema.ts           # LanceDB Schema 定义 (Arrow)
│   ├── documents_vec.ts    # documents_vec 表操作
│   ├── messages_vec.ts     # messages_vec 表操作
│   ├── facts_vec.ts        # facts_vec 表操作
│   ├── tiered_vec.ts       # tiered_vec 表操作
│   ├── hybrid_search.ts    # 混合搜索 (FTS + 向量 + RRF)
│   ├── semantic_search.ts  # 纯向量搜索
│   ├── fts_search.ts       # 纯 FTS 搜索
│   └── index.ts            # 索引创建 (FTS + 向量)
│
├── embedder/               # Embedding 层
│   ├── ollama.ts           # Ollama embedding 客户端
│   ├── cache.ts            # Embedding 缓存
│   └ batch.ts              # 批量 embedding
│
├── tiered/                 # 分层内容生成
│   ├── generator.ts        # L0/L1 生成器 (LLM)
│   ├── queue.ts            # SemanticQueue (异步处理)
│   ├── config.ts           # 分层配置 (Token 预算)
│
├── materials/              # 原始素材管理
│   ├── store.ts            # MaterialStore 实现
│   ├── uri_resolver.ts     # URI 解析器
│   ├── filesystem.ts       # 文件系统操作 (ls/tree/grep)
│   ├── trace.ts            # 追溯链实现
│
├── facts/                  # 事实提取
│   ├── extractor.ts        # 事实提取器 (LLM)
│   ├── verifier.ts         # 事实验证
│   ├── linker.ts           # 事实关联
│
├── entity_tree/            # 实体树
│   ├── builder.ts          # MemTree 构建器
│   ├── threshold.ts        # θ(d) 自适应阈值
│   ├── aggregator.ts       # 父节点聚合 (LLM)
│   ├── search.ts           # 折叠树检索
│
├── tools/                  # MCP 工具层
│   ├── crud_handlers.ts    # CRUD 处理函数 (mem_create/read/update/delete)
│   └── definitions.ts      # Zod schema 定义
│
├── mcp_server.ts           # MCP stdio 入口 (4 CRUD 工具)
│
└── utils/                  # 工具函数
    ├── uuid.ts             # UUID 生成
    ├── token_estimate.ts   # Token 估算
    ├── file.ts             # 文件操作
    └── logger.ts           # 日志

tests/                      # 测试文件 (镜像 src/)
├── core/
├── sqlite/
├── lance/
├── embedder/
├── tiered/
├── materials/
├── facts/
├── entity_tree/
└── tools/
```

---

## 三、数据模型设计

### 3.1 SQLite Schema

详见 `IMPLEMENTATION_PLAN.md` 中的完整 SQL。

### 3.2 LanceDB Schema

| 表名 | 向量维度 | FTS 列 | Scope 字段 |
|------|----------|--------|-----------|
| documents_vec | 768 | content | user_id, agent_id, team_id |
| messages_vec | 768 | content | user_id, agent_id, team_id |
| facts_vec | 768 | content | user_id, agent_id, team_id |
| tiered_vec | 768 | content | user_id, agent_id, team_id, tier |

### 3.3 URI 格式

```
mem://{userId}/{agentId?}/{teamId?}/{type}/{id}

示例:
mem://user123/agent1/_/documents/doc-456
mem://user123/_/team5/facts/fact-789
mem://user123/_/_/tiered/tiered-abc
```

---

## 四、核心算法设计

### 4.1 混合搜索 (LanceDB)

```typescript
// LanceDB 原生混合搜索
table.search(query, "hybrid")
  .vector(queryEmbedding)
  .ftsColumns("content")
  .where(scopeFilter)
  .rerank(new RRFReranker())
  .limit(10)
```

### 4.2 渐进式披露 Token 控制

```
Token 预算 < 500   → 返回 L0 (~100 tokens)
Token 预算 < 3000  → 返回 L0 + L1 (~2k tokens)
Token 预算 >= 3000 → 加载 L2 完整内容
```

### 4.3 实体树自适应阈值

```
θ(d) = θ₀ × e^(λd)

θ₀ = 0.7  (基础阈值)
λ  = 0.1  (深度因子)
d  = 0,1,2... (节点深度)

θ(0) = 0.7    (根节点)
θ(1) = 0.77   (第一层)
θ(2) = 0.85   (第二层)
θ(3) = 0.93   (第三层)

深层节点需要更高相似度才能合并，保持层次结构
```

### 4.4 事实追溯链

```
fact.source_id → tiered_content.id → tiered_content.original_uri → documents/assets

追溯查询:
SELECT f.*, tc.abstract, tc.overview, d.content
FROM facts f
JOIN tiered_content tc ON f.source_id = tc.id
JOIN documents d ON tc.source_id = d.id
WHERE f.id = ?
```

---

## 五、接口设计

### 5.1 MCP CRUD 工具 (4 Tools)

采用统一的 CRUD 接口设计，将原有 24 个专用工具简化为 4 个通用工具：

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `mem_create` | 创建资源 | `resource`, `data`, `scope` |
| `mem_read` | 读取/搜索资源 | `resource`, `query`, `scope` |
| `mem_update` | 更新资源 | `resource`, `id`, `data`, `scope` |
| `mem_delete` | 删除资源 | `resource`, `id`, `scope` |

**实现文件:**
- `src/tools/crud_handlers.ts` - 4 个 handler 函数实现
- `src/mcp_server.ts` - MCP server 入口，注册 4 个工具

**支持的资源类型 (resource):**
- `document` - 文档 (L0/L1/L2 分层)
- `asset` - 二进制素材
- `conversation` - 会话 (cascade 删除 messages)
- `message` - 消息
- `fact` - 事实 (自动提取)
- `team` - 团队 (cascade 删除 members)

**作用域 (scope):**
```typescript
{
  userId: string;      // 必填
  agentId?: string;    // 可选
  teamId?: string;     // 可选
}
```

**查询模式 (query):**

| 模式 | 参数示例 | 说明 |
|------|---------|------|
| ID 查询 | `{ id: "doc-123" }` | 按 ID 获取单个资源 |
| 搜索 | `{ search: "关键词", searchMode: "hybrid" }` | hybrid/fts/semantic/progressive |
| 分层 | `{ id: "doc-123", tier: "L0" }` | L0 摘要 / L1 概述 / L2 完整 |
| 追溯 | `{ id: "fact-123", trace: true }` | 追溯事实到源文档 |
| 列表 | `{ list: true }` | 列出所有资源 |
| 过滤 | `{ list: true, filters: { docType: "note" } }` | 按条件过滤 |

### 5.2 资源-操作映射表

| 资源 | create | read | update | delete | 特殊行为 |
|------|--------|------|--------|--------|----------|
| document | ✅ | ✅ ID/Search/Tier | ✅ 部分更新 | ✅ cascade index | tier 参数控制 L0/L1/L2 |
| asset | ✅ | ✅ ID/List | ✅ title/description | ✅ | 需要 filename/fileType/fileSize/storagePath |
| conversation | ✅ | ✅ ID/List | ✅ title | ✅ cascade messages | 删除时自动删除关联 messages |
| message | ✅ | ✅ ID/List | ✅ content | ✅ | 需要 conversationId + role |
| fact | ✅ 自动提取 | ✅ ID/Search/Trace | ✅ verified/confidence | ✅ | create 时触发 LLM 自动提取 |
| team | ✅ | ✅ ID/List/Members | ✅ name/visibility | ✅ cascade members | 删除时自动删除关联 members |

### 5.3 搜索模式详细说明

| searchMode | 描述 | 适用资源 |
|------------|------|----------|
| `hybrid` | FTS + Vector + RRF (默认) | document, fact |
| `fts` | BM25 全文搜索 | document |
| `semantic` | 纯向量搜索 | document |
| `progressive` | 渐进式披露 (L0→L1→L2) | document |

**progressive 搜索参数:**
```typescript
{
  search: "关键词",
  searchMode: "progressive",
  tokenBudget: 500,  // Token 预算
  tier: "L0"         // 起始层级
}
```

---

## 六、技术选型

| 技术 | 版本 | 用途 |
|------|------|------|
| Bun | latest | 运行时 |
| TypeScript | strict | 开发语言 |
| SQLite | better-sqlite3 | 主数据存储 |
| LanceDB | @lancedb/lancedb | 向量 + FTS |
| Apache Arrow | apache-arrow | LanceDB Schema |
| Ollama | ollama | Embedding |
| Vitest | latest | 测试框架 |
| Zod | latest | Schema 验证 |

---

## 七、质量要求

| 要求 | 标准 |
|------|------|
| 测试覆盖率 | 100% |
| 测试通过率 | 100% |
| 开发模式 | TDD (先写测试) |
| 类型检查 | strict, 无 any |
| 文档 | DESIGN.md + IMPLEMENTATION_PLAN.md |

---

## 八、参考资料

### 8.1 借鉴来源

| 来源 | 借鉴内容 |
|------|----------|
| OpenViking | L0/L1/L2 分层加载、viking:// URI、文件系统范式 |
| Membrain | 原子事实完整语境、自适应实体树 θ(d) |
| LanceDB | 混合搜索 FTS + 向量 + RRF Reranker |

### 8.2 关键文档

- LanceDB 官方文档: https://docs.lancedb.com/
- OpenViking 官方文档: https://volcengine-openviking.mintlify.app/
- nomic-embed-text: https://ollama.com/library/nomic-embed-text

---

## 九、2026-04-12 审计修复

本次审计修复了以下问题，所有功能现已完整实现:

### 9.1 混合搜索实现

| 功能 | 文件 | 状态 |
|------|------|------|
| 混合搜索 (FTS + 向量 + RRF) | `src/lance/hybrid_search.ts` | ✅ 已实现 |
| 纯 FTS 搜索 (BM25) | `src/lance/fts_search.ts` | ✅ 已实现 |
| 纯向量搜索 | `src/lance/semantic_search.ts` | ✅ 已实现 |

### 9.2 资产向量支持

| 功能 | 文件 | 状态 |
|------|------|------|
| assets_vec 表 | `src/lance/assets_vec.ts` | ✅ 已实现 |
| 完整 CRUD 操作 | | ✅ 已实现 |

### 9.3 事实验证与链接

| 功能 | 文件 | 状态 |
|------|------|------|
| Fact Verifier | `src/facts/verifier.ts` | ✅ 已实现 |
| Cross-check with source documents | | ✅ 已实现 |
| Confidence recalculation | | ✅ 已实现 |
| Entity Linker | `src/facts/linker.ts` | ✅ 已实现 |
| Deduplication by user_id + entity_name | | ✅ 已实现 |

### 9.4 作用域过滤

| 功能 | 文件 | 状态 |
|------|------|------|
| ScopeFilter | `src/core/scope.ts` | ✅ 已连线 |
| Full agent_id/team_id support | | ✅ 已实现 |
| All vector queries | | ✅ 已实现 |

### 9.5 MCP 类型修复

| 修复 | 文件 | 状态 |
|------|------|------|
| MCPToolResponse index signature | `src/core/types.ts` | ✅ 已添加 |
| AssetInput text_extracted field | `src/core/types.ts` | ✅ 已添加 |

### 9.6 搜索模式说明

```typescript
// Hybrid: FTS + Vector + RRF (default, most accurate)
mem_read({ resource: 'document', query: { search: 'query', searchMode: 'hybrid' } })

// FTS: Full-text search with BM25 scoring
mem_read({ resource: 'document', query: { search: 'query', searchMode: 'fts' } })

// Semantic: Pure vector similarity
mem_read({ resource: 'document', query: { search: 'query', searchMode: 'semantic' } })

// Progressive: L0 tier with fallback
mem_read({ resource: 'document', query: { search: 'query', searchMode: 'progressive' } })
```

---

## 十、2026-04-12 向量索引初始化修复

本次修复了 LanceDB 向量表初始化缺失问题，新增启动时初始化和搜索重建回退。

### 10.1 向量表初始化流程

LanceDB 向量表在 MCP server 启动时自动初始化：

1. SQLite migrations 完成
2. `initTables()` 创建所有 5 个向量表
3. 创建的表：documents_vec, messages_vec, facts_vec, assets_vec, tiered_vec
4. 初始化失败时 server 进入降级模式（搜索返回错误）

### 10.2 命名约定

- Schema registry 支持带 `_vec` 后缀的表名
- `getSchemaForTable('documents_vec')` 等价于 `getSchemaForTable('documents')`
- 所有向量表使用 `_vec` 后缀以区分 SQLite 表

### 10.3 重建回退

当向量表缺失或不完整时，搜索操作触发自动重建：

1. 检测表不存在 → 调用 `initTables()` 创建表结构
2. 从 SQLite 扫描该用户的所有文档
3. 通过 Ollama 生成嵌入向量
4. 将向量写入 LanceDB
5. 搜索继续执行

**重建状态检测**：
- LanceDB 向量数量 < SQLite 文档数量 → 不完整状态，触发重建

**新增文件**：
- `tests/lance/init.test.ts` - 初始化测试
- `tests/lance/schema_suffix.test.ts` - 命名测试
- `tests/lance/rebuild.test.ts` - 重建测试

**新增函数**：
- `src/lance/connection.ts`: `initTables()`, `tableExists()`
- `src/lance/hybrid_search.ts`: `checkAndRebuild()`, `rebuildTable()`

---

## 十一、2026-04-12 搜索 Bug 修复 + 异步队列系统

本次修复了搜索返回空结果的 5 个关键 Bug，并新增异步队列系统用于 embedding 生成。

### 11.1 修复的 Bug 列表

| Bug | 描述 | 修复文件 | 状态 |
|------|------|----------|------|
| Bug 1 | hybridSearchDocuments 未使用真正的 hybrid search | `src/lance/hybrid_search.ts:402-415` | ✅ 已修复 |
| Bug 2 | semantic_search scope 过滤器被覆盖 | `src/lance/semantic_search.ts:51-57` | ✅ 已修复 |
| Bug 3 | storeDocument 不生成 embedding | `src/materials/store.ts` | ✅ 已修复 |
| Bug 4 | checkAndRebuild 不处理 lanceCount=0 | `src/lance/hybrid_search.ts:275` | ✅ 已修复 |
| Bug 5 | FTS 索引从不创建 | `src/queue/embedding_queue.ts` | ✅ 已修复 |

### 11.2 Bug 修复详情

**Bug 1: hybridSearchDocuments 使用纯向量搜索**
- 原代码：调用 `searchDocumentVectors` 返回硬编码 `score=0.5`
- 修复：直接调用 `hybridSearch()` 函数，返回真实 RRF 分数

**Bug 2: semantic_search 多个 .where() 调用覆盖**
- 原代码：`query.where(userId).where(agentId).where(teamId)` - 只最后一个生效
- 修复：使用 `ScopeFilter.toLanceFilter()` 合并为单次 `.where()` 调用

**Bug 3: 文档创建时不生成向量**
- 原代码：`storeDocument` 只写入 SQLite，不写入 LanceDB
- 修复：集成异步队列，文档创建后触发 embedding job

**Bug 4: checkAndRebuild 逻辑错误**
- 原代码：`lanceCount > 0 && sqliteDocs > lanceCount` - lanceCount=0 时跳过重建
- 修复：改为 `sqliteDocs > lanceCount` - 包括 lanceCount=0 场景

### 11.3 异步队列系统架构

新增后台队列系统用于异步 embedding 生成和 FTS 索引创建：

```
storeDocument (materials/store.ts)
    ↓ 创建 SQLite 文档
    ↓ 触发异步队列 job
EmbeddingQueue (queue/embedding_queue.ts)
    ↓ 处理 pending jobs
    ↓ 调用 Ollama getEmbedding()
    ↓ 写入 LanceDB documents_vec
    ↓ 创建 FTS 索引
```

**新增文件**：
- `src/queue/types.ts` - Job 类型定义
- `src/queue/embedding_queue.ts` - 队列实现
- `src/queue/index.ts` - 导出
- `src/sqlite/queue_jobs.ts` - SQLite CRUD
- `tests/queue/embedding_queue.test.ts` - 35 个测试

**队列特性**：
- Job 类型：`embedding`, `fts_index`
- Job 状态：`pending` → `processing` → `completed` / `failed`
- 最大重试：3 次
- 后台处理：fire-and-forget，不阻塞主流程

### 11.4 目录结构更新

```
src/
├── queue/           # NEW: 异步队列系统
│   ├── types.ts           # Job 类型定义
│   ├── embedding_queue.ts # EmbeddingQueue 类
│   └── index.ts           # 导出 + singleton
├── sqlite/
│   └── queue_jobs.ts      # NEW: 队列 jobs CRUD
```

### 11.5 测试覆盖

| 测试文件 | 测试数 | 状态 |
|----------|--------|------|
| `tests/lance/hybrid_search_fixes.test.ts` | 11 | ✅ PASS |
| `tests/lance/semantic_search_fixes.test.ts` | 8 | ✅ PASS |
| `tests/lance/rebuild.test.ts` | 13 | ✅ PASS |
| `tests/queue/embedding_queue.test.ts` | 35 | ✅ PASS |

---

**文档结束**