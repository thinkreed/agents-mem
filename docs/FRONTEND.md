# FRONTEND.md — 前端开发指南

**维护**: UI 变更时更新 | 状态: active

---

## 一、项目类型

本项目是 **MCP (Model Context Protocol) 服务器**，通过 stdio 通信与外部客户端交互。

**无传统前端** — 接口是 MCP 工具 (JSON-RPC over stdio)

---

## 二、接口设计

### MCP 工具

| 工具 | 输入 | 输出 |
|------|------|------|
| `mem_create` | `{ resource, scope, data }` | `{ id, uri }` |
| `mem_read` | `{ query, scope, tier? }` | `{ data }` 或 `{ results[] }` |
| `mem_update` | `{ id, scope, data }` | `{ updated: true }` |
| `mem_delete` | `{ id, scope, cascade? }` | `{ deleted: true }` |

### 资源类型

- `document` — 文档内容
- `asset` — 二进制资源
- `conversation` — 对话记录
- `message` — 单条消息
- `fact` — 原子事实
- `team` — 团队信息

---

## 三、数据格式

### URI 格式

```
mem://{userId}/{agentId?}/{teamId?}/{type}/{id}
```

示例:
- `mem://user123/agent1/_/documents/doc-456`
- `mem://user123/_/team5/facts/fact-789`

### Scope

```typescript
{
  userId: string      // 必填
  agentId?: string    // 可选
  teamId?: string     // 可选
}
```

### 搜索模式

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| `hybrid` | FTS + Vector + RRF | 中文搜索、语义搜索 |
| `fts` | BM25 全文搜索 | 精确关键词匹配 |
| `semantic` | 向量相似度 | 语义相关 |
| `progressive` | L0 分层 + 降级 | Token 受限场景 |

---

## 四、分层内容

### L0 — 概览 (~100 tokens)

- 元数据、摘要
- 适用于快速浏览

### L1 — 详细 (~2000 tokens)

- 分层摘要
- 适用于上下文理解

### L2 — 完整 (无限制)

- 原始内容
- 适用于深度分析

---

## 五、错误格式

```typescript
{
  error: string        // 用户友好消息
  code?: string        // 错误代码
  details?: object     // 调试信息 (仅日志)
}
```

### 标准错误

| 错误 | 消息 |
|------|------|
| userId 缺失 | `"userId is required for {resource}"` |
| query 缺失 | `"query is required for mem_read"` |
| 无效查询 | `"Invalid query for {resource}. Valid keys: {keys}"` |

---

## 六、开发指南

### 添加新工具

1. 在 `src/tools/` 创建处理器
2. 定义 Zod schema 验证
3. 在 `mcp_server.ts` 注册工具
4. 编写测试
5. 更新本文档

### 添加新资源类型

1. 更新 `EntityType` 联合类型 (`src/core/types.ts`)
2. 创建 SQLite 表 (`src/sqlite/`)
3. 添加 CRUD 处理器
4. 更新工具分发器
5. 编写测试
6. 更新本文档

---

## 七、命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 变量/函数 | camelCase | `handleMemCreate` |
| 类型/接口 | PascalCase | `MaterialURI` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| 文件 | snake_case | `crud_handlers.ts` |
| SQLite 字段 | snake_case | `user_id`, `created_at` |
