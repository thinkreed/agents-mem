# 4层架构迁移指南

**版本**: 1.0 | **日期**: 2026-04-15  
**目标**: 从6层架构迁移到4层架构的完整指南

---

## 一、迁移概述

### 1.1 为什么要迁移

| 6层问题 | 4层解决 | 收益 |
|---------|---------|------|
| L3 Tiered 与 L2 紧密耦合 | Tiered 作为 L2 内置能力 | ✅ 概念清晰 |
| L4 Vector Search 横向穿透 | Vector 作为 L1 内置能力 | ✅ 依赖干净 |
| 6层接近认知负荷上限 | 4层在舒适区 | ✅ 更易理解 |
| L5 依赖混乱 | L3 单向依赖 L2 | ✅ 架构干净 |

### 1.2 核心变化

```
6层架构                          4层架构
─────────────────────────────────────────────────
L0 Scope & Identity      →      L0 Identity (相同)
L1 Index & Metadata      →      L1 Index (相同)
L2 Documents & Assets    →      L2 Content (扩展)
L3 Tiered Content        →      L2 TieredView (内置能力) ⚠️ 合并
L4 Vector Search         →      L1 VectorSearch (内置能力) ⚠️ 合并
L5 Facts & Entity Tree   →      L3 Knowledge (重命名)
```

---

## 二、逐层迁移指南

### 2.1 L0: Identity → Identity (无变化)

**状态**: ✅ 无需迁移

**原因**:
- L0 在两种架构中完全相同
- Scope 定义不变
- 权限控制不变

**代码对比**:
```typescript
// 6层
interface Scope { userId: string; agentId?: string; teamId?: string; }

// 4层 (相同)
class Scope(BaseModel):
    user_id: str
    agent_id: Optional[str] = None
    team_id: Optional[str] = None
```

---

### 2.2 L1: Index → Index (增强)

**状态**: ⚠️ 需要调整

**变化**:
- 添加 VectorSearch 作为**内置能力**
- 原 L4 的 HTTP 客户端移到 L1
- search 方法统一入口

**迁移前 (6层)**:
```typescript
// L1: 仅负责 URI + Metadata
class IndexLayer {
    buildURI(...) → string
    parseURI(...) → MaterialURI
}

// L4: 独立的 Vector Search 层
class VectorLayer {
    async find(...) → SearchResult  // 跨层调用
}
```

**迁移后 (4层)**:
```python
# L1: Index + VectorSearch (内置能力)
class IndexLayer:
    def __init__(self):
        self.uri_system = URISystem()
        self.metadata_index = MetadataIndex()
        self.vector_search = VectorSearchCapability()  # 内置
    
    async def find(self, query, scope, mode="hybrid"):
        # 统一搜索入口
        # mode="fts": 仅元数据
        # mode="semantic": 仅向量 (内置能力)
        # mode="hybrid": 混合
        pass
```

**迁移步骤**:
1. [ ] 将 `openviking/http_client.ts` 移到 `index/capabilities/vector_search.py`
2. [ ] 重命名 `VectorLayer` 为 `VectorSearchCapability`
3. [ ] 在 `IndexLayer` 中初始化 `VectorSearchCapability`
4. [ ] 统一搜索入口到 `IndexLayer.find()`

---

### 2.3 L2+L3: Documents + Tiered → Content (关键合并)

**状态**: 🔴 需要重构

**变化**:
- L3 Tiered Content **合并**到 L2 作为内置能力
- L2 更名为 Content Layer (扩展职责)
- TieredView 不再是独立层

**迁移前 (6层)**:
```typescript
// L2: 原始存储
class DocumentLayer {
    async create(data) → Document
    async get(id) → Document  // 返回完整内容
}

// L3: 独立的分层生成
class TieredLayer {
    async generateL0(content) → string
    async generateL1(content) → string
    // 需要调用 L2 获取内容
}

// 使用: 需要分别调用两层
const doc = await documentLayer.get(id);
const l0 = await tieredLayer.generateL0(doc.content);
```

**迁移后 (4层)**:
```python
# L2: Content + TieredView (内置能力)
class ContentLayer:
    def __init__(self, index_layer):
        self.index = index_layer
        self.repository = ContentRepository()
        self.tiered_views = TieredViewCapability()  # 内置
    
    async def get(self, uri, tier=None):
        """
        统一获取内容
        
        tier=None: 返回原始内容
        tier="L0": 返回L0摘要 (~100 tokens)
        tier="L1": 返回L1概览 (~2000 tokens)
        tier="L2": 返回完整内容
        """
        content = await self.repository.get(uri)
        
        if tier:
            return await self.tiered_views.get_view(content, tier)
        
        return content
    
    async def search(self, query, scope, tier="L0", mode="hybrid"):
        """搜索并返回指定Tier的视图"""
        results = await self.index.find(query, scope, mode)
        return [await self.get(r.uri, tier) for r in results]
```

**迁移步骤**:
1. [ ] 创建 `content/layer.py` (新L2)
2. [ ] 将 `sqlite/documents.ts` 移到 `content/repository.py`
3. [ ] 将 `tiered/generator.ts` 重构为 `content/capabilities/tiered.py`
4. [ ] 重命名 `TieredGenerator` 为 `TieredViewCapability`
5. [ ] 修改 `get()` 方法支持 `tier` 参数
6. [ ] 更新所有调用点 (从分别调用两层 → 调用L2带tier参数)

**调用方式对比**:

```typescript
// 6层: 需要分别调用
const doc = await documentLayer.get(id);
const l0 = await tieredLayer.generateL0(doc.content);
```

```python
# 4层: 统一调用
content = await content_layer.get(uri, tier="L0")
```

---

### 2.4 L5: Facts → Knowledge (重命名+增强)

**状态**: 🟡 需要重命名

**变化**:
- L5 更名为 L3 Knowledge
- 强调"知识层"概念
- 添加 Entity Tree (原6层未实现)
- 追溯链增强

**迁移前 (6层)**:
```typescript
// L5: Facts (独立层)
class FactLayer {
    async extract(content) → Fact[]
    async get(id) → Fact
    // 依赖 L2, L3
}
```

**迁移后 (4层)**:
```python
# L3: Knowledge (独立层)
class KnowledgeLayer:
    def __init__(self, content_layer):
        self.content = content_layer  # 只读依赖
        self.extractor = FactExtractor()
        self.entity_tree = EntityTree()  # 新增
        self.repository = KnowledgeRepository()
    
    async def extract_facts(self, content_uri, scope) → list[Fact]:
        # 读取L2 (只读)
        content = await self.content.get(content_uri)
        # 提取并保存
        pass
    
    async def trace_fact(self, fact_id) → TraceResult:
        # 增强追溯链
        pass
    
    async def aggregate_entities(self, scope) → EntityTree:
        # 新增实体聚合
        pass
```

**迁移步骤**:
1. [ ] 重命名目录 `facts/` → `knowledge/`
2. [ ] 重命名 `FactLayer` → `KnowledgeLayer`
3. [ ] 创建 `knowledge/entities.py` (新增)
4. [ ] 增强追溯链功能
5. [ ] 确保 L3 只读依赖 L2

---

## 三、数据流迁移

### 3.1 创建流程

**6层流程**:
```
用户请求
    ↓
L0 Scope验证
    ↓
L1 URI + Index
    ↓
L2 Documents存储
    ↓
L3 Tiered生成 (异步)
    ↓
L4 Vector索引 (异步)
    ↓
L5 Facts提取 (可选异步)
    ↓
返回
```

**4层流程**:
```
用户请求
    ↓
L0 Identity验证
    ↓
L1 Index (+ VectorSearch内置)
    ↓
L2 Content存储
    ├─ 异步: TieredView生成 (内置能力)
    └─ 异步: Vector索引 (L1内置能力)
    ↓
L3 Knowledge提取 (可选异步)
    ↓
返回
```

**关键变化**:
- Tiered生成 从 L3 → L2 内置
- Vector索引 从 L4 → L1 内置
- 减少跨层调用

### 3.2 读取流程

**6层流程**:
```
用户请求 (带tier)
    ↓
L0 Scope
    ↓
L1 URI/Search
    ↓
L2 Documents (获取完整内容)
    ↓
L3 Tiered (生成指定tier) ⚠️ 跨层
    ↓
返回
```

**4层流程**:
```
用户请求 (带tier)
    ↓
L0 Identity
    ↓
L1 Index/Search (含VectorSearch)
    ↓
L2 Content.get(tier=?) (内置TieredView)
    ↓
返回
```

**关键改进**:
- 减少一次跨层调用
- Tiered 在 L2 内部完成

---

## 四、API 迁移对照表

### 4.1 MCP 工具

| 6层调用 | 4层调用 | 变化 |
|---------|---------|------|
| `mem_create(resource, data, scope)` | 相同 | ✅ 无变化 |
| `mem_read(resource, {id}, scope)` | 相同 | ✅ 无变化 |
| `mem_read(resource, {id, tier}, scope)` | 相同 | ✅ 无变化 |
| `mem_read(resource, {search, searchMode}, scope)` | 相同 | ✅ 无变化 |
| `mem_update(...)` | 相同 | ✅ 无变化 |
| `mem_delete(...)` | 相同 | ✅ 无变化 |

**结论**: MCP 工具接口**完全兼容**

### 4.2 内部调用

| 6层内部 | 4层内部 | 变化 |
|---------|---------|------|
| `tieredLayer.generateL0(content)` | `contentLayer.tiered_views.get_view(content, "L0")` | ⚠️ 方法调用变化 |
| `vectorLayer.find(query)` | `indexLayer.vector_search.find(query)` | ⚠️ 对象层级变化 |
| `factLayer.extract(contentId)` | `knowledgeLayer.extract_facts(uri, scope)` | ⚠️ 重命名+参数 |

---

## 五、代码迁移示例

### 5.1 完整示例: 文档创建与读取

**6层实现**:
```typescript
// handlers.ts (6层)
async function handleCreateDocument(data, scope) {
    // L0: 验证
    validateScope(scope);
    
    // L1: 构建URI
    const uri = buildURI(scope, 'documents', generateId());
    
    // L2: 存储
    const doc = await documentLayer.create({
        id: uri.id,
        ...data,
        scope
    });
    
    // L3: 生成Tiered (异步)
    tieredLayer.generateBoth(doc.content).then(({abstract, overview}) => {
        tieredContentLayer.save({
            resourceId: doc.id,
            l0Abstract: abstract,
            l1Overview: overview
        });
    });
    
    // L4: 向量索引 (异步)
    vectorLayer.addResource(doc);
    
    return doc;
}

async function handleReadDocument(id, tier, scope) {
    // L0: 验证
    validateScope(scope);
    
    // L2: 获取完整内容
    const doc = await documentLayer.get(id);
    
    // L3: 获取Tiered视图 (如果需要)
    if (tier === 'L0') {
        const tiered = await tieredContentLayer.getByResource(id);
        return tiered.l0Abstract;
    } else if (tier === 'L1') {
        const tiered = await tieredContentLayer.getByResource(id);
        return tiered.l1Overview;
    }
    
    return doc;
}
```

**4层实现**:
```python
# handlers.py (4层)
async def handle_create_document(data, scope):
    # L0: 验证
    identity_layer.validate(scope)
    
    # L1: 构建URI
    uri = index_layer.uri_system.build(scope, 'documents', generate_id())
    
    # L2: 存储 (+ 触发内置能力)
    doc = await content_layer.create({
        'uri': uri,
        **data,
        'scope': scope
    })
    # 异步触发:
    # - tiered_views.generate_views(doc)  (L2内置能力)
    # - index_layer.vector_search.index(doc)  (L1内置能力)
    
    return doc

async def handle_read_document(uri, tier, scope):
    # L0: 验证
    identity_layer.validate(scope)
    
    # L2: 统一获取 (内置TieredView)
    content = await content_layer.get(uri, tier=tier)
    # tier=None: 完整内容
    # tier="L0": L2内部调用 tiered_views.get_view(content, "L0")
    # tier="L1": L2内部调用 tiered_views.get_view(content, "L1")
    
    return content
```

**改进点**:
- 代码更少，逻辑更清晰
- 减少跨层调用
- Tiered 作为内置能力自动触发

---

## 六、测试迁移

### 6.1 测试结构调整

**6层测试结构**:
```
tests/
├── test_scope/          # L0
├── test_index/          # L1
├── test_documents/      # L2
├── test_tiered/         # L3
├── test_vector/         # L4
└── test_facts/          # L5
```

**4层测试结构**:
```
tests/
├── test_identity/       # L0 (重命名)
├── test_index/          # L1
│   └── test_vector_search.py  # 新增测试
├── test_content/        # L2+L3合并
│   ├── test_repository.py
│   └── test_tiered_capability.py  # 新增
└── test_knowledge/      # L5重命名
    ├── test_facts.py
    └── test_entities.py  # 新增
```

### 6.2 测试用例迁移

**原6层测试**:
```typescript
// test_tiered/generator.test.ts
test('should generate L0 abstract', async () => {
    const generator = new TieredGenerator();
    const content = "长文本...";
    
    const l0 = await generator.generateL0(content);
    
    expect(l0.length).toBeLessThan(150);  // ~100 tokens
});
```

**新4层测试**:
```python
# test_content/capabilities/test_tiered.py
async def test_should_generate_l0_view():
    capability = TieredViewCapability()
    content = Content(body="长文本...")
    
    view = await capability.get_view(content, "L0")
    
    assert estimate_tokens(view) < 150  # ~100 tokens
```

---

## 七、迁移检查清单

### 阶段1: 准备 (1天)

- [ ] 阅读本迁移指南
- [ ] 备份现有6层代码
- [ ] 创建4层分支 `feat/4layer-architecture`
- [ ] 设置新的项目结构

### 阶段2: L0/L1 迁移 (2天)

- [ ] 迁移 L0 Identity (复制即可)
- [ ] 重构 L1 Index (添加 VectorSearchCapability)
- [ ] 更新 L1 测试
- [ ] 确保 L1 独立运行

### 阶段3: L2 核心迁移 (3天)

- [ ] 创建新的 Content Layer
- [ ] 迁移 Document Repository
- [ ] 重构 TieredGenerator → TieredViewCapability
- [ ] 合并到 L2 作为内置能力
- [ ] 更新所有调用点
- [ ] 更新 L2 测试

### 阶段4: L3 迁移 (2天)

- [ ] 重命名 Fact Layer → Knowledge Layer
- [ ] 创建 Entity Tree 模块
- [ ] 增强追溯链
- [ ] 确保只读依赖 L2
- [ ] 更新 L3 测试

### 阶段5: 集成与导出 (2天)

- [ ] 集成所有层
- [ ] 更新 MCP 工具
- [ ] 更新 Markdown 导出 (适配4层)
- [ ] 端到端测试

### 阶段6: 文档与发布 (1天)

- [ ] 更新所有文档
- [ ] 编写迁移说明
- [ ] 代码审查
- [ ] 合并到主分支

**总计**: 约 11 个工作日

---

## 八、常见问题

### Q1: 为什么需要迁移? 6层有什么问题?

**A**: 
- 6层的 L3 Tiered 与 L2 紧密耦合，概念重叠
- L4 Vector Search 横向穿透，定位模糊
- 6层接近"7±2"认知上限
- 4层更清晰，依赖更干净

### Q2: 迁移后 Token 节省效果会丢失吗?

**A**: 不会。Token 节省是 L2 的 TieredViewCapability 提供的，效果完全相同:
```
6层: L3 Tiered Layer → 生成摘要 → 80-91%节省
4层: L2 TieredViewCapability → 生成摘要 → 80-91%节省
```

### Q3: MCP 工具接口会变化吗?

**A**: 不会。MCP 接口完全兼容:
```typescript
// 6层和4层调用完全相同
mem_create({ resource, data, scope })
mem_read({ resource, query: { id, tier }, scope })
```

### Q4: 可以部分迁移吗?

**A**: 不建议。部分迁移会导致:
- 架构混乱
- 维护困难
- 团队认知成本增加

建议一次性完成迁移。

### Q5: 如何验证迁移成功?

**A**: 检查清单:
- [ ] 所有测试通过
- [ ] MCP 工具功能正常
- [ ] Token 节省效果验证
- [ ] 导出功能正常
- [ ] 性能无退化

---

## 九、参考文档

- [4层架构设计](agents-mem-py-DESIGN-v2.md)
- [4层导出设计](agents-mem-py-EXPORT-v2.md)
- [4层快速开始](agents-mem-py-QUICKSTART-v2.md)
- [原6层架构分析](architecture-layer-analysis.md)

---

## 十、迁移支持

如有问题，请参考:
1. 代码示例: `examples/migration/`
2. 测试用例: `tests/test_migration/`
3. 架构讨论: GitHub Issues

---

**文档结束**
