# agents-mem-py 架构设计文档 (4层架构)

**版本**: 2.0 | **日期**: 2026-04-15 | **状态**: 4层架构设计  
**目标**: 将6层渐进式架构简化为4层Clean Architecture

---

## 一、架构决策

### 1.1 为什么从6层简化为4层

**原6层架构的问题**:
```
L0: Scope & Identity
L1: Index & Metadata
L2: Documents & Assets
L3: Tiered Content      ← 与L2概念重叠（视图vs存储）
L4: Vector Search       ← 横向穿透，应是索引能力
L5: Facts & Entity Tree ← 依赖复杂，打破单向依赖
```

**核心问题**:
1. **L3不是独立层** - Tiered Content是Documents的**计算视图**，不是独立抽象
2. **L4定位模糊** - Vector Search是**索引能力**，不应是垂直层
3. **L5依赖混乱** - Facts需追溯多层，违反依赖规则

**简化原则** (基于Clean Architecture):
- **视图合并到内容层** - Tiered是Content的呈现方式
- **能力内化到层** - Vector Search是Index层的内置能力
- **知识层独立** - Facts作为独立的知识抽象

### 1.2 新4层架构

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

### 1.3 层间依赖关系

```
L3 (Knowledge)
    ↑ 依赖 (只读访问L2)
L2 (Content) ←────┐
    ↑ 依赖        │
L1 (Index) ───────┼──→ 为L3提供检索
    ↑ 依赖        │
L0 (Identity)     │
                  │
    依赖方向: 向下 → 向上
    (内层不依赖外层)
```

**关键约束**:
- L3 只能读取 L2，不能修改
- L2 只能读取 L1，不能修改
- L1 只能读取 L0，不能修改
- 所有层都可以直接访问 L0 (身份验证)

---

## 二、4层详细设计

### 2.1 L0: Identity Layer (身份层)

**核心职责**:
- 多租户隔离：userId/agentId/teamId 三层作用域
- 权限验证：所有操作必须通过身份验证
- 数据分区：物理隔离不同租户的数据

**类型定义**:
```python
# src/agents_mem/core/types.py

from pydantic import BaseModel, Field
from typing import Optional

class Scope(BaseModel):
    """作用域定义 - 三层隔离"""
    user_id: str = Field(..., description="用户ID，必填")
    agent_id: Optional[str] = Field(None, description="Agent ID，可选")
    team_id: Optional[str] = Field(None, description="团队ID，可选")
    
    class Config:
        frozen = True  # 不可变

class IdentityContext(BaseModel):
    """身份上下文"""
    scope: Scope
    permissions: list[str] = Field(default_factory=list)
    authenticated_at: datetime
```

**与其他层关系**:
- 所有层的**基础依赖**
- L1 通过 Scope 构建 URI
- L2 通过 Scope 过滤数据
- L3 通过 Scope 限制知识范围

**存储**:
```python
# SQLite 表
users: id, name, created_at
agents: id, user_id, name, created_at
teams: id, name, owner_id, created_at
team_members: team_id, agent_id, role
```

---

### 2.2 L1: Index Layer (索引层)

**核心职责**:
- URI 寻址：统一资源定位 `mem://{userId}/{agentId}/{teamId}/{type}/{id}`
- 元数据索引：快速过滤和查找
- 向量搜索：**内置能力**，非独立层

**关键创新：Vector Search 作为内置能力**

原6层将Vector Search作为独立层(L4)，导致：
- 需要理解额外的层概念
- 依赖关系复杂（L4需访问L1, L2, L3）

新4层将Vector Search作为L1的**内置能力**:
```python
# src/agents_mem/index/layer.py

class IndexLayer:
    """索引层 - 包含向量搜索作为内置能力"""
    
    def __init__(self):
        self.uri_system = URISystem()
        self.metadata_index = MetadataIndex()
        self.vector_search = VectorSearchCapability()  # 内置能力
    
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
        # 1. 构建目标URI
        target_uri = self.uri_system.build_target_uri(scope, "documents")
        
        # 2. 元数据过滤
        metadata_results = await self.metadata_index.search(query, scope)
        
        # 3. 向量搜索 (内置能力，非跨层调用)
        if mode in ("semantic", "hybrid"):
            vector_results = await self.vector_search.find(query, target_uri, limit)
        
        # 4. 融合排序
        return self._merge_results(metadata_results, vector_results, mode)
```

**URI 系统**:
```python
# src/agents_mem/core/uri.py

class URISystem:
    """URI 构建与解析"""
    
    SCHEME = "mem"
    
    def build(
        self,
        scope: Scope,
        resource_type: str,
        resource_id: str
    ) -> str:
        """构建 mem:// URI"""
        return f"{self.SCHEME}://{scope.user_id}/{scope.agent_id or '_'}/{scope.team_id or '_'}/{resource_type}/{resource_id}"
    
    def parse(self, uri: str) -> MaterialURI:
        """解析 URI"""
        # mem://user123/agent456/_/documents/doc-789
        pattern = rf"^{self.SCHEME}://([^/]+)/([^/]+)/([^/]+)/([^/]+)/(.+)$"
        match = re.match(pattern, uri)
        return MaterialURI(
            user_id=match.group(1),
            agent_id=None if match.group(2) == "_" else match.group(2),
            team_id=None if match.group(3) == "_" else match.group(3),
            resource_type=match.group(4),
            resource_id=match.group(5)
        )
```

**与其他层关系**:
- L2 通过 URI 定位资源
- L3 通过 Index 搜索知识
- VectorSearch 是**内置能力**，不形成跨层依赖

---

### 2.3 L2: Content Layer (内容层) ⭐ 核心价值

**核心职责**:
- 存储原始内容：Documents, Assets, Conversations, Messages
- **内置分层视图**：L0/L1/L2 渐进式披露作为**内置能力**
- Token 预算控制：**核心价值保持**

**关键创新：Tiered 作为内置视图**

原6层将Tiered作为独立层(L3)，导致：
- 需理解"原始内容 vs 摘要内容"两种概念
- L3与L2紧密耦合

新4层将Tiered作为Content的**计算视图**:
```python
# src/agents_mem/content/layer.py

class ContentLayer:
    """内容层 - 包含分层视图作为内置能力"""
    
    def __init__(self, index_layer: IndexLayer):
        self.index = index_layer
        self.repository = ContentRepository()
        self.tiered_views = TieredViewCapability()  # 内置能力
    
    async def get(
        self,
        uri: str,
        tier: Optional[Tier] = None
    ) -> Content:
        """
        获取内容，支持分层视图
        
        Args:
            uri: 资源URI
            tier: 视图层级 (None=原始, L0=摘要, L1=概览)
        """
        # 1. 解析URI获取资源ID
        parsed = self.index.uri_system.parse(uri)
        
        # 2. 读取原始内容
        content = await self.repository.get(parsed.resource_id)
        
        # 3. 如请求分层视图，调用内置能力
        if tier:
            return await self.tiered_views.get_view(content, tier)
        
        return content
    
    async def search(
        self,
        query: str,
        scope: Scope,
        tier: Tier = "L0",
        mode: SearchMode = "hybrid"
    ) -> list[Content]:
        """
        搜索内容，返回指定层级视图
        
        这是L2的核心价值：
        - 先通过L1的VectorSearch找到相关资源
        - 再返回指定Tier的视图 (默认L0节省Token)
        """
        # 1. 通过L1索引搜索
        results = await self.index.find(query, scope, mode)
        
        # 2. 获取指定Tier的视图 (内置能力)
        contents = []
        for result in results:
            content = await self.get(result.uri, tier=tier)
            contents.append(content)
        
        return contents
```

**分层视图能力**:
```python
# src/agents_mem/content/tiered_capability.py

class TieredViewCapability:
    """分层视图能力 - Content层的内置功能"""
    
    L0_TOKEN_BUDGET = 100
    L1_TOKEN_BUDGET = 2000
    
    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client
        self.cache = TieredCache()
    
    async def get_view(
        self,
        content: Content,
        tier: Tier
    ) -> Content:
        """获取指定层级的视图"""
        
        # 检查缓存
        cached = await self.cache.get(content.id, tier)
        if cached:
            return cached
        
        # 生成视图
        if tier == "L0":
            view = await self._generate_l0(content)
        elif tier == "L1":
            view = await self._generate_l1(content)
        else:  # L2
            view = content
        
        # 缓存并返回
        await self.cache.set(content.id, tier, view)
        return view
    
    async def _generate_l0(self, content: Content) -> str:
        """生成L0摘要 (~100 tokens)"""
        if estimate_tokens(content.body) <= self.L0_TOKEN_BUDGET:
            return content.body
        
        prompt = build_l0_prompt(content.body)
        return await self.llm.generate(prompt, max_tokens=self.L0_TOKEN_BUDGET)
    
    async def _generate_l1(self, content: Content) -> str:
        """生成L1概览 (~2000 tokens)"""
        if estimate_tokens(content.body) <= self.L1_TOKEN_BUDGET:
            return content.body
        
        prompt = build_l1_prompt(content.body)
        return await self.llm.generate(prompt, max_tokens=self.L1_TOKEN_BUDGET)
```

**Token 预算控制保持**:
```python
# 披露流程 (保持不变)
Metadata(~50) → L0(~100) → L1(~2k) → L2(full)
                    ↑
              Token节省80-91%
```

**与其他层关系**:
- 依赖 L1 进行资源定位
- 为 L3 提供原始内容和视图
- **核心价值层**：Token节省

---

### 2.4 L3: Knowledge Layer (知识层)

**核心职责**:
- 事实提取：从内容提取结构化事实
- 实体聚合：构建实体关联网络
- 知识追溯：fact → source → content 完整链路

**设计原则**:
- **只读访问 L2**：Knowledge 只能读取 Content，不能修改
- **独立存储**：Facts 独立存储，不修改原始内容
- **追溯能力**：每个事实可追溯到原始出处

```python
# src/agents_mem/knowledge/layer.py

class KnowledgeLayer:
    """知识层 - 提取和管理结构化知识"""
    
    def __init__(self, content_layer: ContentLayer):
        self.content = content_layer  # 只读依赖
        self.extractor = FactExtractor()
        self.entity_tree = EntityTree()
        self.repository = KnowledgeRepository()
    
    async def extract_facts(
        self,
        content_uri: str,
        scope: Scope
    ) -> list[Fact]:
        """
        从内容提取事实
        
        注意：只读访问L2，不修改原始内容
        """
        # 1. 读取内容 (通过L2，只读)
        content = await self.content.get(content_uri)
        
        # 2. 提取事实
        extracted = await self.extractor.extract(content.body)
        
        # 3. 保存事实 (独立存储)
        facts = []
        for item in extracted:
            fact = Fact(
                id=generate_uuid(),
                content=item.content,
                fact_type=item.type,
                source_uri=content_uri,
                scope=scope,
                confidence=item.confidence
            )
            await self.repository.save_fact(fact)
            facts.append(fact)
        
        return facts
    
    async def trace_fact(self, fact_id: str) -> TraceResult:
        """
        追溯事实来源
        
        链路: Fact → Tiered Content → Original Document
        """
        # 1. 获取事实
        fact = await self.repository.get_fact(fact_id)
        
        # 2. 获取源内容 (通过L2，只读)
        content = await self.content.get(fact.source_uri)
        
        # 3. 获取L0/L1视图 (通过L2的内置能力)
        l0_view = await self.content.tiered_views.get_view(content, "L0")
        l1_view = await self.content.tiered_views.get_view(content, "L1")
        
        return TraceResult(
            fact=fact,
            source_content=content,
            l0_abstract=l0_view,
            l1_overview=l1_view
        )
    
    async def aggregate_entities(
        self,
        scope: Scope,
        threshold: float = 0.7
    ) -> EntityTree:
        """
        聚合实体构建知识图谱
        """
        # 1. 获取范围内的所有事实
        facts = await self.repository.get_facts_by_scope(scope)
        
        # 2. 提取实体
        entities = self.entity_tree.extract_entities(facts)
        
        # 3. 构建关联 (阈值: θ(d) = θ₀ × e^(λd))
        return self.entity_tree.build_tree(entities, threshold)
```

**与其他层关系**:
- 只读依赖 L2 (Content)
- 不依赖 L1 或 L0 (通过L2间接使用)
- 独立存储知识

---

## 三、数据流设计

### 3.1 创建流程

```
用户请求
    ↓
L0: 验证 Scope (身份验证)
    ↓
L1: 构建 URI, 创建索引
    ↓
L2: 存储原始内容
    ├─ 异步: 生成 L0/L1 视图 (内置能力)
    └─ 异步: 添加到向量索引 (L1内置能力)
    ↓
可选 L3: 提取 Facts (知识层增强)
    ↓
返回结果
```

### 3.2 读取流程

```
用户请求 (带 Tier 参数)
    ↓
L0: 验证 Scope
    ↓
L1: 解析 URI 或 搜索索引
    ├─ VectorSearch (内置能力)
    └─ Metadata Filter
    ↓
L2: 获取内容 + Tiered View
    ├─ 如请求 L0: 返回 ~100 tokens 摘要
    ├─ 如请求 L1: 返回 ~2k tokens 概览
    └─ 如请求 L2: 返回完整内容
    ↓
可选 L3: 获取相关 Facts
    ↓
返回结果
```

### 3.3 Token 节省保持

**披露流程** (与6层相同):
```
初始响应: 元数据(~50 tokens)
    ↓ 用户需要更多
按需加载: L0(~100 tokens)  ← 80-91%节省在此
    ↓ 用户需要更多
按需加载: L1(~2k tokens)
    ↓ 用户需要更多
按需加载: L2(完整内容)
    ↓ 需要验证
按需加载: Facts(~1k tokens) + 追溯链
```

---

## 四、与6层架构对比

### 4.1 映射关系

| 6层架构 | 4层架构 | 变化 |
|---------|---------|------|
| L0 Scope | L0 Identity | 相同 |
| L1 Index | L1 Index | 相同 |
| L2 Documents | L2 Content | 扩展 (包含Assets/Conversations) |
| L3 Tiered | **L2内置能力** | ⚠️ 合并 (不再是独立层) |
| L4 Vector | **L1内置能力** | ⚠️ 合并 (不再是独立层) |
| L5 Facts | L3 Knowledge | 重命名 (更清晰) |
| - | L3 Entity Tree | 新增强调 (原6层未实现) |

### 4.2 关键改进

| 维度 | 6层 | 4层 | 改进 |
|------|-----|-----|------|
| **概念清晰度** | L3/L4边界模糊 | Tiered/Vector作为内置能力 | ✅ 更清晰 |
| **认知负荷** | 6层接近上限 | 4层舒适区 | ✅ 更易理解 |
| **依赖关系** | L5依赖多层 | 单向依赖 (L3→L2→L1→L0) | ✅ 更干净 |
| **Token节省** | L3控制 | L2内置能力控制 | ✅ 相同效果 |
| **代码复杂度** | 层间调用多 | 层内聚合 | ✅ 更易维护 |

### 4.3 保持的能力

✅ **Token节省80-91%** - 通过L2的TieredViewCapability保持  
✅ **语义搜索** - 通过L1的VectorSearchCapability保持  
✅ **事实追溯** - 通过L3的Trace保持  
✅ **多租户隔离** - L0保持  
✅ **URI寻址** - L1保持  

---

## 五、项目结构 (4层)

```
agents-mem-py/
├── pyproject.toml
├── src/
│   └── agents_mem/
│       ├── __init__.py
│       ├── mcp_server.py          # FastMCP入口
│       │
│       ├── core/                  # 核心类型 (跨层)
│       │   ├── __init__.py
│       │   ├── types.py           # Scope, URI, Content, Fact
│       │   ├── constants.py       # L0/L1 Token预算
│       │   └── exceptions.py
│       │
│       ├── identity/              # L0: 身份层
│       │   ├── __init__.py
│       │   ├── scope.py           # Scope验证
│       │   ├── auth.py            # 权限控制
│       │   └── repository.py      # users/agents/teams表
│       │
│       ├── index/                 # L1: 索引层
│       │   ├── __init__.py
│       │   ├── layer.py           # IndexLayer主类
│       │   ├── uri.py             # URI系统
│       │   ├── metadata.py        # 元数据索引
│       │   └── capabilities/      # 内置能力
│       │       └── vector_search.py  # VectorSearchCapability
│       │
│       ├── content/               # L2: 内容层 ⭐
│       │   ├── __init__.py
│       │   ├── layer.py           # ContentLayer主类
│       │   ├── repository.py      # 内容存储
│       │   ├── capabilities/      # 内置能力
│       │   │   └── tiered.py      # TieredViewCapability
│       │   └── resources/         # 资源类型
│       │       ├── document.py
│       │       ├── asset.py
│       │       └── conversation.py
│       │
│       ├── knowledge/             # L3: 知识层
│       │   ├── __init__.py
│       │   ├── layer.py           # KnowledgeLayer主类
│       │   ├── facts.py           # 事实提取
│       │   ├── entities.py        # 实体聚合
│       │   ├── trace.py           # 追溯链
│       │   └── repository.py      # facts表
│       │
│       ├── export/                # Markdown导出 (增强)
│       │   ├── __init__.py
│       │   ├── exporter.py
│       │   └── templates/
│       │
│       ├── sqlite/                # 基础设施
│       │   └── ...
│       │
│       ├── embedder/            # Ollama嵌入客户端
│       │   └── ...
│       │
│       └── tools/                 # MCP工具
│           └── handlers.py
│
└── tests/
    ├── test_identity/             # L0测试
    ├── test_index/                # L1测试
    ├── test_content/              # L2测试
    └── test_knowledge/            # L3测试
```

---

## 六、技术选型

### 6.1 核心依赖

```toml
[project]
dependencies = [
    # MCP
    "mcp>=1.0.0",
    
    # HTTP客户端
    "httpx>=0.27.0",
    
    # 数据库
    "aiosqlite>=0.20.0",
    
    # 数据验证
    "pydantic>=2.0.0",
    
    # Embedding
    "ollama>=0.1.0",
    
    # 模板
    "jinja2>=3.1.0",
]
```

### 6.2 关键类图

```
┌──────────────────────────────────────────────────────────────┐
│                        MCP Server                            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      IdentityLayer (L0)                      │
│  - Scope验证                                                  │
│  - 权限控制                                                   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                       IndexLayer (L1)                        │
│  - URISystem                                                  │
│  - MetadataIndex                                              │
│  - VectorSearchCapability (内置)                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      ContentLayer (L2) ⭐                    │
│  - ContentRepository                                          │
│  - TieredViewCapability (内置)                               │
│    - L0_TOKEN_BUDGET = 100                                   │
│    - L1_TOKEN_BUDGET = 2000                                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ (只读)
┌──────────────────────────────────────────────────────────────┐
│                     KnowledgeLayer (L3)                      │
│  - FactExtractor                                              │
│  - EntityTree                                                 │
│  - Trace                                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 七、关键决策总结

### 7.1 为什么4层优于6层

| 决策 | 6层问题 | 4层解决 | 效果 |
|------|---------|---------|------|
| **Tiered合并** | L3与L2紧密耦合，概念重叠 | Tiered作为L2内置视图 | ✅ 概念清晰 |
| **Vector内化** | L4横向穿透，定位模糊 | Vector作为L1内置能力 | ✅ 依赖干净 |
| **Facts独立** | L5依赖混乱 | L3 Knowledge只读依赖L2 | ✅ 单向依赖 |
| **认知负荷** | 6层接近7±2上限 | 4层在舒适区 | ✅ 更易理解 |

### 7.2 保持的核心价值

✅ **渐进式披露** - TieredViewCapability保持  
✅ **Token节省** - L0/L1预算控制保持  
✅ **语义搜索** - VectorSearchCapability保持  
✅ **多租户隔离** - IdentityLayer保持  
✅ **知识追溯** - KnowledgeLayer增强  

### 7.3 实施建议

1. **阶段1**: 实现 L0 + L1 (基础框架)
2. **阶段2**: 实现 L2 + TieredViewCapability (核心价值)
3. **阶段3**: 实现 L3 KnowledgeLayer (知识增强)
4. **阶段4**: 实现 Markdown导出 (透明可读)

---

## 八、参考

- [原始6层设计](agents-mem-6layer-DESIGN.md)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [DDD Layered Architecture](https://dddcommunity.org/library/vernon_2011/)

---

**文档结束**
