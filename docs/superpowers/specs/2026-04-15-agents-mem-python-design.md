# agents-mem Python 重写设计文档

**版本**: 1.0 | **日期**: 2026-04-15 | **状态**: 已批准
**目标**: 将 TypeScript 6层记忆系统完全重写为 Python 4层 Clean Architecture

---

## 一、项目概述

### 1.1 背景

现有 `agents-mem` 项目使用 TypeScript/Bun 实现6层渐进式记忆系统。为提升可维护性、降低认知负荷，决定使用 Python 重写，并将架构简化为4层。

### 1.2 核心目标

- **Token 成本节省 80-91%** - 通过 L0/L1/L2 分层加载
- **支持 169+ agents** - 多租户隔离 (userId/agentId/teamId)
- **Clean Architecture** - 严格单向依赖 L3→L2→L1→L0
- **MCP 兼容** - 4个标准工具 (mem_create/read/update/delete)
- **Markdown 导出** - L2 Content + L3 Knowledge 分层导出

### 1.3 技术栈

| 组件 | 选择 | 版本 |
|------|------|------|
| 运行时 | Python | 3.12+ |
| 依赖管理 | uv + pyproject.toml | latest |
| 数据库 | aiosqlite | 0.20.0+ |
| 数据验证 | Pydantic | 2.0+ |
| HTTP 客户端 | httpx | 0.27.0+ |
| MCP SDK | mcp (FastMCP) | 1.0.0+ |
| 测试 | pytest + pytest-asyncio | latest |
| 类型检查 | mypy | strict mode |
| Lint | ruff | latest |
| Embedding | ollama Python SDK | 0.1.0+ |
| 模板 | Jinja2 | 3.1.0+ (导出) |

---

## 二、4层架构设计

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────┐
│  L3: Knowledge Layer (知识层)                           │
│  ├─ Facts (事实提取与验证)                              │
│  ├─ Entity Tree (实体聚合与关联)                        │
│  └─ Trace (事实追溯链)                                  │
├─────────────────────────────────────────────────────────┤
│  L2: Content Layer (内容层) ⭐ 核心价值                  │
│  ├─ Documents/Assets (原始内容存储)                     │
│  ├─ Tiered Views (L0/L1/L2 分层视图 - 内置能力)        │
│  └─ Conversations/Messages (会话内容)                   │
├─────────────────────────────────────────────────────────┤
│  L1: Index Layer (索引层)                               │
│  ├─ URI System (mem:// 寻址)                            │
│  ├─ Metadata Index (元数据索引)                         │
│  └─ Vector Search (语义搜索 - 内置能力)                 │
├─────────────────────────────────────────────────────────┤
│  L0: Identity Layer (身份层)                            │
│  ├─ Scope (userId/agentId/teamId)                       │
│  └─ Access Control (权限控制)                           │
└─────────────────────────────────────────────────────────┘
```

### 2.2 层间依赖关系

```
L3 (Knowledge)
    ↑ 只读依赖 (访问 L2, 不修改)
L2 (Content)
    ↑ 依赖 (调用 L1 的 URI/搜索能力)
L1 (Index)
    ↑ 依赖 (使用 L0 的 Scope)
L0 (Identity)
```

**关键约束**:
- L3 只能读取 L2，不能修改
- L2 只能读取 L1，不能修改
- L1 只能读取 L0，不能修改
- 所有层都可以直接访问 L0 (身份验证)

### 2.3 与6层架构对比

| 6层架构 | 4层架构 | 变化 |
|---------|---------|------|
| L0 Scope | L0 Identity | 相同 |
| L1 Index | L1 Index | 相同 |
| L2 Documents | L2 Content | 扩展 (包含 Assets/Conversations) |
| L3 Tiered | **L2内置能力** | ⚠️ 合并 (不再是独立层) |
| L4 Vector | **L1内置能力** | ⚠️ 合并 (不再是独立层) |
| L5 Facts | L3 Knowledge | 重命名 (更清晰) |

---

## 三、详细层设计

### 3.1 L0: Identity Layer (身份层)

**核心职责**:
- 多租户隔离: userId/agentId/teamId 三层作用域
- 权限验证: 所有操作必须通过身份验证
- 数据分区: 物理隔离不同租户的数据

**类型定义** (`src/agents_mem/core/types.py`):

```python
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional

class Scope(BaseModel):
    """作用域定义 - 三层隔离"""
    model_config = ConfigDict(frozen=True)
    
    user_id: str = Field(..., description="用户ID，必填")
    agent_id: Optional[str] = Field(None, description="Agent ID，可选")
    team_id: Optional[str] = Field(None, description="团队ID，可选")

class IdentityContext(BaseModel):
    """身份上下文"""
    scope: Scope
    permissions: list[str] = Field(default_factory=list)
    authenticated_at: datetime
```

**SQLite 表**:

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at INTEGER  -- Unix 秒
);

CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT,
    owner_id TEXT NOT NULL,
    created_at INTEGER,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE team_members (
    team_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    PRIMARY KEY (team_id, agent_id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);
```

**接口** (`src/agents_mem/identity/layer.py`):

```python
class IdentityLayer:
    async def validate_scope(self, scope: Scope) -> IdentityContext
    async def create_user(self, user_id: str, name: str) -> User
    async def create_agent(self, agent_id: str, user_id: str, name: str) -> Agent
    async def create_team(self, team_id: str, owner_id: str, name: str) -> Team
    async def add_team_member(self, team_id: str, agent_id: str, role: str) -> None
    async def check_permission(self, scope: Scope, permission: str) -> bool
```

---

### 3.2 L1: Index Layer (索引层)

**核心职责**:
- URI 寻址: 统一资源定位 `mem://{userId}/{agentId}/{teamId}/{type}/{id}`
- 元数据索引: 快速过滤和查找
- 向量搜索: **内置能力**，非独立层

**URI 系统** (`src/agents_mem/core/uri.py`):

```python
class URISystem:
    SCHEME = "mem"
    
    def build(self, scope: Scope, resource_type: str, resource_id: str) -> str:
        """构建 mem:// URI"""
        agent = scope.agent_id or "_"
        team = scope.team_id or "_"
        return f"{self.SCHEME}://{scope.user_id}/{agent}/{team}/{resource_type}/{resource_id}"
    
    def parse(self, uri: str) -> ParsedURI:
        """解析 URI"""
        # mem://user123/agent456/_/documents/doc-789
        pattern = rf"^{self.SCHEME}://([^/]+)/([^/]+)/([^/]+)/([^/]+)/(.+)$"
        match = re.match(pattern, uri)
        return ParsedURI(
            user_id=match.group(1),
            agent_id=None if match.group(2) == "_" else match.group(2),
            team_id=None if match.group(3) == "_" else match.group(3),
            resource_type=match.group(4),
            resource_id=match.group(5)
        )
```

**向量搜索内置能力** (`src/agents_mem/index/capabilities/vector_search.py`):

```python
class VectorSearchCapability:
    def __init__(self, openviking_client: OpenVikingClient):
        self.client = openviking_client
    
    async def find(
        self,
        query: str,
        target_uri: str,
        limit: int = 10
    ) -> list[VectorResult]:
        """语义搜索"""
        return await self.client.search(
            query=query,
            context=target_uri,
            limit=limit
        )
```

**接口** (`src/agents_mem/index/layer.py`):

```python
class IndexLayer:
    def __init__(self):
        self.uri_system = URISystem()
        self.metadata_index = MetadataIndex()
        self.vector_search = VectorSearchCapability()
    
    async def find(
        self,
        query: str,
        scope: Scope,
        mode: SearchMode = "hybrid",
        limit: int = 10
    ) -> list[SearchResult]:
        """
        统一搜索入口
        - mode="fts": 仅元数据搜索
        - mode="semantic": 仅向量搜索
        - mode="hybrid": 混合搜索 (FTS + Vector + RRF)
        """
```

---

### 3.3 L2: Content Layer (内容层) ⭐

**核心职责**:
- 存储原始内容: Documents, Assets, Conversations, Messages
- **内置分层视图**: L0/L1/L2 渐进式披露
- Token 预算控制: **核心价值保持**

**Token 预算**:

```python
class TieredViewCapability:
    L0_TOKEN_BUDGET = 100
    L1_TOKEN_BUDGET = 2000
    
    async def get_view(self, content: Content, tier: Tier) -> str:
        """获取指定层级的视图"""
        if tier == "L0":
            return await self._generate_l0(content)
        elif tier == "L1":
            return await self._generate_l1(content)
        else:  # L2
            return content.body
```

**披露流程**:

```
Metadata(~50) → L0(~100) → L1(~2k) → L2(full)
                    ↑
              Token节省80-91%
```

**接口** (`src/agents_mem/content/layer.py`):

```python
class ContentLayer:
    def __init__(self, index_layer: IndexLayer):
        self.index = index_layer
        self.repository = ContentRepository()
        self.tiered_views = TieredViewCapability()
    
    async def get(self, uri: str, tier: Optional[Tier] = None) -> Content:
        """获取内容，支持分层视图"""
    
    async def search(
        self,
        query: str,
        scope: Scope,
        tier: Tier = "L0",
        mode: SearchMode = "hybrid"
    ) -> list[Content]:
        """搜索内容，返回指定层级视图"""
```

---

### 3.4 L3: Knowledge Layer (知识层)

**核心职责**:
- 事实提取: 从内容提取结构化事实
- 实体聚合: 构建实体关联网络
- 知识追溯: fact → source → content 完整链路

**设计原则**:
- **只读访问 L2**: Knowledge 只能读取 Content，不能修改
- **独立存储**: Facts 独立存储，不修改原始内容
- **追溯能力**: 每个事实可追溯到原始出处

**接口** (`src/agents_mem/knowledge/layer.py`):

```python
class KnowledgeLayer:
    def __init__(self, content_layer: ContentLayer):
        self.content = content_layer  # 只读依赖
        self.extractor = FactExtractor()
        self.entity_tree = EntityTree()
        self.repository = KnowledgeRepository()
    
    async def extract_facts(self, content_uri: str, scope: Scope) -> list[Fact]:
        """从内容提取事实 (只读访问 L2)"""
    
    async def trace_fact(self, fact_id: str) -> TraceResult:
        """追溯事实来源: Fact → Tiered Content → Original Document"""
    
    async def aggregate_entities(self, scope: Scope, threshold: float = 0.7) -> EntityTree:
        """聚合实体构建知识图谱"""
```

---

## 四、MCP 服务器设计

### 4.1 工具定义

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("agents-mem-py")

@mcp.tool()
async def mem_create(
    resource: Literal["document", "asset", "conversation", "message", "fact", "team"],
    data: dict,
    scope: dict
) -> dict:
    """创建资源"""

@mcp.tool()
async def mem_read(
    resource: Literal["document", "asset", "conversation", "message", "fact", "team"],
    query: dict,
    scope: dict
) -> dict:
    """读取/搜索/列表/分层资源"""

@mcp.tool()
async def mem_update(
    resource: Literal["document", "asset", "conversation", "message", "fact", "team"],
    id: str,
    data: dict,
    scope: dict
) -> dict:
    """更新资源 (验证 scope)"""

@mcp.tool()
async def mem_delete(
    resource: Literal["document", "asset", "conversation", "message", "fact", "team"],
    id: str,
    scope: dict
) -> dict:
    """删除资源 (级联)"""
```

### 4.2 mem_read 查询格式

```python
# ID 查询
{"id": "doc-123"}

# 搜索
{"search": "关键词", "search_mode": "hybrid", "limit": 10}

# 分层读取
{"id": "doc-123", "tier": "L0"}  # L0/L1/L2

# 追溯
{"id": "fact-123", "trace": True}

# 列表
{"list": True, "filters": {...}}
```

**搜索模式**:
- `hybrid` - FTS + Vector + RRF 重排序 (默认, 推荐中文)
- `fts` - BM25 全文搜索
- `semantic` - 纯向量语义搜索
- `progressive` - L0 层快速筛选

---

## 五、Markdown 导出设计

### 5.1 导出目录结构

```
~/.agents_mem/export/{user_id}/
├── README.md
├── L2-content/              # Content 层导出
│   ├── documents/
│   │   └── 2025-04/
│   │       └── doc-001.md   # 包含 L0/L1/L2 三层视图
│   └── tiered-preferences.md
└── L3-knowledge/            # Knowledge 层导出
    ├── facts/
    │   └── 2025-04/
    │       └── fact-001.md
    └── entities/
        └── entity-graph.md
```

### 5.2 导出 API

```python
@mcp.tool()
async def mem_export(
    scope: dict = None,
    layer: Literal["L2", "L3", "all"] = "all",
    content_type: str = None,
    fact_type: str = None,
    since: str = None,
    include_tiered: bool = True,
    include_entities: bool = False
) -> dict:
    """导出记忆数据"""
```

### 5.3 L2 Content 导出示例

```markdown
---
id: doc-001
uri: mem://user123/agent456/_/documents/doc-001
created_at: 2025-04-15T10:00:00Z
---

# 文档: doc-001

## L0 快速摘要 (~100 tokens)
用户偏好素食饮食，不吃辛辣食物。

## L1 详细概览 (~2000 tokens)
### 摘要
本文档记录了用户的基本偏好设置...

### 关键点
- **饮食**: 严格的素食主义者
- **工作时间**: 每日 9:00-18:00

## L2 完整内容
[原始完整内容...]

## 关联知识 (L3)
- [fact-001: 素食偏好](../../L3-knowledge/facts/2025-04/fact-001.md)
```

---

## 六、SQLite 数据库设计

### 6.1 表清单 (13张表)

| 层 | 表名 | 用途 |
|----|------|------|
| L0 | `users`, `agents`, `teams`, `team_members` | 身份与关系 |
| L1 | `memory_index` | URI 索引、元数据过滤、标签 |
| L2 | `documents`, `assets` | 原始文档和文件资产 |
| L2 | `conversations`, `messages` | 对话记录 |
| L3 | `facts`, `extraction_status` | 原子事实及提取状态 |
| L2 | `tiered_content` | L0 abstract / L1 overview |
| 审计 | `memory_access_log` | CRUD 操作审计追踪 |

### 6.2 Schema 版本

- **版本**: 2
- **迁移管理器**: 支持版本化升级
- **时间戳**: Unix 秒 (`int(time.time())`)

### 6.3 关键索引

```sql
CREATE INDEX idx_memory_index_scope ON memory_index(user_id, agent_id, team_id);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_facts_scope ON facts(user_id, agent_id);
CREATE INDEX idx_tiered_content_uri ON tiered_content(original_uri);
```

---

## 七、OpenViking 集成

### 7.1 配置

```bash
OPENVIKING_BASE_URL=http://localhost:1933
OPENVIKING_API_KEY=your-api-key
OPENVIKING_TIMEOUT=30
OPENVIKING_MAX_RETRIES=3
```

### 7.2 URI 转换

```python
# 存储: mem:// -> viking://
mem://user123/agent456/_/documents/doc-abc
  → viking://default/user123/resources/documents/doc-abc

# 由 URIAdapter 处理转换
```

### 7.3 API 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/v1/resources` | POST | 添加资源 (自动 embedding + FTS) |
| `/api/v1/search/find` | POST | 语义搜索 |
| `/api/v1/content/abstract` | GET | L0 概览 |
| `/api/v1/content/overview` | GET | L1 概要 |
| `/api/v1/content/read` | GET | L2 完整内容 |
| `/api/v1/fs` | DELETE | 删除资源 |

---

## 八、项目结构

```
agents-mem/
├── pyproject.toml
├── .env.example
├── README.md
├── AGENTS.md
│
├── src/
│   └── agents_mem/
│       ├── __init__.py
│       ├── mcp_server.py          # FastMCP 入口
│       │
│       ├── core/                  # 核心类型 (跨层)
│       │   ├── __init__.py
│       │   ├── types.py           # Scope, URI, Content, Fact
│       │   ├── constants.py       # L0/L1 Token 预算
│       │   └── exceptions.py
│       │
│       ├── identity/              # L0: 身份层
│       │   ├── __init__.py
│       │   ├── layer.py
│       │   ├── scope.py
│       │   └── repository.py
│       │
│       ├── index/                 # L1: 索引层
│       │   ├── __init__.py
│       │   ├── layer.py
│       │   ├── uri.py
│       │   ├── metadata.py
│       │   └── capabilities/
│       │       └── vector_search.py
│       │
│       ├── content/               # L2: 内容层 ⭐
│       │   ├── __init__.py
│       │   ├── layer.py
│       │   ├── repository.py
│       │   └── capabilities/
│       │       └── tiered.py
│       │
│       ├── knowledge/             # L3: 知识层
│       │   ├── __init__.py
│       │   ├── layer.py
│       │   ├── facts.py
│       │   ├── entities.py
│       │   └── trace.py
│       │
│       ├── export/                # Markdown 导出
│       │   ├── __init__.py
│       │   ├── exporter.py
│       │   └── templates/
│       │
│       ├── sqlite/                # 基础设施
│       │   ├── __init__.py
│       │   ├── connection.py
│       │   ├── schema.py
│       │   └── migrations.py
│       │
│       ├── openviking/            # OpenViking 客户端
│       │   ├── __init__.py
│       │   ├── client.py
│       │   └── uri_adapter.py
│       │
│       └── tools/                 # MCP 工具
│           └── handlers.py
│
└── tests/
    ├── conftest.py
    ├── test_identity/
    ├── test_index/
    ├── test_content/
    └── test_knowledge/
```

---

## 九、实施计划

### 阶段 1: 基础框架 (L0 + L1)

**目标**: 实现身份层和索引层，建立项目基础

**任务**:
1. 创建 pyproject.toml + uv 配置
2. 实现 L0 IdentityLayer (Scope, Auth, Repository)
3. 实现 L1 IndexLayer (URI System, Metadata Index)
4. SQLite 基础设施 (connection, schema, migrations)
5. 基础测试 (L0/L0 单元测试)

**验收标准**:
- `pytest tests/test_identity/` 通过
- `pytest tests/test_index/` 通过
- `mypy src/agents_mem/identity/` 无错误
- `ruff check src/agents_mem/identity/` 无错误

### 阶段 2: 核心价值 (L2 + TieredViewCapability)

**目标**: 实现内容层和分层视图，保持 Token 节省核心价值

**任务**:
1. 实现 L2 ContentLayer (Document/Asset/Conversation 存储)
2. 实现 TieredViewCapability (L0/L1/L2 分层视图)
3. 实现 Token 预算控制 (80-91% 节省)
4. OpenViking 集成 (Vector Search)
5. 完整测试 (L2 单元测试 + 集成测试)

**验收标准**:
- `pytest tests/test_content/` 通过
- L0/L1 视图生成正确
- Token 估算准确 (误差 < 10%)
- OpenViking 搜索正常

### 阶段 3: 知识增强 (L3 KnowledgeLayer)

**目标**: 实现知识层，事实提取和追溯

**任务**:
1. 实现 L3 KnowledgeLayer (Fact 提取, Entity 聚合)
2. 实现 Trace 追溯链 (fact → source → content)
3. 只读依赖 L2 (严格遵守 Clean Architecture)
4. 测试

**验收标准**:
- `pytest tests/test_knowledge/` 通过
- 事实提取正确
- 追溯链完整 (fact → tiered → document)
- L3 不修改 L2 内容 (通过测试验证)

### 阶段 4: 完整功能 (MCP Server + Export)

**目标**: 实现 MCP 服务器和导出功能，完成项目

**任务**:
1. FastMCP 服务器 (4个工具: mem_create/read/update/delete)
2. Markdown 导出 (L2 Content + L3 Knowledge)
3. Jinja2 模板
4. 端到端测试
5. 类型检查 + lint + 覆盖率报告

**验收标准**:
- `pytest tests/` 100% 覆盖
- `mypy src/` 无错误
- `ruff check src/` 无错误
- MCP 工具正常工作
- 导出文件正确生成

---

## 十、风险与缓解

| 风险 | 影响 | 概率 | 缓解策略 |
|------|------|------|----------|
| Python 异步生态差异 | 中 | 低 | 使用 aiosqlite + httpx，成熟稳定 |
| MCP SDK 功能差异 | 低 | 低 | FastMCP 提供等价功能 |
| OpenViking URI 适配 | 低 | 低 | 复用 TypeScript 的 URI 转换逻辑 |
| Token 估算准确性 | 中 | 中 | 使用 tiktoken 库，与 TypeScript 版本对齐 |
| 测试覆盖率 100% | 高 | 中 | TDD 驱动，pytest-cov 强制 |
| LLM 调用失败 | 中 | 中 | 降级策略 (截断内容作为备选) |

---

## 十一、关键约束

| 约束 | 值 | 说明 |
|------|-----|------|
| Scope 必需 | userId 必填 | 所有操作必须提供 user_id |
| SQLite 蛇形命名 | user_id, created_at | 数据库字段使用蛇形命名 |
| Unix 秒时间戳 | `int(time.time())` | 非毫秒 |
| Token 预算 | L0≈100, L1≈2000 | 分层视图的 Token 上限 |
| 重试策略 | maxRetries=3, delay=100ms | HTTP 请求重试 |
| 测试覆盖率 | 100% | TDD 驱动 |
| 文件限制 | 单文件 <= 500 行 | 可维护性 |
| 依赖方向 | L3→L2→L1→L0 | 严格单向，禁止循环 |

---

## 十二、测试策略

### 12.1 测试框架

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-cov>=4.0",
    "mypy>=1.8",
    "ruff>=0.3",
]
```

### 12.2 测试命令

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

# 类型检查
mypy src/agents_mem/ --strict

# Lint
ruff check src/agents_mem/
```

### 12.3 测试覆盖目标

| 模块 | 目标覆盖率 | 说明 |
|------|-----------|------|
| identity/ | 100% | L0 核心 |
| index/ | 100% | L1 核心 |
| content/ | 100% | L2 核心 (最重要) |
| knowledge/ | 100% | L3 核心 |
| export/ | 100% | 导出功能 |
| tools/ | 100% | MCP 工具 |

---

## 十三、Git 工作流

```bash
# 1. 从 origin/main 创建新分支
git fetch origin
git checkout -b migrate-to-python-v2 origin/main

# 2. 删除 TypeScript 源代码
rm -rf src/ tests/ package.json bun.lock tsconfig.json

# 3. 创建 Python 项目
#    - pyproject.toml
#    - src/agents_mem/ (4层架构)
#    - tests/ (按层组织)

# 4. 分阶段实现 (4个阶段)
#    每个阶段完成后提交 commit

# 5. 测试验证
pytest && mypy src/ --strict && ruff check src/

# 6. 合并回 main
git checkout main
git merge migrate-to-python-v2
```

---

## 十四、参考文档

- [4层架构设计](../../agents-mem-py-DESIGN-v2.md)
- [Markdown导出设计](../../agents-mem-py-EXPORT-v2.md)
- [快速开始指南](../../agents-mem-py-QUICKSTART-v2.md)
- [原始6层设计](../DESIGN.md)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

**文档结束**
