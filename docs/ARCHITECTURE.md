# 架构文档 — 域分层与依赖地图

**格式**: 基于 [matklad/ARCHITECTURE.md](https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html)  
**维护**: 代码变更时必须同步更新

---

## 一、系统概览

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client (外部)                      │
└────────────────────┬────────────────────────────────────┘
                     │ stdio
┌────────────────────▼────────────────────────────────────┐
│                   mcp_server.ts                         │
│              (入口点, 工具注册)                            │
└────┬────┬────┬────┬────┬────────────────────────────────┘
     │    │    │    │    │
┌────▼─┐┌▼───┐┌▼───┐┌▼───┐┌▼────────────────────────────┐
│create││read││upd ││del ││ 其他工具                       │
└──┬───┘└┬───┘└┬───┘└┬───┘└┬─────────────────────────────┘
     │     │     │     │     │
┌────▼─────▼─────▼─────▼─────▼───────────────────────────┐
│                   tools/ (MCP CRUD handlers)            │
│              mem_create, mem_read, mem_update, mem_delete│
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                  业务逻辑层                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ tiered/  │ │ facts/   │ │entity_   │ │materials/│   │
│  │(L0/L1/L2)│ │(提取验证) │ │  tree/   │ │(URI存储) │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                  基础设施层                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ sqlite/  │ │openviking│ │ queue/   │ │embedder/ │   │
│  │(主数据)  │ │(向量搜索) │ │(异步任务) │ │(Ollama)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                  核心类型与工具                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ core/    │ │ utils/   │ │  llm/    │                │
│  │(类型/URI)│ │(日志/审计)│ │(提示词)  │                │
│  └──────────┘ └──────────┘ └──────────┘                │
└─────────────────────────────────────────────────────────┘
```

---

## 二、分层领域架构

**规则**: 代码只能"向前"依赖，不能向后或循环依赖

```
Types → Config → Repo → Service → Runtime → UI
```

### 当前项目的层

| 层 | 目录 | 依赖允许 | 描述 |
|----|------|----------|------|
| **Types** | `src/core/` | 无依赖 | 类型定义、URI、Scope、常量 |
| **Config** | *(内联)* | → Types | 配置常量、默认值 |
| **Repo** | `src/sqlite/` | → Types | 数据访问层 (CRUD) |
| **Service** | `src/openviking/`, `src/tiered/`, `src/facts/`, `src/entity_tree/` | → Types, Config, Repo | 业务逻辑 |
| **Runtime** | `src/queue/`, `src/embedder/`, `src/llm/`, `src/materials/` | → Types, Config, Repo, Service | 运行时基础设施 |
| **Tools** | `src/tools/` | → 所有下层 | MCP 工具处理器 |
| **Entry** | `src/mcp_server.ts` | → Tools | 入口点 |

### 禁止的依赖

- ❌ Repo → Service (数据访问不能依赖业务逻辑)
- ❌ Service → Tools (业务逻辑不能依赖工具层)
- ❌ Runtime → Tools (运行时不能依赖工具层)
- ❌ 任何层 → 自身层中的同级 (避免循环)

### 横切关注点

通过 **Providers** 接口进入:
- 日志 (`utils/logger.ts`)
- 审计 (`utils/audit_logger.ts`)
- 关闭处理 (`utils/shutdown.ts`)
- 验证 (Zod schemas)

---

## 三、模块边界

### `src/core/` — 类型与契约

```typescript
// 导出
- Scope interface        // 用户/Agent/Team 隔离
- EntityType union       // 资源类型联合
- MaterialURI interface  // mem:// URI 结构
- ScopeFilter class      // SQL 过滤器构建器
```

**依赖**: 无

### `src/sqlite/` — 数据访问

```typescript
// 每个实体一个文件
- {entity}.ts → create/get/update/delete/search

// 导出
- Schema definitions     // SQLite 表结构
- CRUD functions         // 同步操作 (better-sqlite3)
- Migration scripts      // 数据库迁移
```

**依赖**: `core/`

### `src/openviking/` — 向量搜索适配

```typescript
// 导出
- OpenVikingHTTPClient  // HTTP SDK 封装
- URIAdapter            // mem:// ↔ viking:// 转换
- ScopeMapper           // Scope → OpenViking filter
```

**依赖**: `core/`

### `src/tools/` — MCP 工具

```typescript
// 导出
- handleMemCreate       // create 分发器
- handleMemRead         // read 分发器
- handleMemUpdate       // update 分发器
- handleMemDelete       // delete 分发器
```

**依赖**: `core/`, `sqlite/`, `openviking/`, `tiered/`, `facts/`, `materials/`

---

## 四、数据流

### 创建流程

```
MCP Client → mcp_server.ts → handleMemCreate
  → sqlite/{type}.create()        // 存储主数据
  → materials/store.ts            // 存储文档 (触发 embedding)
  → queue/embedding_queue.ts      // 异步 embedding 任务
  → openviking/http_client.ts     // 向量索引
```

### 读取流程

```
MCP Client → mcp_server.ts → handleMemRead
  → sqlite/{type}.get()             // ID 查询
  → openviking/http_client.find()   // 语义搜索
  → tiered/generator.ts             // L0/L1/L2 分层
  → facts/extractor.ts              // 事实提取
  → entity_tree/aggregator.ts       // 实体树聚合
```

---

## 五、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 向量数据库 | OpenViking HTTP | HTTP API + 语义搜索 + 多租户 |
| 分层加载 | L0/L1/L2 | Token 节省 80-91% |
| URI 方案 | `mem://` | 借鉴 viking:// 文件系统范式 |
| 运行时 | Bun | TypeScript 原生支持 |
| 测试 | Vitest | 快速、现代 |
| 验证 | Zod | 类型安全 |

---

## 六、文件规模限制

**规则**: 单个文件不超过 500 行

| 类型 | 限制 | Linter |
|------|------|--------|
| 源文件 | ≤ 500 行 | `max-lines` |
| 函数 | ≤ 50 行 | `max-lines-per-function` |
| 测试文件 | ≤ 300 行 | 按功能拆分 |
