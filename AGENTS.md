# agents-mem

六层渐进式记忆系统，支持 169+ 代理。TypeScript/Bun + SQLite + OpenViking。

## 快速命令

```bash
bun install && bun test && bun run src/mcp_server.ts
```

## 依赖服务

- **Ollama**: localhost:11434 (bge-m3  embeddings, dim=1024)
- **OpenViking**: localhost:1933 (向量搜索, POST /api/v1/search/find)
- **存储**: `~/.agents_mem/`

## 目录结构

```
src/
├── core/        # 类型、URI、Scope、常量
├── sqlite/      # 15 张表、CRUD、迁移
├── openviking/  # HTTP 客户端、URI 适配、Scope 映射
├── queue/       # 异步 embedding 队列
├── tools/       # 4 个 MCP CRUD 工具
├── tiered/      # L0/L1 内容生成
├── facts/       # 事实提取、验证、链接
├── entity_tree/ # 聚合、阈值树
├── embedder/    # Ollama 客户端 + 缓存
├── llm/         # LLM 提示词、流式
├── materials/   # URI 解析、追踪、存储
└── utils/       # 日志、审计、关闭
```

## 关键约定

- **Scope 必需**: `userId` 必填, `agentId/teamId` 可选
- **SQLite 蛇形**: `user_id`, `created_at`
- **Unix 秒**: `Math.floor(Date.now() / 1000)`
- **Token 预算**: L0=100, L1=2000
- **重试**: maxRetries=3, retryDelay=100ms

## MCP 工具

| 工具 | 功能 |
|------|------|
| `mem_create` | 创建 6 种资源 |
| `mem_read` | 读取/搜索/列表/分层 |
| `mem_update` | 更新 (验证 scope) |
| `mem_delete` | 删除 (级联) |

**资源类型**: document, asset, conversation, message, fact, team

## 搜索模式

- `hybrid` - OpenViking 混合搜索 (支持中文)
- `fts` - 全文搜索
- `semantic` - 向量相似度
- `progressive` - L0 分层 + 降级

## 常见问题

| 问题 | 解决 |
|------|------|
| OpenViking 连接失败 | 启动服务, 验证 API key |
| 搜索返回空 | 等待异步处理, 检查 Ollama, 验证 scope |
| 中文搜索失败 | 使用 `searchMode: 'hybrid'` |

## 错误消息格式

- **userId 缺失**: `"userId is required for {resource}"`
- **query 缺失**: `"query is required for mem_read"`
- **无效查询**: `"Invalid query for {resource}. Valid keys: {keys}"`

**有效查询键**:
- document: `id, search, list, tier`
- asset/conversation: `id, list`
- message: `id, conversationId`
- fact: `id, filters`
- team: `id, list, filters`
