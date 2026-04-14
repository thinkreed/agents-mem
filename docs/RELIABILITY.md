# 可靠性指南

**目标**: 确保系统稳定运行，快速故障恢复

---

## 一、服务依赖

### 必需服务

| 服务 | 地址 | 用途 | 检查命令 |
|------|------|------|----------|
| Ollama | `localhost:11434` | Embedding (bge-m3) | `curl http://localhost:11434/api/tags` |
| OpenViking | `localhost:1933` | 向量搜索 | `curl http://localhost:1933/health` |
| SQLite | `~/.agents_mem/` | 主数据存储 | 自动创建 |

### 启动前检查

```bash
# 检查 Ollama
curl -s http://localhost:11434/api/tags | grep -q "bge-m3" && echo "✅ Ollama OK" || echo "❌ Ollama 需要启动"

# 检查 OpenViking
curl -s http://localhost:1933/health && echo "✅ OpenViking OK" || echo "❌ OpenViking 需要启动"
```

---

## 二、故障排查

### OpenViking 连接失败

**症状**: 搜索返回连接错误  
**原因**: 
- OpenViking 服务未运行
- API key 不匹配
- 网络问题

**解决**:
1. 启动 OpenViking: `openviking start`
2. 验证 API key 配置
3. 检查网络连接: `curl http://localhost:1933/health`

### 搜索返回空结果

**症状**: 文档已存储但搜索返回 `[]`  
**原因**:
- OpenViking 尚未异步处理完成
- Ollama 不可用
- URI 路径不匹配
- Scope 不匹配

**解决**:
1. 等待并重试 (异步处理需要时间)
2. 验证 Ollama: `curl http://localhost:11434/api/tags`
3. 检查 scope 与存储时一致
4. 验证 URI 路径: 存储和搜索使用相同的 `uriAdapter.buildTargetUri()`

### 中文搜索无结果

**症状**: 中文查询返回空  
**解决**: 使用 `searchMode: 'hybrid'` — OpenViking embeddings 支持中文语义

### Embedding 失败

**症状**: 文档存储但无向量  
**原因**: Ollama 不可用或模型未下载

**解决**:
1. 检查 Ollama 运行状态
2. 下载模型: `ollama pull bge-m3`
3. 验证: `curl http://localhost:11434/api/show -d '{"name": "bge-m3"}'`

---

## 三、重试机制

### 配置

| 参数 | 值 | 描述 |
|------|-----|------|
| maxRetries | 3 | 最大重试次数 |
| retryDelay | 100ms | 重试间隔 |
| timeout | 30s | 请求超时 |

### 重试策略

```typescript
// 指数退避
const delay = retryDelay * Math.pow(2, retryCount)
```

### 何时重试

- ✅ 网络超时
- ✅ 5xx 服务器错误
- ✅ 服务暂时不可用

### 何时不重试

- ❌ 4xx 客户端错误 (验证失败、权限不足)
- ❌ 业务逻辑错误
- ❌ 数据格式错误

---

## 四、日志与监控

### 结构化日志

```typescript
// 所有日志使用结构化格式
{
  level: 'info' | 'warn' | 'error',
  timestamp: number,       // Unix 秒
  module: string,          // 模块名
  message: string,         // 人类可读
  data?: object            // 机器可读上下文
}
```

### 关键日志点

| 事件 | 级别 | 示例 |
|------|------|------|
| 服务启动 | info | `MCP server started` |
| 文档创建 | info | `Document created: {id}` |
| Embedding 完成 | info | `Embedding queued: {id}` |
| 搜索请求 | debug | `Search: {query}` |
| 重试 | warn | `Retry {n}/3: {error}` |
| 失败 | error | `Failed: {error}` |

### 审计日志

所有写操作 (create/update/delete) 记录到 SQLite audit 表

---

## 五、性能指标

### 目标 SLA

| 指标 | 目标 | 测量 |
|------|------|------|
| 启动时间 | <5s | 从启动到就绪 |
| ID 查询 | <50ms | `mem_read {id}` |
| 搜索查询 | <2s | `mem_read {search}` |
| 创建文档 | <100ms | `mem_create` (不含 embedding) |
| Embedding | 异步 | 后台队列处理 |

### Token 预算

| 层 | Token 数 | 用途 |
|----|----------|------|
| L0 | ~100 | 概览、元数据 |
| L1 | ~2000 | 详细摘要 |
| L2 | 完整 | 原始内容 |

### 阈值公式

```
θ(d) = θ₀ × e^(λd)

θ(0) = 0.70  — 根节点
θ(1) = 0.77  — 第 1 层
θ(2) = 0.85  — 第 2 层
θ(3) = 0.93  — 第 3 层
```

---

## 六、优雅关闭

### 关闭流程

1. 停止接收新请求
2. 等待当前请求完成 (最多 30s)
3. 刷新日志缓冲区
4. 关闭数据库连接
5. 清理临时文件

### 信号处理

```typescript
process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)
```

---

## 七、备份与恢复

### 数据位置

- **SQLite**: `~/.agents_mem/agents_mem.db`
- **配置**: 项目根目录

### 备份

```bash
# 手动备份
cp ~/.agents_mem/agents_mem.db ~/.agents_mem/agents_mem.db.bak

# 定时备份 (cron)
0 2 * * * cp ~/.agents_mem/agents_mem.db ~/.agents_mem/agents_mem.$(date +\%Y\%m\%d).db
```

### 恢复

```bash
cp ~/.agents_mem/agents_mem.db.bak ~/.agents_mem/agents_mem.db
```
