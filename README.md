# agents-mem

Six-layer progressive disclosure memory system for 169+ agents. Optimizes token costs by 80-91% through tiered content loading.

## Features

- 🚀 **Six-Layer Progressive Disclosure** — L0 (summary) → L1 (overview) → L2 (full) → Facts → Agentic retrieval
- 💾 **Hybrid Search** — LanceDB FTS + Vector + RRF Reranker for accurate results
- 🔍 **mem:// URI Scheme** — Filesystem-like addressing for memories
- 🌐 **Multi-Scope Support** — User, Agent, and Team level isolation
- 📊 **Atomic Fact Tracing** — Trace every fact back to source documents
- 🛠️ **MCP Tools** — Ready-to-use Model Context Protocol tools

## Quick Start

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck
```

## Architecture

The six-layer progressive disclosure architecture:

| Layer | Name | Description | Token Budget |
|-------|------|-------------|--------------|
| L0 | Scope & Identity | User/Agent/Team management | N/A |
| L1 | Index & Metadata | mem:// URI resolution | ~50 |
| L2 | Documents & Assets | Raw content storage | Full |
| L3 | Tiered Content | L0/L1/L2 summaries | 50-2000 |
| L4 | Vector + Hybrid Search | FTS + Vector + RRF | N/A |
| L5 | Facts & Entity Tree | Atomic facts + traceability | ~1000 |

**Progressive Disclosure Flow:**
```
Metadata → L0 Summary → L1 Overview → L2 Full → Facts → Agentic Reasoning
  ~50     → ~100       → ~2k        → Full   → ~1k  → ~2k tokens
```

## Requirements

- **Runtime:** Bun 1.x
- **Vector DB:** LanceDB (embedded)
- **Embedding Model:** Ollama with nomic-embed-text
- **Storage:** SQLite + LanceDB (stored in `~/.agents_mem/`)

## Development

```bash
# Start the server (if available)
bun run src/server.ts

# Run specific test suite
bun test tests/lance/
bun test tests/sqlite/
```

### Project Structure

```
src/
├── core/           # URI, Scope, Types
├── sqlite/         # Relational data (users, agents, teams, facts)
├── lance/          # Vector storage + hybrid search
├── embedder/       # Ollama embedding client
├── tiered/         # L0/L1 content generation
├── facts/          # Fact extraction & verification
├── entity_tree/    # Entity relationship tree
├── materials/      # Trace & filesystem
└── tools/          # MCP tool definitions
```

## API Reference

### MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `mem_search` | Hybrid search memories | `query`, `scope`, `limit` |
| `mem_get` | Get memory by mem:// URI | `uri` |
| `mem_write` | Store new memory | `content`, `scope`, `type` |
| `mem_facts_extract` | Extract atomic facts | `document_id` |
| `mem_tiered_get` | Get tiered content | `memory_id`, `tier` |
| `mem_scope_list` | List available scopes | `user_id` |
| `mem_entity_search` | Search entity tree | `entity_name`, `depth` |

## Tech Stack

- **Runtime:** Bun 1.x
- **Language:** TypeScript
- **Vector DB:** LanceDB
- **Relational DB:** SQLite
- **Embeddings:** Ollama (nomic-embed-text)
- **Testing:** Vitest

---

# agents-mem

面向 169+ Agents 的六层渐进式披露记忆系统。通过分层内容加载，节省 80-91% 的 Token 成本。

## 特性

- 🚀 **六层渐进式披露** — L0(摘要) → L1(概要) → L2(完整) → 事实 → 智能检索
- 💾 **混合搜索** — LanceDB FTS + 向量 + RRF 重排，精准匹配
- 🔍 **mem:// URI 方案** — 类文件系统寻址方式访问记忆
- 🌐 **多作用域支持** — User、Agent、Team 级别隔离
- 📊 **原子事实追溯** — 每个事实可追溯至源文档
- 🛠️ **MCP 工具** — 开箱即用的模型上下文协议工具

## 快速开始

```bash
# 安装依赖
bun install

# 运行测试
bun test

# 类型检查
bun run typecheck
```

## 架构

六层渐进式披露架构：

| 层级 | 名称 | 描述 | Token 预算 |
|------|------|------|------------|
| L0 | 作用域与身份 | User/Agent/Team 管理 | N/A |
| L1 | 索引与元数据 | mem:// URI 解析 | ~50 |
| L2 | 文档与素材 | 原始内容存储 | 完整 |
| L3 | 分层内容 | L0/L1/L2 摘要 | 50-2000 |
| L4 | 向量与混合搜索 | FTS + 向量 + RRF | N/A |
| L5 | 事实与实体树 | 原子事实 + 可追溯性 | ~1000 |

**渐进式披露流程：**
```
元数据 → L0 摘要 → L1 概要 → L2 完整 → 事实 → 智能推理
  ~50  → ~100   → ~2k    → 完整   → ~1k  → ~2k tokens
```

## 系统要求

- **运行时：** Bun 1.x
- **向量数据库：** LanceDB (嵌入式)
- **Embedding 模型：** Ollama + nomic-embed-text
- **存储：** SQLite + LanceDB (存储在 `~/.agents_mem/`)

## 开发指南

```bash
# 启动服务 (如果可用)
bun run src/server.ts

# 运行特定测试套件
bun test tests/lance/
bun test tests/sqlite/
```

### 项目结构

```
src/
├── core/           # URI、作用域、类型定义
├── sqlite/         # 关系型数据 (users, agents, teams, facts)
├── lance/          # 向量存储 + 混合搜索
├── embedder/       # Ollama embedding 客户端
├── tiered/         # L0/L1 内容生成
├── facts/          # 事实提取与验证
├── entity_tree/    # 实体关系树
├── materials/      # 追踪与文件系统
└── tools/          # MCP 工具定义
```

## API 参考

### MCP 工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `mem_search` | 混合搜索记忆 | `query`, `scope`, `limit` |
| `mem_get` | 通过 mem:// URI 获取记忆 | `uri` |
| `mem_write` | 存储新记忆 | `content`, `scope`, `type` |
| `mem_facts_extract` | 提取原子事实 | `document_id` |
| `mem_tiered_get` | 获取分层内容 | `memory_id`, `tier` |
| `mem_scope_list` | 列出可用作用域 | `user_id` |
| `mem_entity_search` | 搜索实体树 | `entity_name`, `depth` |

## 技术栈

- **运行时：** Bun 1.x
- **语言：** TypeScript
- **向量数据库：** LanceDB
- **关系数据库：** SQLite
- **Embeddings：** Ollama (nomic-embed-text)
- **测试框架：** Vitest

## 许可证

MIT License