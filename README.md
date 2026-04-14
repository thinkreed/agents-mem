# agents-mem

Six-layer progressive disclosure memory system for 169+ agents. Optimizes token costs by 80-91% through tiered content loading.

## Features

- 🚀 **Six-Layer Progressive Disclosure** — L0 (summary) → L1 (overview) → L2 (full) → Facts → Agentic
- 💾 **OpenViking Semantic Search** — HTTP-based vector search with hybrid mode
- 🔍 **mem:// URI Scheme** — Filesystem-like addressing for memories
- 🌐 **Multi-Scope Support** — User, Agent, and Team level isolation
- 📊 **Atomic Fact Tracing** — Trace every fact back to source documents
- 🛠️ **MCP Tools** — 4 unified CRUD tools for all resources

## Quick Start

```bash
bun install
bun test
bun run typecheck
bun run src/mcp_server.ts
```

## Architecture

| Layer | Name | Description | Token Budget |
|-------|------|-------------|--------------|
| L0 | Scope & Identity | User/Agent/Team management | N/A |
| L1 | Index & Metadata | mem:// URI resolution | ~50 |
| L2 | Documents & Assets | Raw content storage | Full |
| L3 | Tiered Content | L0/L1/L2 summaries | 50-2000 |
| L4 | OpenViking Search | Semantic search via HTTP API | N/A |
| L5 | Facts & Entity Tree | Atomic facts + traceability | ~1000 |

## Requirements

- **Runtime:** Bun 1.x
- **Vector Search:** OpenViking HTTP API (localhost:1933)
- **Embedding:** Ollama with bge-m3 (1024-dim)
- **Storage:** SQLite (stored in `~/.agents_mem/`)

## Project Structure

```
src/
├── core/           # URI, Scope, Types
├── sqlite/         # Relational data
├── openviking/     # HTTP client + URI adapter
├── embedder/       # Ollama client (bge-m3)
├── tiered/         # L0/L1 content generation
├── facts/          # Fact extraction & verification
├── entity_tree/    # Entity relationship tree
├── materials/      # Trace & store
└── tools/          # MCP CRUD tools
```

## API Reference

### MCP CRUD Tools (4 Tools)

| Tool | Description | Parameters |
|------|-------------|------------|
| `mem_create` | Create resource | `resource`, `data`, `scope` |
| `mem_read` | Read/search resources | `resource`, `query`, `scope` |
| `mem_update` | Update resource | `resource`, `id`, `data`, `scope` |
| `mem_delete` | Delete resource | `resource`, `id`, `scope` |

**Resources:** `document`, `asset`, `conversation`, `message`, `fact`, `team`

**Scope:** `{ userId, agentId?, teamId? }` - userId required

**Query modes:** `{ id }`, `{ search, searchMode }`, `{ list }`, `{ tier }`, `{ trace }`

## Tech Stack

- **Runtime:** Bun 1.x | **Language:** TypeScript
- **Vector Search:** OpenViking HTTP | **Relational:** SQLite
- **Embeddings:** Ollama (bge-m3, 1024-dim) | **Testing:** Vitest

---

# agents-mem

面向 169+ Agents 的六层渐进式披露记忆系统。通过分层内容加载，节省 80-91% 的 Token 成本。

## 特性

- 🚀 **六层渐进式披露** — L0(摘要) → L1(概要) → L2(完整) → 事实 → 智能检索
- 💾 **OpenViking 语义搜索** — HTTP 向量搜索，支持混合模式
- 🔍 **mem:// URI 方案** — 类文件系统寻址方式访问记忆
- 🌐 **多作用域支持** — User、Agent、Team 级别隔离
- 📊 **原子事实追溯** — 每个事实可追溯至源文档
- 🛠️ **MCP 工具** — 4 个统一 CRUD 工具

## 快速开始

```bash
bun install
bun test
bun run typecheck
bun run src/mcp_server.ts
```

## 架构

| 层级 | 名称 | 描述 | Token 预算 |
|------|------|------|------------|
| L0 | 作用域与身份 | User/Agent/Team 管理 | N/A |
| L1 | 索引与元数据 | mem:// URI 解析 | ~50 |
| L2 | 文档与素材 | 原始内容存储 | 完整 |
| L3 | 分层内容 | L0/L1/L2 摘要 | 50-2000 |
| L4 | OpenViking 搜索 | HTTP 语义搜索 | N/A |
| L5 | 事实与实体树 | 原子事实 + 可追溯性 | ~1000 |

## 系统要求

- **运行时：** Bun 1.x
- **向量搜索：** OpenViking HTTP API (localhost:1933)
- **Embedding：** Ollama + bge-m3 (1024 维)
- **存储：** SQLite (存储在 `~/.agents_mem/`)

## 项目结构

```
src/
├── core/           # URI、作用域、类型定义
├── sqlite/         # 关系型数据
├── openviking/     # HTTP 客户端 + URI 适配器
├── embedder/       # Ollama 客户端 (bge-m3)
├── tiered/         # L0/L1 内容生成
├── facts/          # 事实提取与验证
├── entity_tree/    # 实体关系树
├── materials/      # 追踪与存储
└── tools/          # MCP CRUD 工具
```

## API 参考

### MCP CRUD 工具 (4 个工具)

| 工具 | 描述 | 参数 |
|------|------|------|
| `mem_create` | 创建资源 | `resource`, `data`, `scope` |
| `mem_read` | 读取/搜索资源 | `resource`, `query`, `scope` |
| `mem_update` | 更新资源 | `resource`, `id`, `data`, `scope` |
| `mem_delete` | 删除资源 | `resource`, `id`, `scope` |

**资源类型:** `document`, `asset`, `conversation`, `message`, `fact`, `team`

**作用域:** `{ userId, agentId?, teamId? }` - userId 必填

**查询模式:** `{ id }`, `{ search, searchMode }`, `{ list }`, `{ tier }`, `{ trace }`

## 技术栈

- **运行时：** Bun 1.x | **语言：** TypeScript
- **向量搜索：** OpenViking HTTP | **关系数据库：** SQLite
- **Embeddings：** Ollama (bge-m3, 1024 维) | **测试框架：** Vitest

## 许可证

MIT License