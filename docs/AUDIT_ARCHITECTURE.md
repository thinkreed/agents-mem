# 架构审计报告

**版本**: 1.0 | **日期**: 2026-04-15 | **审计范围**: 全项目源码 + 文档

---

## 一、执行摘要

本次审计覆盖 **56 个 TypeScript 源文件** (~80KB)，发现 **22 个架构问题**，按严重程度分类：

| 严重程度 | 数量 | 影响范围 |
|----------|------|----------|
| 🔴 **P0 严重** | 3 | 核心架构违规 |
| 🟠 **P1 高** | 4 | 功能重叠、未使用代码 |
| 🟡 **P2 中** | 5 | 代码冗余、命名不一致 |
| 🟢 **P3 低** | 5 | 微小改进 |
| 📝 **文档问题** | 4 | 文档与代码不一致 |

**总体评分**: **C (需改进)** — 主要因 P0 问题扣分

---

## 二、发现问题详情

### 🔴 P0 严重问题 (必须修复)

#### 1. crud_handlers.ts 超过文件规模限制

**位置**: `src/tools/crud_handlers.ts`  
**现状**: 1088 行  
**限制**: 500 行 (ARCHITECTURE.md § 六)  
**影响**: 违反架构规范，代码可维护性差

**根因**: 
- 所有 6 种资源的 CRUD 操作集中在单一文件
- 搜索模式处理 (hybrid/fts/semantic/progressive) 大量重复代码
- 每个资源的审计日志记录代码重复

**建议重构**:
```
src/tools/
├── crud/
│   ├── base.ts          # 公共工具函数 (errorResponse, validateResource)
│   ├── document.ts      # document CRUD (~200 行)
│   ├── asset.ts         # asset CRUD (~150 行)
│   ├── conversation.ts  # conversation CRUD (~150 行)
│   ├── message.ts       # message CRUD (~150 行)
│   ├── fact.ts          # fact CRUD (~150 行)
│   ├── team.ts          # team CRUD (~150 行)
│   └── search.ts        # 搜索模式统一处理 (~200 行)
├── crud_handlers.ts     # 入口分发器 (~100 行)
```

---

#### 2. tools 目录存在两套工具系统

**位置**: `src/tools/`  
**现状**: 
- `crud_handlers.ts` — 4 个 MCP 工具 (mem_create, mem_read, mem_update, mem_delete)
- `handlers.ts + registry.ts + definitions.ts` — 另一套工具系统 (scope_set, document_save, hybrid_search, fact_extract, materials_ls, entity_tree_search, entity_tree_build)

**问题**:
- `mcp_server.ts` 使用 crud_handlers
- `server.ts` 使用 registry
- 两套系统功能重叠，造成维护混乱

**建议**:
- 统一为 crud_handlers 作为 MCP 标准接口
- 将 handlers.ts 中的扩展工具 (entity_tree_search 等) 迁移到 crud 模块
- 删除 registry.ts 和 definitions.ts (不再使用)
- 删除 server.ts (使用 mcp_server.ts 作为唯一入口)

---

#### 3. embedding_queue.ts 存在废弃代码

**位置**: `src/queue/embedding_queue.ts` (381 行)  
**现状**: 
```typescript
// 第 227-241 行注释明确说明功能已废弃
// Note: Embedding is now handled by OpenViking during addResource()
// This job is kept for backward compatibility but no longer performs
// LanceDB vector operations.

// 第 250-256 行同样说明 FTS 功能已废弃
// Note: FTS indexing is now handled by OpenViking automatically.
```

**问题**:
- 保留完整 queue 实现但实际功能已被 OpenViking 替代
- processEmbedding() 和 processFtsIndex() 方法为空操作
- 增加维护负担和代码理解难度

**建议**:
- 如果确实不需要本地 queue，简化为轻量级的 "job status tracker"
- 或完全删除 queue 模块，依赖 OpenViking 的异步处理
- 在 DESIGN.md 中明确说明 OpenViking 负责所有异步处理

---

### 🟠 P1 高优先级问题

#### 4. materials/trace.ts 函数功能重复

**位置**: `src/materials/trace.ts`  
**现状**:
```typescript
// 第 23-42 行: traceFact() - 异步函数，功能完整
export async function traceFact(factId: string): Promise<TraceResult>

// 第 59-81 行: traceFactToSource() - 同步版本，功能几乎相同
export function traceFactToSource(factId: string): TraceResult
```

**问题**: 
- 两个函数名相似但行为不同 (async vs sync)
- traceFactToSource 在 crud_handlers.ts 中使用，traceFact 未使用
- 注释说 "alias for compatibility" 但实际是重复实现

**建议**:
- 保留 traceFactToSource (已在使用)
- 删除 traceFact (未使用)
- 或统一为一个 async 函数并更新调用方

---

#### 5. 双入口文件功能重叠

**位置**: `src/mcp_server.ts` vs `src/server.ts`  
**现状**:
- `mcp_server.ts` (132 行) — 完整 MCP stdio 服务器，4 个 CRUD 工具
- `server.ts` (54 行) — MCPServer 类，使用 registry 系统

**问题**:
- server.ts 的 MCPServer 类未在 mcp_server.ts 中使用
- 两套初始化流程 (runMigrations 都调用)
- server.ts 导出的 startServer() 未被任何地方调用

**建议**:
- 删除 server.ts
- 保留 mcp_server.ts 作为唯一入口点
- 或将 server.ts 的 MCPServer 类作为测试用 mock

---

#### 6. entity_tree 模块未集成到主流程

**位置**: `src/entity_tree/` (4 个文件, 253 行)  
**现状**:
- 仅在 `tools/handlers.ts` 中使用 (entity_tree_search, entity_tree_build)
- crud_handlers.ts 中没有 entity_nodes 相关 CRUD
- DESIGN.md 描述的 "实体树阈值 θ(d)" 功能未暴露到 MCP 接口

**问题**:
- 模块存在但无法通过主 MCP 工具访问
- 用户无法管理 entity_nodes 资源

**建议**:
- 在 crud_handlers.ts 中添加 entity_nodes CRUD
- 或在 mem_read 中添加 `{ resource: "entity_nodes" }` 支持
- 或明确文档说明 entity_tree 为内部模块

---

#### 7. tiered/queue.ts 未被使用

**位置**: `src/tiered/queue.ts` (77 行)  
**现状**:
- TieredQueue 类定义了 enqueue, processQueue 等方法
- getTieredQueue() 导出函数
- **未在任何其他模块中被导入或调用**

**问题**:
- 完整实现的代码但从未使用
- 与 queue/embedding_queue.ts 功能重叠 (都是异步队列)

**建议**:
- 如果确实不需要，删除 tiered/queue.ts
- 或在 materials/store.ts 中使用它进行异步 L0/L1 生成

---

### 🟡 P2 中优先级问题

#### 8. Scope 类型重复定义

**位置**: 
- `src/core/types.ts` 第 49-54 行: `interface Scope`
- `src/core/scope.ts` 第 11-16 行: `interface ScopeConfig`

**现状**:
```typescript
// types.ts
export interface Scope {
  userId: string;
  agentId?: string;
  teamId?: string;
  isGlobal?: boolean;
}

// scope.ts
export interface ScopeConfig {
  userId: string;
  agentId?: string;
  teamId?: string;
  isGlobal?: boolean;
}
```

**问题**: 结构完全相同，命名不一致

**建议**: 合并为单一定义，使用 Scope 作为统一名称

---

#### 9. URI 处理功能重叠

**位置**:
- `src/core/uri.ts` (93 行): parseURI, buildURI, validateURI, isURI, extractURIComponents
- `src/materials/uri_resolver.ts` (59 行): resolveURI, buildMaterialURI, extractScopeFromURI, uriMatchesScope

**现状**:
- resolveURI 直接调用 parseURI (无额外逻辑)
- buildMaterialURI 直接调用 buildURI (仅做类型转换)
- extractURIComponents 和 extractScopeFromURI 功能相似

**建议**:
- 将 uri_resolver.ts 的额外方法合并到 core/uri.ts
- 删除 materials/uri_resolver.ts

---

#### 10. crud_handlers.ts 搜索模式代码重复

**位置**: `src/tools/crud_handlers.ts` 第 343-469 行  
**现状**: hybrid, fts, semantic, progressive 四种模式代码结构几乎相同：
```typescript
// 每个模式都重复以下代码块 (~30 行):
const client = getOpenVikingClient();
const uriAdapter = getURIAdapter();
const targetUri = userId ? uriAdapter.buildTargetUri(...) : undefined;
const findResult = await client.find({...});
const results = findResult.memories.map(m => ({
  ...m,
  uri: uriAdapter.toMemURI(m.uri, ...)
}));
getAuditLogger().log({...});
return successResponse(results);
```

**建议**:
- 抽取为 `executeSearch(query, userId, scope, mode)` 函数
- 四种模式调用统一函数，仅传递不同参数

---

#### 11. 单例模式滥用

**现状**: 项目中存在 **18+ 个单例实例**：
| 模块 | 单例变量 |
|------|----------|
| sqlite/connection.ts | connectionInstance |
| embedder/ollama.ts | embedderInstance |
| embedder/cache.ts | cacheInstance |
| embedder/batch.ts | batchInstance |
| llm/ollama.ts | llmClientInstance |
| tiered/generator.ts | generatorInstance |
| tiered/queue.ts | queueInstance |
| facts/extractor.ts | extractorInstance |
| entity_tree/builder.ts | builderInstance |
| queue/index.ts | embeddingQueueInstance |
| queue/embedding_queue.ts | jobs Map (类内部) |
| utils/logger.ts | 无 (通过 getLogBuffer) |
| utils/audit_logger.ts | auditLoggerInstance |
| utils/log_buffer.ts | logBufferInstance |
| utils/config.ts | 无 (纯函数) |
| openviking/http_client.ts | clientInstance |
| openviking/uri_adapter.ts | adapterInstance |
| openviking/scope_mapper.ts | mapperInstance |
| openviking/config.ts | configInstance |
| tools/registry.ts | registryInstance |

**问题**:
- 测试时需要大量 reset 函数
- 状态难以追踪
- 不利于依赖注入

**建议**:
- 核心基础设施 (connection, client) 保持单例
- 业务逻辑层 (extractor, generator) 改为工厂函数模式
- 添加统一的 `resetAllSingletons()` 测试辅助函数

---

#### 12. 测试文件超过规模限制

**位置**: `tests/production/`  
**现状**:
| 文件 | 行数 | 限制 |
|------|------|------|
| crud_document.test.ts | ~600 行估算 | 300 行 |
| crud_conversation_message.test.ts | ~600 行估算 | 300 行 |
| crud_fact.test.ts | ~400 行估算 | 300 行 |
| crud_asset.test.ts | ~300 行估算 | 300 行 |

**问题**: 违反 QUALITY_SCORE.md 测试文件 ≤300 行规定

**建议**: 按功能拆分测试文件：
```
tests/
├── production/
│   ├── document/
│   │   ├── create.test.ts
│   │   ├── read.test.ts
│   │   ├── update.test.ts
│   │   ├── delete.test.ts
│   │   └── search.test.ts
```

---

### 🟢 P3 低优先级问题

#### 13. 缺少 index.ts barrel exports

**位置**: `src/core/`, `src/tiered/`  
**现状**: ARCHITECTURE.md 明确说 "无 index.ts"，但 `llm/`, `queue/`, `openviking/` 都有 index.ts  
**建议**: 保持一致性，要么全部添加，要么全部不添加

---

#### 14. 常量定义分散

**位置**:
- `src/core/constants.ts` 第 15-16 行: `EMBED_DIMENSION = 1024`, `DEFAULT_EMBED_MODEL = 'bge-m3'`
- `src/embedder/ollama.ts` 第 18-23 行: 同样定义 + 注释说明模型选项

**建议**: 统一到 core/constants.ts

---

#### 15. 注释语言不一致

**现状**:
- 部分文件使用英文注释 (如 core/*.ts)
- 部分文件使用中文注释 (如 AGENTS.md 提示)
- 部分混合使用

**建议**: 统一为中文注释 (项目为中国用户设计)

---

#### 16. openviking/types.ts 未完整导出

**位置**: `src/openviking/index.ts`  
**现状**: VikingURI 接口导出为类型，但未导出类本身  
**建议**: 补充完整的类型导出

---

#### 17. 文件命名风格不一致

**现状**:
- `entity_tree/` 使用下划线分隔
- 其他目录不使用分隔符 (如 `tiered/`, `facts/`)

**建议**: 统一为无分隔符风格或全部使用下划线

---

### 📝 文档不一致问题

#### 18. ARCHITECTURE.md 关于 index.ts 描述不准确

**位置**: `docs/ARCHITECTURE.md` 核心模块描述  
**现状**: "无 index.ts: 没有根导出 barrel 文件"  
**实际**: `llm/index.ts`, `queue/index.ts`, `openviking/index.ts` 都存在

---

#### 19. DESIGN.md 表格数量描述

**位置**: `docs/DESIGN.md`  
**现状**: 文档说 "15 张表"  
**实际**: schema.ts 中 TABLE_NAMES 数组确实有 15 个表名 — **一致，无需修改**

---

#### 20. 实施状态表格与实际不一致

**位置**: `docs/DESIGN.md` § 九  
**现状**: 列出多个 "✅" 状态的功能  
**问题**: 
- tiered/queue.ts 标记为完成但实际未使用
- LogBuffer 标记完成但未连接到 OpenViking 操作

---

#### 21. ENTITY_TO_VIKING 映射说明不完整

**位置**: `docs/DESIGN.md` § 八 URI 转换  
**现状**: 仅说明文档转换示例  
**缺失**: assets, conversations, messages, facts 的转换规则未说明

---

## 三、冗余代码清单

| 文件 | 行数 | 原因 | 建议 |
|------|------|------|------|
| `src/server.ts` | 54 | 未使用 | 删除 |
| `src/tools/registry.ts` | 76 | 未使用 | 删除 |
| `src/tools/definitions.ts` | 81 | 未使用 | 删除 |
| `src/tools/handlers.ts` | 119 | 与 crud_handlers 重叠 | 迁移后删除 |
| `src/tiered/queue.ts` | 77 | 未使用 | 删除 |
| `src/materials/uri_resolver.ts` | 59 | 与 core/uri.ts 重叠 | 合并后删除 |
| `src/materials/trace.ts` traceFact() | ~20 | 与 traceFactToSource 重复 | 删除 |
| `src/queue/embedding_queue.ts` 部分 | ~150 | 废弃代码 | 简化或删除 |

**预估删除代码量**: ~600 行 (约 7.5%)

---

## 四、优化建议 (设计层面)

### 1. 重构 tools 目录结构

```
src/tools/
├── base.ts              # 公共类型和工具函数
├── crud/
│   ├── handlers.ts      # MCP 工具入口 (统一分发)
│   ├── document.ts
│   ├── asset.ts
│   ├── conversation.ts
│   ├── message.ts
│   ├── fact.ts
│   ├── team.ts
│   └── entity_nodes.ts  # 新增
├── search.ts            # 搜索模式统一处理
└── audit.ts             # 审计日志统一处理
```

### 2. 统一入口点

- **唯一入口**: `src/mcp_server.ts`
- **删除**: `src/server.ts`

### 3. 简化 queue 模块

选项 A: 删除整个 queue 模块 (依赖 OpenViking)
选项 B: 保留为轻量级 "任务状态查询器"

### 4. 合并 URI 处理

将 `materials/uri_resolver.ts` 合入 `core/uri.ts`

### 5. 添加 entity_nodes CRUD

在 crud_handlers.ts 中支持 `resource: "entity_nodes"`

### 6. 统一单例管理

创建 `src/utils/singleton_manager.ts`:
```typescript
export function resetAllSingletons(): void {
  resetConnection();
  resetClient();
  resetLLMClient();
  // ... 所有 reset 函数
}
```

---

## 五、优先级排序

### 立即修复 (本周)
1. 🔴 P0-1: 拆分 crud_handlers.ts
2. 🔴 P0-2: 统一 tools 系统
3. 🔴 P0-3: 处理 embedding_queue 废弃代码

### 短期修复 (两周内)
4. 🟠 P1-4: 删除重复函数
5. 🟠 P1-5: 删除 server.ts
6. 🟠 P1-6: 添加 entity_nodes CRUD
7. 🟠 P1-7: 删除 tiered/queue.ts

### 中期改进 (一个月内)
8. 🟡 P2-8 ~ P2-12: 代码清理和重构

### 持续改进
9. 🟢 P3-13 ~ P3-17: 小改进
10. 📝 文档更新

---

## 六、附录

### 文件规模统计

| 目录 | 文件数 | 总行数 | 最大文件 |
|------|--------|--------|----------|
| core/ | 4 | 540 | scope.ts (203) |
| sqlite/ | 15 | 6256 | schema.ts (498) |
| openviking/ | 6 | 2901 | http_client.ts (348) |
| tools/ | 4 | 1236 | crud_handlers.ts (1088) ❌ |
| tiered/ | 3 | 237 | generator.ts (115) |
| facts/ | 3 | 364 | extractor.ts (157) |
| entity_tree/ | 4 | 253 | aggregator.ts (69) |
| embedder/ | 3 | 363 | ollama.ts (126) |
| llm/ | 3 | 360 | ollama.ts (224) |
| materials/ | 4 | 618 | store.ts (131) |
| queue/ | 4 | 559 | embedding_queue.ts (381) |
| utils/ | 7 | 2482 | log_buffer.ts (410) |

### 调用链分析

主入口 → crud_handlers:
```
mcp_server.ts
  → handleMemCreate → storeDocument/storeAsset/createConversation/etc.
  → handleMemRead → getDocumentById/searchDocuments/OpenViking.find
  → handleMemUpdate → updateDocument/updateAsset/etc.
  → handleMemDelete → deleteDocument/deleteAsset/etc.
```

未使用模块:
```
server.ts (未导入)
tools/registry.ts (未导入)
tools/definitions.ts (未导入)
tiered/queue.ts (未导入)
materials/trace.ts::traceFact (未调用)
```

---

**审计完成** | 建议立即处理 P0 问题以提升项目质量等级