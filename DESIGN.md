# agents-mem 设计文档 v1.0

**版本**: 1.0
**日期**: 2026-04-12
**状态**: 设计完成，待实施

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
│   ├── definitions.ts      # 工具定义 (Zod schema)
│   ├── handlers.ts         # 工具处理函数
│   └── registry.ts         # 工具注册
│
├── server.ts               # MCP stdio 入口
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

### 5.1 MCP 工具列表

| 工具名 | 层级 | 功能 |
|--------|------|------|
| scope_set | L0 | 设置 Agent 作用域 |
| team_create | L0 | 创建团队 |
| team_join | L0 | Agent 加入团队 |
| index_search | L1 | URI + 元数据定位 |
| uri_resolve | L1 | 解析 mem:// URI |
| document_save | L2 | 保存原始文档 |
| document_abstract | L2 | L0 摘要 |
| document_overview | L2 | L1 概述 |
| document_read | L2 | L2 完整内容 |
| asset_save | L2 | 保存二进制素材 |
| hybrid_search | L4 | 混合搜索 |
| semantic_search | L4 | 向量搜索 |
| fts_search | L4 | FTS 搜索 |
| progressive_search | L3-5 | 渐进式披露 |
| fact_extract | L5 | 事实提取 |
| fact_search | L5 | 事实搜索 |
| fact_trace | L5 | 追溯来源 |
| entity_tree_build | L5 | 构建实体树 |
| entity_tree_search | L5 | 实体树搜索 |
| conversation_create | L3 | 创建会话 |
| message_save | L3 | 保存消息 |
| materials_ls | L2 | 素材目录列表 |
| materials_tree | L2 | 素材目录树 |
| materials_grep | L2 | 素材文本搜索 |

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

**文档结束**