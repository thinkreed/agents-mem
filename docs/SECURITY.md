# 安全规范

**目标**: 保护用户数据，防止未授权访问

---

## 一、数据隔离

### Scope 隔离

所有数据通过 Scope 隔离:

```python
from pydantic import BaseModel

class Scope(BaseModel):
    user_id: str      # 必填 — 用户隔离
    agent_id: str | None = None    # 可选 — Agent 隔离
    team_id: str | None = None     # 可选 — 团队隔离
```

### 规则

| 规则 | 描述 |
|------|------|
| user_id 必填 | 所有操作必须提供 user_id |
| Scope 验证 | 每次查询自动附加 scope 过滤 |
| 跨 Scope 禁止 | 不允许访问其他用户/agent 数据 |

### SQL 过滤

```sql
-- 所有查询自动附加 WHERE 子句
WHERE user_id = ? 
  AND (agent_id = ? OR agent_id IS NULL)
  AND (team_id = ? OR team_id IS NULL)
```

---

## 二、输入验证

### Pydantic Schema 验证

所有外部输入必须通过 Pydantic model 验证:

```python
from pydantic import BaseModel, Field
from typing import Optional

class CreateDocumentRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    agent_id: Optional[str] = None
    team_id: Optional[str] = None
    content: str = Field(..., min_length=1)
    metadata: Optional[dict] = None
```

### 验证点

| 层级 | 验证内容 |
|------|----------|
| MCP 工具 | 参数类型、必填、枚举值 |
| SQLite CRUD | ID 格式、Scope 匹配 |
| L1 Index | Vector search uses SQLite + Ollama |

### 禁止的输入

- ❌ SQL 注入字符 (未转义)
- ❌ 路径遍历 (`../`)
- ❌ 超长字符串 (>1MB)
- ❌ 无效 URI 格式

---

## 三、错误处理

### 错误消息

**不泄露内部细节**:

```python
# 安全
raise ValueError("user_id is required for document. Provide scope: { 'user_id': '...' }")

# 不安全 — 泄露 SQL 细节
raise ValueError(f"SQL failed: SELECT * FROM documents WHERE user_id='{user_id}'")
```

### 错误分类

| 类型 | 返回给用户 | 记录到日志 |
|------|-----------|-----------|
| 验证错误 | ✅ 详细消息 | warn |
| 业务错误 | ✅ 用户友好消息 | warn |
| 系统错误 | ❌ 通用消息 | error + 堆栈 |

---

## 四、敏感数据

### 禁止存储

| 数据类型 | 原因 |
|----------|------|
| API Keys | 泄露风险 |
| Passwords | 应使用哈希 |
| Access Tokens | 有过期机制 |
| PII (个人身份信息) | 隐私合规 |

### 审计日志

| 记录内容 | 不记录内容 |
|----------|-----------|
| 操作类型 (create/read/update/delete) | 请求体中的敏感字段 |
| 资源类型和 ID | API Keys |
| Scope (userId, agentId, teamId) | 密码、Token |
| 时间戳 | 完整错误堆栈 (仅内部) |

---

## 五、依赖安全

### 依赖审计

```bash
# 定期检查依赖漏洞
pip audit
```

### 锁定文件

- 提交 `uv.lock` 或 `poetry.lock` 到 Git
- 使用固定版本，不接受范围

### 最小依赖

| 依赖 | 用途 |
|------|------|
| `mcp` | MCP 协议 |
| `pydantic` | Schema 验证 |
| `aiosqlite` | SQLite (异步) |

---

## 六、运行安全

### MCP 协议

- 运行在 stdio (非 HTTP)
- 仅接受本地进程通信
- 不暴露网络端口

### 文件权限

```bash
# 数据库文件仅所有者可读写
chmod 600 ~/.agents_mem/agents_mem.db
```

### 环境变量

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `OLLAMA_HOST` | Ollama 地址 | `http://localhost:11434` |
| `OLLAMA_HOST` | Ollama 地址 | `http://localhost:11434` |

**不要**在代码中硬编码密钥

---

## 七、安全 checklist

### 代码审查

- [ ] 所有外部输入通过 Pydantic 验证
- [ ] 无 SQL 注入风险 (使用参数化查询)
- [ ] 错误消息不泄露内部细节
- [ ] 无硬编码密钥或 Token
- [ ] Scope 过滤应用于所有查询

### 部署前

- [ ] 依赖无已知漏洞
- [ ] 文件权限正确
- [ ] 日志记录敏感操作
- [ ] 关闭流程优雅

### 定期

- [ ] 每月运行 `pip audit`
- [ ] 每季度审查依赖是否需要
- [ ] 每半年评估安全策略
