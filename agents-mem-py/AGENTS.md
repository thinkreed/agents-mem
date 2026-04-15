# agents-mem-py — Agent 记忆系统 (Python版)

**角色**: 面向 Agents 的4层渐进式记忆系统  
**架构**: L0 Identity → L1 Index → L2 Content → L3 Knowledge  
**维护**: 代码与文档同步 | 测试覆盖率 100%

---

## 快速开始

```bash
# 安装依赖
pip install -e ".[dev]"

# 配置环境变量
cp .env.example .env
# 编辑 .env 配置 OpenViking 和 Ollama

# 运行测试
pytest --cov=agents_mem --cov-report=html

# 启动 MCP 服务器
python -m agents_mem
# 或
agents-mem-py
```

**依赖服务**: 
- OpenViking (`localhost:1933`) - 向量搜索
- Ollama (`localhost:11434`) - Embedding (bge-m3)

**存储**: `~/.agents_mem/` (SQLite)

---

## 项目概览

4层渐进式记忆系统，面向 169+ Agents。Python 3.11+ / FastMCP / SQLite / OpenViking。

**核心目标**: Token 成本节省 80-91% (通过 L0/L1/L2 分层加载)

详见 → [`docs/agents-mem-py-DESIGN-v2.md`](docs/agents-mem-py-DESIGN-v2.md) — 完整架构决策

---

## 4层架构

```
┌────────────────────────────────────────────────────────┐
│  L3: Knowledge Layer                                   │
│  ├─ Facts (事实提取与验证)                              │
│  ├─ Entity Tree (实体聚合与关联)                        │
│  └─ Trace (事实追溯链)                                  │
├────────────────────────────────────────────────────────┤
│  L2: Content Layer ⭐ (核心价值)                       │
│  ├─ Documents/Assets (原始内容存储)                     │
│  ├─ Tiered Views (L0/L1/L2 分层视图 - 内置能力)        │
│  └─ Conversations/Messages (会话内容)                   │
├────────────────────────────────────────────────────────┤
│  L1: Index Layer                                       │
│  ├─ URI System (mem:// 寻址)                            │
│  ├─ Metadata Index (元数据索引)                         │
│  └─ Vector Search (语义搜索 - 内置能力)                 │
├────────────────────────────────────────────────────────┤
│  L0: Identity Layer                                    │
│  ├─ Scope (user_id/agent_id/teamId)                     │
│  └─ Access Control (权限控制)                           │
└────────────────────────────────────────────────────────┘
```

**单向依赖**: L3 → L2 → L1 → L0 (内层不依赖外层)

---

## 目录地图

```
agents-mem-py/
├── src/agents_mem/
│   ├── core/           # 核心类型、URI、常量、异常
│   ├── identity/       # L0: 身份层
│   ├── index/          # L1: 索引层 + VectorSearchCapability
│   ├── content/        # L2: 内容层 + TieredViewCapability
│   ├── knowledge/      # L3: 知识层
│   ├── export/         # Markdown导出 + Jinja2模板
│   ├── sqlite/         # 数据库连接、迁移、13张表
│   ├── openviking/     # OpenViking HTTP客户端
│   ├── llm/            # LLM客户端 + 提示词
│   ├── tools/          # MCP工具处理器
│   ├── mcp_server.py   # FastMCP服务器
│   └── __main__.py     # 入口点
│
└── tests/              # 测试套件 (100%覆盖)
    ├── test_core/
    ├── test_identity/
    ├── test_index/
    ├── test_content/
    ├── test_knowledge/
    ├── test_export/
    └── test_tools/
```

---

## 关键约束

- **Scope 必需**: `user_id` 必填 | `agent_id/team_id` 可选
- **SQLite 蛇形**: `user_id`, `created_at`
- **Unix 秒**: 时间戳使用整数秒
- **Token 预算**: L0≈100, L1≈2000
- **重试**: maxRetries=3, retryDelay=100ms
- **测试**: 100% 覆盖 | pytest-asyncio

---

## MCP 工具

| 工具 | 功能 | 资源类型 |
|------|------|----------|
| `mem_create` | 创建资源 | document, asset, conversation, message, fact, team |
| `mem_read` | 读取/搜索/列表/分层 | 同上 |
| `mem_update` | 更新 (验证 scope) | 同上 |
| `mem_delete` | 删除 (级联) | 同上 |
| `mem_export` | 导出 Markdown | L2-Content / L3-Knowledge |

**搜索模式**: `hybrid` (中文语义) | `fts` | `semantic` | `progressive`

**分层视图**: `tier=L0` (~100 tokens) | `tier=L1` (~2000 tokens) | `tier=L2` (完整)

详见 → [`docs/agents-mem-py-QUICKSTART-v2.md`](docs/agents-mem-py-QUICKSTART-v2.md)

---

## 质量门禁

- 类型检查: `pyright src/agents_mem`
- 代码风格: `ruff check src/agents_mem`
- 测试: `pytest --cov=agents_mem --cov-fail-under=100`
- 覆盖率: 100%

---

## 知识库

```
docs/
├── agents-mem-py-DESIGN-v2.md      # 架构设计 (4层)
├── agents-mem-py-EXPORT-v2.md      # Markdown导出设计
├── agents-mem-py-QUICKSTART-v2.md  # 快速开始指南
└── AGENTS.md                       # 本文件
```

---

## 故障排查

| 问题 | 解决 |
|------|------|
| OpenViking 连接失败 | 启动服务 (`localhost:1933`), 验证 API key |
| 搜索返回空 | 等待异步处理, 检查 Ollama, 验证 scope 匹配 |
| 中文搜索失败 | 使用 `search_mode: 'hybrid'` |
| URI 路径不一致 | 存储/搜索统一使用 `URISystem.build_target_uri()` |

---

**文档结束**
