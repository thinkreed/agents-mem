# agents-mem 设计文档

**版本**: 1.1  
**日期**: 2026-04-12  
**状态**: 实施完成，4 CRUD 工具已上线

---

## 一、项目概述

### 1.1 定位

面向 **169+ agents** 的**六层渐进式披露记忆系统**，核心目标是 **Token 成本节省**。

### 1.2 核心设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 向量数据库 | LanceDB | TypeScript SDK + Bun 兼容 + 原生混合搜索 |
| 混合搜索 | LanceDB FTS + 向量 + RRF Reranker | 内置 Tantivy BM25 + 向量融合 |
| 多 Agent Scope | 应用层实现 (user_id/agent_id/team_id) | LanceDB scope 字段 + SQLite 过滤 |
| 分层加载 | L0/L1/L2 三层 | 借鉴 OpenViking，Token 节省 80-91% |
| 文件系统范式 | `mem://` URI | 借鉴 OpenViking viking:// |
| 事实追溯 | facts → tiered → documents/assets | 原子事实完整语境 + 可追溯 |

### 1.3 设计参数

| 参数 | 值 |
|------|-----|
| Embedding 维度 | 768 (nomic-embed-text) |
| L0 Token 预算 | ~50-100 (一句话摘要) |
| L1 Token 预算 | ~500-2000 (结构化概述) |
| θ₀ 基础阈值 | 0.7 (实体树) |
| λ 深度因子 | 0.1 (θ(d) = θ₀ × e^(λd)) |
| 数据存储 | `~/.agents_mem/` |

---

## 二、架构设计

### 2.1 六层架构

```
Layer 0: SCOPE & IDENTITY        — user_id + agent_id + team_id + is_global
Layer 1: INDEX & METADATA        — mem:// URI, 元数据过滤
Layer 2: DOCUMENTS & ASSETS      — 原始素材完整保留
Layer 3: TIERED CONTENT          — L0/L1/L2 分层摘要
Layer 4: VECTOR + HYBRID SEARCH  — FTS + 向量 + RRF
Layer 5: FACTS & ENTITY TREE     — 事实追溯链

存储: SQLite (主数据) + LanceDB (向量 + FTS)
```

**渐进式披露流程:**
| Level | 操作 | Token | 延迟 |
|-------|------|-------|------|
| 1 | 元数据定位 (memory_index) | ~50 | 1-5ms |
| 2 | L0 概览 (tiered_vec) | ~100 | 10-50ms |
| 3 | L1 概要 (tiered_vec) | ~2k | 10-50ms |
| 4 | L2 完整 (documents_vec) | 不限 | 20-100ms |
| 5 | 事实追溯 (facts → documents) | ~1k | 20-100ms |
| 6 | Agentic 推理 (多轮补检) | ~2k | 100-500ms |

### 2.2 目录结构

```
src/
├── core/          # URI、Scope、Types、Constants
├── sqlite/        # 15 表 CRUD + migrations
├── lance/         # 向量 ops + hybrid/fts/semantic search
├── queue/         # 异步 embedding 队列
├── embedder/      # Ollama client + cache
├── tiered/        # L0/L1 生成器 (LLM)
├── materials/     # URI resolver + trace
├── facts/         # Extraction + verification + linking
├── entity_tree/   # MemTree + θ(d) 阈值
├── tools/         # MCP CRUD handlers
└── mcp_server.ts  # 入口 (4 工具)
```

---

## 三、数据模型

### 3.1 LanceDB 向量表

| 表名 | 向量维度 | FTS 列 | Scope 字段 |
|------|----------|--------|-----------|
| documents_vec | 768 | content | user_id, agent_id, team_id |
| messages_vec | 768 | content | user_id, agent_id, team_id |
| facts_vec | 768 | content | user_id, agent_id, team_id |
| tiered_vec | 768 | content | user_id, agent_id, team_id, tier |
| assets_vec | 768 | content | user_id, agent_id, team_id |

### 3.2 URI 格式

```
mem://{userId}/{agentId?}/{teamId?}/{type}/{id}

示例:
mem://user123/agent1/_/documents/doc-456
mem://user123/_/team5/facts/fact-789
mem://user123/_/_/tiered/tiered-abc
```

---

## 四、核心算法

### 4.1 混合搜索

```typescript
table.search(query, "hybrid")
  .vector(queryEmbedding)
  .ftsColumns("content")
  .where(scopeFilter)
  .rerank(new RRFReranker())
  .limit(10)
```

### 4.2 渐进式披露 Token 控制

```
Token < 500   → L0 (~100 tokens)
Token < 3000  → L0 + L1 (~2k tokens)
Token >= 3000 → L2 完整内容
```

### 4.3 实体树自适应阈值

```
θ(d) = θ₀ × e^(λd)

θ(0) = 0.70  (根节点)
θ(1) = 0.77  (第一层)
θ(2) = 0.85  (第二层)
θ(3) = 0.93  (第三层)

深层节点需更高相似度才能合并
```

### 4.4 事实追溯链

```
fact.source_id → tiered_content.id → tiered_content.original_uri → documents/assets
```

---

## 五、接口设计

### 5.1 MCP CRUD 工具 (4 Tools)

| 工具 | 功能 | 参数 |
|------|------|------|
| `mem_create` | 创建资源 | `resource`, `data`, `scope` |
| `mem_read` | 读取/搜索 | `resource`, `query`, `scope` |
| `mem_update` | 更新资源 | `resource`, `id`, `data`, `scope` |
| `mem_delete` | 删除资源 | `resource`, `id`, `scope` |

**资源类型:** `document`, `asset`, `conversation`, `message`, `fact`, `team`

**作用域:** `{ userId: string, agentId?: string, teamId?: string }`

### 5.2 查询模式

| 模式 | 参数示例 | 说明 |
|------|---------|------|
| ID | `{ id: "doc-123" }` | 按 ID 获取 |
| 搜索 | `{ search: "关键词", searchMode: "hybrid" }` | hybrid/fts/semantic/progressive |
| 分层 | `{ id: "doc-123", tier: "L0" }` | L0 摘要 / L1 概述 / L2 完整 |
| 追溯 | `{ id: "fact-123", trace: true }` | 追溯事实到源文档 |
| 列表 | `{ list: true }` | 列出所有 |
| 过滤 | `{ list: true, filters: { docType: "note" } }` | 按条件过滤 |

### 5.3 搜索模式

| searchMode | 描述 |
|------------|------|
| `hybrid` | FTS + Vector + RRF (默认) |
| `fts` | BM25 全文搜索 |
| `semantic` | 纯向量搜索 |
| `progressive` | 渐进式披露 (L0→L1→L2) |

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
| 类型检查 | strict, 无 any |
| 文档 | DESIGN.md + IMPLEMENTATION_PLAN.md |

---

## 八、参考资料

| 来源 | 借鉴内容 |
|------|----------|
| OpenViking | L0/L1/L2 分层加载、viking:// URI |
| Membrain | 原子事实完整语境、自适应实体树 θ(d) |
| LanceDB | 混合搜索 FTS + 向量 + RRF |

---

## 九、实施状态 (2026-04-12)

所有核心功能已完整实现并通过测试：

| 功能 | 文件 | 状态 |
|------|------|------|
| 混合搜索 (FTS + 向量 + RRF) | `src/lance/hybrid_search.ts` | ✅ |
| FTS 搜索 (BM25) | `src/lance/fts_search.ts` | ✅ |
| 纯向量搜索 | `src/lance/semantic_search.ts` | ✅ |
| assets_vec 表 CRUD | `src/lance/assets_vec.ts` | ✅ |
| Fact Verifier + Linker | `src/facts/verifier.ts`, `linker.ts` | ✅ |
| ScopeFilter 全支持 | `src/core/scope.ts` | ✅ |
| 异步 Embedding 队列 | `src/queue/embedding_queue.ts` | ✅ |
| 向量表初始化 + 重建回退 | `src/lance/connection.ts` | ✅ |
| API 错误提示增强 | `src/tools/crud_handlers.ts` | ✅ |

---

## 十、队列系统 (2026-04-13 更新)

### 10.1 组件状态

| 组件 | 文件 | 状态 |
|------|------|------|
| 单例获取器 | `queue/index.ts` | ✅ 新增 |
| 类型转换器 | `queue/converters.ts` | ✅ 新增 |
| 队列修复 | `queue/embedding_queue.ts` | ✅ 修复 5 处调用点 |

### 10.2 转换函数

- `recordToJob()`: `QueueJobRecord` → `QueueJob` (snake_case 转 camelCase，字符串 payload 转对象)
- `jobToRecord()`: `QueueJob` → `QueueJobRecord` (反向转换)

### 10.3 单例模式

`getEmbeddingQueue()` 遵循 `tiered/queue.ts` 模式，提供统一的队列访问入口。

---

**文档结束**