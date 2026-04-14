# agents-mem — Agent 知识库目录

**角色**: 内容目录 (非百科全书) — 指向真实信息来源的地图  
**维护**: 代码与文档必须同步 | 过时文档由 doc-gardener 智能体扫描

---

## 快速开始

```bash
bun install          # 安装依赖
bun test             # 运行测试 (Vitest)
bun run typecheck    # TypeScript 类型检查
bun run src/mcp_server.ts  # 启动 MCP 服务器
```

**依赖服务**: Ollama (`localhost:11434`) | OpenViking (`localhost:1933`)  
**存储**: `~/.agents_mem/` (SQLite) | Embedding: `bge-m3` (1024 维)

---

## 项目概览

六层渐进式记忆系统，面向 169+ agents。TypeScript/Bun + SQLite + OpenViking。

**核心目标**: Token 成本节省 80-91% (L0/L1/L2 分层加载)

详见 → [`docs/DESIGN.md`](docs/DESIGN.md) — 完整架构决策与算法  
详见 → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 域分层与依赖边界

---

## 目录地图

```
src/
├── core/        类型定义、URI、Scope、常量
├── sqlite/      15 张表、CRUD、迁移
├── openviking/  HTTP 客户端、URI 适配、Scope 映射
├── queue/       异步 embedding 队列
├── tools/       4 个 MCP CRUD 工具
├── tiered/      L0/L1/L2 分层内容生成
├── facts/       事实提取、验证、链接
├── entity_tree/ 聚合、阈值树
├── embedder/    Ollama 客户端 + 缓存
├── llm/         LLM 提示词、流式
├── materials/   URI 解析、追踪、存储
├── utils/       日志、审计、关闭
└── mcp_server.ts 入口点 (MCP stdio)
```

---

## 关键约束

- **Scope 必需**: `userId` 必填 | `agentId/teamId` 可选
- **SQLite 蛇形**: `user_id`, `created_at`
- **Unix 秒**: `Math.floor(Date.now() / 1000)`
- **Token 预算**: L0≈100, L1≈2000
- **重试**: maxRetries=3, retryDelay=100ms
- **测试**: 100% 覆盖 | TDD 驱动 | 功能测试核心链路

详见 → [`docs/SPEC.md`](docs/SPEC.md) — 开发规范与约束

---

## MCP 工具

| 工具 | 功能 | 资源类型 |
|------|------|----------|
| `mem_create` | 创建资源 | document, asset, conversation, message, fact, team |
| `mem_read` | 读取/搜索/列表/分层 | 同上 |
| `mem_update` | 更新 (验证 scope) | 同上 |
| `mem_delete` | 删除 (级联) | 同上 |

**搜索模式**: `hybrid` (中文语义) | `fts` | `semantic` | `progressive`

详见 → [`docs/DESIGN.md`](docs/DESIGN.md) § 接口设计

---

## 质量门禁

- 类型检查: `bun run typecheck`
- 测试: `bun test`
- 覆盖率: 100%

详见 → [`docs/QUALITY_SCORE.md`](docs/QUALITY_SCORE.md) — 质量评分体系  
详见 → [`docs/RELIABILITY.md`](docs/RELIABILITY.md) — 可靠性要求  
详见 → [`docs/SECURITY.md`](docs/SECURITY.md) — 安全规范

---

## 知识库

```
docs/
├── DESIGN.md          设计决策、算法、架构
├── ARCHITECTURE.md    域分层、依赖边界、模块地图
├── design-docs/       设计文档 (索引 + 核心理念)
├── exec-plans/        执行计划 (active/ completed/ tech-debt-tracker)
├── references/        外部参考 (llms.txt)
├── QUALITY_SCORE.md   质量评分
├── RELIABILITY.md     可靠性
└── SECURITY.md        安全
```

详见 → [`docs/design-docs/index.md`](docs/design-docs/index.md) — 设计文档索引

---

## 故障排查

| 问题 | 解决 |
|------|------|
| OpenViking 连接失败 | 启动服务 (`localhost:1933`), 验证 API key |
| 搜索返回空 | 等待异步处理, 检查 Ollama, 验证 scope 匹配 |
| 中文搜索失败 | 使用 `searchMode: 'hybrid'` |
| URI 路径不一致 | 存储/搜索统一使用 `uriAdapter.buildTargetUri()` |

详见 → [`docs/RELIABILITY.md`](docs/RELIABILITY.md) — 运维指南
