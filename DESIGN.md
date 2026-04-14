# agents-mem 设计文档

**版本**: 2.0 | **日期**: 2026-04-14 | **状态**: OpenViking 集成完成

---

## 一、项目概述

面向 **169+ agents** 的**六层渐进式披露记忆系统**，核心目标是 **Token 成本节省**。

| 决策 | 选择 | 理由 |
|------|------|------|
| 向量数据库 | OpenViking HTTP | HTTP API + 语义搜索 + 多租户 |
| 语义搜索 | find API | 支持中文语义 + 混合模式 |
| 分层加载 | L0/L1/L2 | Token 节省 80-91% |
| URI 方案 | `mem://` | 借鉴 viking:// 文件系统范式 |
| 事实追溯 | facts→tiered→docs | 原子事实完整语境 |
| 日志系统 | 异步缓冲 | 非阻塞 + SQLite audit |

**参数:** Embedding 1024 (bge-m3), L0=~100 tokens, L1=~2k tokens, θ₀=0.7, λ=0.1, 存储=`~/.agents_mem/`, OpenViking=localhost:1933

---

## 二、六层架构

```
L0: SCOPE & IDENTITY     — user_id + agent_id + team_id
L1: INDEX & METADATA     — mem:// URI, 元数据过滤
L2: DOCUMENTS & ASSETS   — 原始素材
L3: TIERED CONTENT       — L0/L1/L2 分层摘要
L4: VECTOR SEARCH        — OpenViking find API
L5: FACTS & ENTITY TREE  — 事实追溯链
存储: SQLite (主数据) + OpenViking (向量)
```

**披露流程:** 元数据(~50) → L0(~100) → L1(~2k) → L2(full) → facts(~1k) → agentic(~2k)

**目录:** `core/` `sqlite/` `openviking/` `queue/` `embedder/` `tiered/` `facts/` `entity_tree/` `tools/` `utils/` `mcp_server.ts`

---

## 三、数据模型

**URI:** `mem://{userId}/{agentId?}/{teamId?}/{type}/{id}`

示例: `mem://user123/agent1/_/documents/doc-456` | `mem://user123/_/team5/facts/fact-789`

---

## 四、核心算法

| 算法 | 描述 |
|------|------|
| 语义搜索 | `client.find({ query, target_uri, limit, mode: 'hybrid' })` |
| Token 控制 | <500→L0, <3000→L0+L1, ≥3000→L2 |
| 实体树阈值 | θ(d) = θ₀ × e^(λd): θ(0)=0.70, θ(1)=0.77, θ(2)=0.85, θ(3)=0.93 |
| 事实追溯 | fact.source_id → tiered.id → original_uri → documents/assets |

---

## 五、接口设计

**MCP 工具 (4):** `mem_create` `mem_read` `mem_update` `mem_delete`

**资源:** document, asset, conversation, message, fact, team

**Scope:** `{ userId (必填), agentId?, teamId? }`

**查询模式:**

| 模式 | 示例 |
|------|------|
| ID | `{ id: "doc-123" }` |
| 搜索 | `{ search: "关键词", searchMode: "hybrid" }` |
| 分层 | `{ id: "doc-123", tier: "L0" }` |
| 追溯 | `{ id: "fact-123", trace: true }` |
| 列表 | `{ list: true, filters: {...} }` |

**searchMode:** hybrid (FTS+Vector+RRF), fts (BM25), semantic, progressive

---

## 六、技术选型

| 技术 | 用途 |
|------|------|
| Bun | 运行时 |
| TypeScript (strict) | 开发语言 |
| SQLite (better-sqlite3) | 主数据存储 |
| OpenViking HTTP | 向量存储 + 语义搜索 |
| Ollama (bge-m3) | Embedding (1024 维) |
| Vitest | 测试框架 |
| Zod | Schema 验证 |

---

## 七、质量与参考

**质量:** 测试覆盖率 100%, strict 类型检查, 文档 DESIGN.md + AGENTS.md

**参考:** OpenViking (分层加载/URI/find API), Membrain (原子事实/实体树θ(d))

---

## 八、OpenViking 集成

**API 端点:**

| 端点 | 方法 | 功能 |
|------|------|------|
| /api/v1/search/find | GET | 语义搜索 |
| /api/v1/content/abstract | GET | L0 概览 |
| /api/v1/content/overview | GET | L1 概要 |
| /api/v1/content/read | GET | L2 完整 |
| /api/v1/fs | DELETE | 删除 |
| /api/v1/resources | POST | 添加 |

**配置:** baseUrl=localhost:1933, timeout=30s, dimension=1024

**组件:** HTTP Client (`http_client.ts`), URI Adapter (`uri_adapter.ts`), Scope Mapper (`scope_mapper.ts`)

**URI 转换:** `mem://user123/_/_/documents/doc-abc` → `viking://default/user123/resources/documents/doc-abc`

**响应:** `{ status: "ok", result, time }` 或 `{ status: "error", error: { code, message } }`

---

## 九、实施状态

| 功能 | 文件 | 状态 |
|------|------|------|
| OpenViking HTTP Client | openviking/http_client.ts | ✅ |
| URI Adapter | openviking/uri_adapter.ts | ✅ |
| Scope Mapper | openviking/scope_mapper.ts | ✅ |
| 语义搜索 | openviking/http_client.ts | ✅ |
| L0/L1/L2 分层 | openviking/http_client.ts | ✅ |
| Fact Verifier+Linker | facts/*.ts | ✅ |
| ScopeFilter | core/scope.ts | ✅ |
| Embedding Queue | queue/embedding_queue.ts | ✅ |
| LogBuffer | utils/log_buffer.ts | ✅ |
| AuditLogger | utils/audit_logger.ts | ✅ |
| Shutdown | utils/shutdown.ts | ✅ |
| MCP CRUD | tools/crud_handlers.ts | ✅ |

---

**文档结束**