# agents-mem-py 快速开始指南 (4层架构版)

**版本**: 2.0 | **日期**: 2026-04-15 | **架构**: 4层架构

---

## 4层架构概览

```
┌────────────────────────────────────────────────────────┐
│  L3: Knowledge Layer                                   │
│  └─ Facts, Entity Tree, Trace                         │
├────────────────────────────────────────────────────────┤
│  L2: Content Layer ⭐ (核心价值)                       │
│  └─ Documents + Tiered Views (L0/L1/L2 内置能力)      │
├────────────────────────────────────────────────────────┤
│  L1: Index Layer                                       │
│  └─ URI + Metadata + Vector Search (内置能力)         │
├────────────────────────────────────────────────────────┤
│  L0: Identity Layer                                    │
│  └─ Scope + Access Control                            │
└────────────────────────────────────────────────────────┘
```

**与6层的关键区别**:
- ✅ Tiered Content 作为 L2 的**内置能力** (不再是独立层)
- ✅ Vector Search 作为 L1 的**内置能力** (不再是独立层)
- ✅ Facts 作为 L3 Knowledge (更清晰)
- ✅ 单向依赖: L3 → L2 → L1 → L0

---


## 快速开始

### 1. 安装

```bash
# 克隆项目
git clone <repository-url>
cd agents-mem-py

# 安装 uv (如果未安装)
curl -LsSf https://astral.sh/uv/install.sh | sh  # macOS/Linux
# 或
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"  # Windows

# 创建虚拟环境
uv venv
source .venv/bin/activate  # macOS/Linux
# 或
.venv\Scripts\activate     # Windows

# 安装依赖
uv pip install -e ".[dev]"
```

### 2. 配置

```bash
# 复制配置模板
cp .env.example .env

# 编辑 .env
cat > .env << EOF
# Ollama 配置 (L2 Content层的TieredView内置能力 + L1 Vector Search)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=bge-m3

# 导出配置
EXPORT_INTERVAL_MINUTES=60
EXPORT_DIR=~/.agents_mem/export
EOF
```

### 3. 启动

```bash
# 启动 MCP 服务器
python -m agents_mem

# 或
agents-mem-py
```

---

## 4层架构使用指南

### L0: Identity Layer (身份层)

**Scope 作用域**:
```python
# 所有操作都需要 Scope
scope = {
    "user_id": "user-123",      # 必填
    "agent_id": "agent-456",    # 可选
    "team_id": "team-789"      # 可选
}
```

**验证**:
```python
# 系统自动验证 scope
mem_create({
    "resource": "document",
    "data": {"content": "..."},
    "scope": scope  # 必须提供
})
```

---

### L1: Index Layer (索引层)

**URI 系统**:
```python
# 自动构建 URI
mem://user123/agent456/team789/documents/doc-001

# 组成部分:
# - user_id: user123
# - agent_id: agent456 (或 _ 表示空)
# - team_id: team789 (或 _ 表示空)
# - resource_type: documents
# - resource_id: doc-001
```

**搜索 (内置 Vector Search 能力)**:
```python
# 混合搜索 (L1内置能力)
{
    "tool": "mem_read",
    "arguments": {
        "resource": "document",
        "query": {
            "search": "咖啡偏好",
            "search_mode": "hybrid",  # FTS + Vector + RRF
            "limit": 10
        },
        "scope": {"user_id": "user-123"}
    }
}

# 搜索模式 (L1 Index层内置)
# - "fts": 全文搜索 (Metadata索引)
# - "semantic": 向量搜索 (VectorSearch内置能力)
# - "hybrid": 混合搜索 (默认推荐)
```

---

### L2: Content Layer (内容层) ⭐

**存储内容**:
```python
# 创建文档 (触发L2)
{
    "tool": "mem_create",
    "arguments": {
        "resource": "document",
        "data": {
            "title": "用户偏好记录",
            "content": "用户喜欢喝无糖咖啡，每天早上9点喝一杯...",
            "content_type": "text/plain"
        },
        "scope": {
            "user_id": "user-123",
            "agent_id": "agent-456"
        }
    }
}

# 异步触发 (L2内置能力):
# 1. Vector Search索引 (调用L1内置能力)
# 2. L0/L1摘要生成 (TieredView内置能力)
```

**分层读取 (L2内置 Tiered View 能力)**:
```python
# L0 摘要 (~100 tokens) - 快速概览
{
    "tool": "mem_read",
    "arguments": {
        "resource": "document",
        "query": {
            "id": "doc-001",
            "tier": "L0"              # L2内置能力
        },
        "scope": {"user_id": "user-123"}
    }
}
# 返回: {"abstract": "用户偏好素食...", "token_count": 98}

# L1 概览 (~2000 tokens) - 详细摘要
{
    "tool": "mem_read",
    "arguments": {
        "resource": "document",
        "query": {
            "id": "doc-001",
            "tier": "L1"              # L2内置能力
        }
    }
}
# 返回: {"overview": "用户偏好素食...", "token_count": 1890}

# L2 完整内容
{
    "tool": "mem_read",
    "arguments": {
        "resource": "document",
        "query": {
            "id": "doc-001",
            "tier": "L2"              # 原始内容
        }
    }
}
```

**分层搜索 (节省Token)**:
```python
# 搜索并返回L0视图 (节省80-91% Token)
{
    "tool": "mem_read",
    "arguments": {
        "resource": "document",
        "query": {
            "search": "咖啡偏好",
            "search_mode": "hybrid",
            "tier": "L0",              # 返回L0摘要，非完整内容
            "limit": 5
        }
    }
}
# 返回5个结果的L0摘要，总Token ~500 (vs 可能50,000)
```

**会话管理**:
```python
# 创建会话
{
    "tool": "mem_create",
    "arguments": {
        "resource": "conversation",
        "data": {
            "title": "咖啡偏好讨论"
        },
        "scope": {"user_id": "user-123", "agent_id": "agent-456"}
    }
}

# 添加消息
{
    "tool": "mem_create",
    "arguments": {
        "resource": "message",
        "data": {
            "conversation_id": "conv-001",
            "role": "user",
            "content": "我喜欢喝无糖咖啡"
        }
    }
}
```

---

### L3: Knowledge Layer (知识层)

**事实提取**:
```python
# 从内容提取事实 (L3)
{
    "tool": "mem_create",
    "arguments": {
        "resource": "fact",
        "data": {
            "source_type": "documents",
            "source_id": "doc-001",
            "content": "用户喜欢喝无糖咖啡，每天早上9点喝一杯"
        },
        "scope": {"user_id": "user-123"}
    }
}

# 异步触发 (L3):
# 1. LLM提取原子事实
# 2. 保存到L3 Knowledge
# 3. 添加到Vector索引 (调用L1内置能力)
```

**查询事实**:
```python
# 搜索事实
{
    "tool": "mem_read",
    "arguments": {
        "resource": "fact",
        "query": {
            "filters": {
                "fact_type": "preference",  # preference/decision/observation
                "verified": true
            }
        },
        "scope": {"user_id": "user-123"}
    }
}
```

**追溯链 (L3能力)**:
```python
# 追溯事实来源
{
    "tool": "mem_read",
    "arguments": {
        "resource": "fact",
        "query": {
            "id": "fact-001",
            "trace": true              # L3追溯能力
        }
    }
}
# 返回:
# {
#     "fact": {...},
#     "source_content": {...},      # L2 Content
#     "l0_abstract": "...",        # L2 TieredView
#     "l1_overview": "...",        # L2 TieredView
#     "trace_chain": [...]          # 完整追溯
# }
```

---

## 完整示例: 用户偏好记录

### 步骤1: 创建文档 (L2)

```python
result = await mem_create({
    "resource": "document",
    "data": {
        "title": "用户偏好记录",
        "content": """
用户是严格的素食主义者，不吃任何肉类、鱼类、蛋类和奶制品。
用户不喜欢辛辣食物，吃辣会引起胃部不适。
用户每天早上9点喝一杯美式咖啡，不加糖不加奶。
用户工作时间为每日9:00-18:00，周末休息。
用户偏好上午开会，下午专注工作。
"""
    },
    "scope": {"user_id": "user-123", "agent_id": "agent-456"}
})
# 返回: {"id": "doc-001", "uri": "mem://user123/agent456/_/documents/doc-001"}
```

### 步骤2: 提取事实 (L3)

```python
facts = await mem_create({
    "resource": "fact",
    "data": {
        "source_type": "documents",
        "source_id": "doc-001",
        "content": "用户偏好记录"  # L3自动提取内容
    },
    "scope": {"user_id": "user-123"}
})
# 返回: {"fact_ids": ["fact-001", "fact-002", "fact-003", "fact-004"]}
```

### 步骤3: 分层读取 (L2内置能力)

```python
# L0摘要 (~100 tokens)
await mem_read({
    "resource": "document",
    "query": {"id": "doc-001", "tier": "L0"},
    "scope": {"user_id": "user-123"}
})
# 返回: {"abstract": "用户是素食主义者，不吃辛辣，工作时间9:00-18:00...", "token_count": 98}

# 搜索并返回L0视图
results = await mem_read({
    "resource": "document",
    "query": {
        "search": "咖啡",
        "search_mode": "hybrid",
        "tier": "L0"                  # 节省Token
    },
    "scope": {"user_id": "user-123"}
})
# 返回包含L0摘要的搜索结果
```

### 步骤4: 追溯事实 (L3能力)

```python
trace = await mem_read({
    "resource": "fact",
    "query": {"id": "fact-001", "trace": true},
    "scope": {"user_id": "user-123"}
})
# 返回:
# {
#     "fact": {"content": "用户是素食主义者", ...},
#     "source": {
#         "uri": "mem://user123/agent456/_/documents/doc-001",
#         "l0_abstract": "用户是素食主义者...",
#         "l1_overview": "详细的饮食偏好...",
#         "full_content": "原始完整内容..."
#     }
# }
```

---

## Markdown 导出 (4层架构)

### 导出命令

```python
# 导出L2 Content层
await mem_export({
    "scope": {"user_id": "user-123"},
    "layer": "L2",                      # Content层
    "content_type": "document",
    "include_tiered": True              # 包含L0/L1/L2视图
})

# 导出L3 Knowledge层
await mem_export({
    "scope": {"user_id": "user-123"},
    "layer": "L3",                      # Knowledge层
    "fact_type": "preference",
    "include_entities": True             # 包含实体图谱
})

# 全量导出
await mem_export({
    "scope": {"user_id": "user-123"},
    "layer": "all"
})
```

### 导出目录结构

```
~/.agents_mem/export/user-123/
├── README.md
├── L2-content/              # Content层导出
│   ├── documents/
│   │   └── 2025-04/
│   │       └── doc-001.md   # 包含L0/L1/L2视图
│   └── tiered-preferences.md
└── L3-knowledge/            # Knowledge层导出
    ├── facts/
    │   └── 2025-04/
    │       └── fact-001.md
    └── entities/
        └── entity-graph.md
```

### 查看导出文件

```bash
# 查看文档 (包含三层视图)
cat ~/.agents_mem/export/user-123/L2-content/documents/2025-04/doc-001.md

# 查看事实 (包含追溯链)
cat ~/.agents_mem/export/user-123/L3-knowledge/facts/2025-04/fact-001.md

# 查看实体图谱
cat ~/.agents_mem/export/user-123/L3-knowledge/entities/entity-graph.md
```

---

## Token 节省计算

### 4层架构的披露流程

```
Metadata(~50) → L0(~100) → L1(~2k) → L2(full)
                    ↑
               Token节省80-91%
```

### 示例计算

假设文档: 10,000 tokens

| 操作 | 6层Token | 4层Token | 说明 |
|------|----------|----------|------|
| 直接加载 | 10,000 | 10,000 | L2完整内容 |
| L0查询 | 100 | 100 | L2内置TieredView |
| L1查询 | 2,000 | 2,000 | L2内置TieredView |
| **节省** | **80-91%** | **80-91%** | **相同效果** |

**结论**: 4层架构保持相同的Token节省效果

---

## 开发指南

### 项目结构

```
agents-mem-py/
├── src/agents_mem/
│   ├── identity/           # L0: 身份层
│   │   ├── scope.py
│   │   └── auth.py
│   │
│   ├── index/              # L1: 索引层
│   │   ├── layer.py
│   │   ├── uri.py
│   │   └── capabilities/   # 内置能力
│   │       └── vector_search.py
│   │
│   ├── content/            # L2: 内容层 ⭐
│   │   ├── layer.py
│   │   ├── repository.py
│   │   └── capabilities/   # 内置能力
│   │       └── tiered.py   # TieredViewCapability
│   │
│   ├── knowledge/          # L3: 知识层
│   │   ├── layer.py
│   │   ├── facts.py
│   │   └── entities.py
│   │
│   └── export/             # Markdown导出
│
└── tests/
    ├── test_identity/       # L0测试
    ├── test_index/          # L1测试
    ├── test_content/        # L2测试
    └── test_knowledge/      # L3测试
```

### 添加新功能

**在L2添加新的内容类型**:
```python
# src/agents_mem/content/resources/note.py

class NoteResource:
    """笔记资源 (L2 Content层)"""
    
    async def create(self, scope: Scope, data: dict) -> Note:
        # 存储到L2
        note = await self.repository.save(scope, data)
        
        # 触发L2内置能力: 生成Tiered视图
        await self.tiered.generate_views(note)
        
        # 触发L1内置能力: 添加到Vector索引
        await self.index.vector_search.index(note)
        
        return note
```

**在L3添加新的知识提取**:
```python
# src/agents_mem/knowledge/extractors/custom.py

class CustomExtractor:
    """自定义提取器 (L3 Knowledge层)"""
    
    async def extract(self, content: Content) -> list[Fact]:
        # 读取L2内容 (只读)
        content = await self.content_layer.get(content_uri)
        
        # 提取知识
        facts = await self.llm.extract(content.body)
        
        # 保存到L3 (独立存储)
        await self.repository.save_facts(facts)
        
        return facts
```

---

## 测试

```bash
# 运行所有测试
pytest

# 按层测试
pytest tests/test_identity/  # L0
pytest tests/test_index/      # L1
pytest tests/test_content/    # L2 (核心)
pytest tests/test_knowledge/  # L3

# 查看覆盖率
pytest --cov=agents_mem --cov-report=html
```

---

## 故障排查

### 常见问题

**Q: 为什么找不到 Tiered 层?**  
A: Tiered 是 L2 Content 层的**内置能力**，不是独立层。使用 `tier` 参数访问。

**Q: Vector Search 在哪里?**  
A: Vector Search 是 L1 Index 层的**内置能力**，通过 `search_mode` 参数访问。

**Q: L3 Knowledge 如何访问 L2 Content?**  
A: L3 通过**只读接口**访问 L2，不修改原始内容。

---

## 参考文档

- [4层架构设计](agents-mem-py-DESIGN-v2.md)
- [Markdown导出设计](agents-mem-py-EXPORT-v2.md)
- [架构层分析](architecture-layer-analysis.md)

---

**文档结束**
