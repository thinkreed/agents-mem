# src/tools

MCP 接口层，4 个统一 CRUD 工具操作 6 种资源类型。

## 工具映射

| MCP 工具 | 处理函数 | 功能 |
|----------|----------|------|
| `mem_create` | handleMemCreate | 创建所有资源 |
| `mem_read` | handleMemRead | 读取/搜索/列表/分层/追踪 |
| `mem_update` | handleMemUpdate | 更新 (验证 scope) |
| `mem_delete` | handleMemDelete | 删除 (级联) |

## 验证规则

- **资源**: document, asset, conversation, message, fact, team
- **角色**: user, assistant, system, tool
- **来源**: documents, messages, conversations
- **层级**: L0, L1, L2
- **模式**: hybrid, fts, semantic, progressive

## 搜索模式

- `hybrid` → OpenViking 混合搜索
- `fts` → 全文搜索
- `semantic` → 向量相似度
- `progressive` → L0 分层 + 降级
