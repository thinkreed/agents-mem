# Markdown 导出层设计 (4层架构版)

**版本**: 2.0 | **日期**: 2026-04-15  
**适配**: 4层架构 (L0 Identity / L1 Index / L2 Content / L3 Knowledge)

---

## 一、4层架构下的导出设计

### 1.1 导出策略

在4层架构中，导出基于**Content Layer (L2)** 和 **Knowledge Layer (L3)**：

```
导出来源:
├── L2 Content
│   ├── Documents (原始内容)
│   ├── Tiered Views (L0/L1/L2 分层视图)
│   └── Conversations/Messages
│
└── L3 Knowledge
    ├── Facts (结构化事实)
    ├── Entity Relations (实体关联)
    └── Trace Chains (追溯链)
```

**关键变化** (vs 6层):
- 不再单独导出"Tiered层" - 作为Content的内置视图导出
- 新增"Knowledge层导出" - Facts和Entities独立导出
- 导出结构更清晰，与架构层一一对应

---

## 二、导出目录结构 (4层架构)

```
~/.agents_mem/export/
└── {user_id}/
    ├── README.md                    # 导出概览
    │
    ├── L2-content/                  # L2: 内容层导出
    │   ├── documents/
    │   │   ├── 2025-04/
    │   │   │   ├── doc-001.md       # 包含L0/L1/L2三层视图
    │   │   │   └── doc-002.md
    │   │   └── 2025-05/
    │   │
    │   ├── conversations/
    │   │   └── 2025-04/
    │   │       └── conv-001.md
    │   │
    │   └── tiered-preferences.md    # 分层聚合的偏好
    │
    ├── L3-knowledge/                # L3: 知识层导出
    │   ├── facts/
    │   │   ├── 2025-04/
    │   │   │   ├── fact-001.md      # 原子事实
    │   │   │   └── fact-002.md
    │   │   └── by-type/
    │   │       ├── preferences.md   # 按类型聚合
    │   │       ├── decisions.md
    │   │       └── observations.md
    │   │
    │   ├── entities/
    │   │   └── entity-graph.md      # 实体关联图谱
    │   │
    │   └── traces/
    │       └── trace-001.md         # 追溯链示例
    │
    └── metadata.json                # 导出元数据
```

### 2.1 L2-Content 导出示例

```markdown
---
id: doc-001
uri: mem://user123/agent456/_/documents/doc-001
created_at: 2025-04-15T10:00:00Z
updated_at: 2025-04-15T14:00:00Z
content_type: text/plain
token_count: 15420
---

# 文档: doc-001

**URI**: mem://user123/agent456/_/documents/doc-001  
**创建**: 2025-04-15 10:00 UTC  
**更新**: 2025-04-15 14:00 UTC  
**Token数**: 15,420

---

## L0 快速摘要 (~100 tokens)

用户偏好素食饮食，不吃辛辣食物，工作时间为每日9:00-18:00。

---

## L1 详细概览 (~2000 tokens)

### 摘要
本文档记录了用户的基本偏好设置，包括饮食、工作习惯和生活方式。

### 关键点
- **饮食**: 严格的素食主义者，不吃肉类、鱼类、蛋类和奶制品
- **辛辣**: 不喜欢辛辣食物，吃辣会引起胃部不适
- **工作时间**: 每日9:00-18:00，周末休息
- **会议偏好**: 偏好上午开会，下午专注工作

### 实体
- 用户: user-123
- 饮食习惯: 素食、忌辛辣
- 工作时间: 9:00-18:00

---

## L2 完整内容

```
[原始完整内容...]
这是用户的完整偏好记录，包含详细的饮食习惯描述、工作时间安排、
会议偏好等信息。内容较长，约15,000 tokens...
```

---

## 关联知识 (L3)

### 提取的事实
- [fact-001: 素食偏好](../../L3-knowledge/facts/2025-04/fact-001.md)
- [fact-002: 工作时间](../../L3-knowledge/facts/2025-04/fact-002.md)

### 追溯链
- [查看完整追溯](../../L3-knowledge/traces/trace-001.md)

---
*自动导出 | agents-mem-py v2.0 | L2-Content*
```

### 2.2 L3-Knowledge 导出示例

**事实文件** (`facts/2025-04/fact-001.md`):

```markdown
---
id: fact-001
fact_type: preference
confidence: 0.95
verified: true
created_at: 2025-04-15T10:30:00Z
source_uri: mem://user123/agent456/_/documents/doc-001
related_facts: [fact-002, fact-003]
---

# 事实: fact-001

**类型**: 用户偏好  
**置信度**: 0.95 (高)  
**验证状态**: ✅ 已验证

## 内容

用户是严格的素食主义者，不吃任何肉类、鱼类、蛋类和奶制品。

## 来源

- **源文档**: [doc-001](../../L2-content/documents/2025-04/doc-001.md)
- **提取时间**: 2025-04-15 10:30 UTC
- **L0摘要**: 用户偏好素食饮食...
- **L1概览**: [查看详细](../../L2-content/documents/2025-04/doc-001.md#L1)

## 追溯链

```
fact-001
    ↓
doc-001 (L2 Content)
    ↓
tiered_content-001 (L0/L1视图)
    ↓
原始文档存储
```

## 关联事实

- [fact-002: 不吃辛辣](fact-002.md)
- [fact-003: 咖啡习惯](fact-003.md)

---
*自动导出 | agents-mem-py v2.0 | L3-Knowledge*
```

**实体图谱** (`entities/entity-graph.md`):

```markdown
# 实体关联图谱

**导出时间**: 2025-04-15 15:00 UTC  
**范围**: user-123 / agent-456

## 核心实体

### 实体: user-123
**类型**: User  
**属性**:
- 饮食: 素食
- 工作时间: 9:00-18:00
- 团队: team-789

**关联**:
- → [agent-456]: 协作关系
- → [team-789]: 成员关系
- → [fact-001]: 拥有偏好

### 实体: 饮食习惯
**类型**: Concept  
**关联事实**:
- [fact-001: 素食偏好](../facts/2025-04/fact-001.md)
- [fact-002: 不吃辛辣](../facts/2025-04/fact-002.md)

## 关联网络

```
[user-123] ──(拥有)──> [饮食习惯]
    │
    ├──(协作)──> [agent-456]
    │
    ├──(成员)──> [team-789]
    │
    └──(拥有)──> [工作时间偏好]
```

---
*自动导出 | agents-mem-py v2.0 | L3-Knowledge*
```

---

## 三、导出 API (4层架构)

### 3.1 MCP 工具: mem_export

```python
@mcp.tool()
async def mem_export(
    scope: dict = None,
    layer: Literal["L2", "L3", "all"] = "all",
    content_type: str = None,      # L2: document/conversation/asset
    fact_type: str = None,         # L3: preference/decision/observation
    since: str = None,
    include_tiered: bool = True,   # 是否包含L0/L1视图
    include_entities: bool = False,# 是否导出实体图谱
    ctx: Context = None
) -> dict:
    """
    导出4层架构的记忆数据
    
    Args:
        layer: 导出哪个层 (L2=Content, L3=Knowledge, all=全部)
        content_type: L2内容类型过滤
        fact_type: L3事实类型过滤
        include_tiered: 是否包含分层视图
        include_entities: 是否生成实体图谱
    
    Returns:
        {
            "status": "ok",
            "export_path": "~/.agents_mem/export/user-123",
            "L2_content": {          # Content层导出
                "documents": 15,
                "conversations": 3,
                "tiered_views_generated": 18
            },
            "L3_knowledge": {        # Knowledge层导出
                "facts": 45,
                "entities": 12,
                "traces": 8
            },
            "git_commit": "abc123..."
        }
    """
```

### 3.2 使用示例

```python
# 导出L2 Content层 (包含分层视图)
result = await mem_export(
    scope={"user_id": "user-123", "agent_id": "agent-456"},
    layer="L2",
    content_type="document",
    include_tiered=True
)

# 导出L3 Knowledge层
result = await mem_export(
    scope={"user_id": "user-123"},
    layer="L3",
    fact_type="preference",
    include_entities=True
)

# 全量导出
result = await mem_export(
    scope={"user_id": "user-123"},
    layer="all",
    include_tiered=True,
    include_entities=True
)
```

---

## 四、导出实现 (4层架构)

### 4.1 架构适配

```python
# src/agents_mem/export/exporter.py

class MarkdownExporter:
    """Markdown导出器 - 适配4层架构"""
    
    def __init__(
        self,
        identity_layer: IdentityLayer,      # L0
        index_layer: IndexLayer,            # L1
        content_layer: ContentLayer,        # L2
        knowledge_layer: KnowledgeLayer     # L3
    ):
        self.L0 = identity_layer
        self.L1 = index_layer
        self.L2 = content_layer
        self.L3 = knowledge_layer
        self.jinja_env = Environment(
            loader=PackageLoader('agents_mem', 'export/templates')
        )
    
    async def export_layer_2(
        self,
        scope: Scope,
        content_type: Optional[str] = None,
        include_tiered: bool = True
    ) -> dict:
        """导出L2 Content层"""
        export_dir = self.export_dir / scope.user_id / "L2-content"
        
        # 1. 获取内容列表 (通过L2)
        contents = await self.L2.list_by_scope(scope, content_type)
        
        # 2. 导出每个内容 (包含Tiered视图)
        for content in contents:
            if include_tiered:
                # 生成L0/L1/L2三层视图
                l0_view = await self.L2.get_view(content.id, "L0")
                l1_view = await self.L2.get_view(content.id, "L1")
                l2_view = content.body
            else:
                l0_view = l1_view = l2_view = None
            
            # 渲染模板
            template = self.jinja_env.get_template("content.md.j2")
            md_content = template.render(
                content=content,
                l0_view=l0_view,
                l1_view=l1_view,
                l2_view=l2_view,
                layer="L2"
            )
            
            # 写入文件
            file_path = export_dir / "documents" / content.created_at.strftime("%Y-%m") / f"{content.id}.md"
            file_path.write_text(md_content, encoding="utf-8")
        
        return {"documents": len(contents)}
    
    async def export_layer_3(
        self,
        scope: Scope,
        fact_type: Optional[str] = None,
        include_entities: bool = False
    ) -> dict:
        """导出L3 Knowledge层"""
        export_dir = self.export_dir / scope.user_id / "L3-knowledge"
        
        # 1. 导出Facts (通过L3)
        facts = await self.L3.list_facts(scope, fact_type)
        
        for fact in facts:
            # 获取追溯链
            trace = await self.L3.trace_fact(fact.id) if fact.source_uri else None
            
            # 渲染模板
            template = self.jinja_env.get_template("fact.md.j2")
            md_content = template.render(
                fact=fact,
                trace=trace,
                layer="L3"
            )
            
            # 写入文件
            file_path = export_dir / "facts" / fact.created_at.strftime("%Y-%m") / f"{fact.id}.md"
            file_path.write_text(md_content, encoding="utf-8")
        
        # 2. 导出实体图谱 (可选)
        if include_entities:
            entity_tree = await self.L3.aggregate_entities(scope)
            template = self.jinja_env.get_template("entities.md.j2")
            md_content = template.render(
                entity_tree=entity_tree,
                scope=scope,
                layer="L3"
            )
            file_path = export_dir / "entities" / "entity-graph.md"
            file_path.write_text(md_content, encoding="utf-8")
        
        return {
            "facts": len(facts),
            "entities": len(entity_tree.entities) if include_entities else 0
        }
```

### 4.2 模板结构

```
templates/
├── content.md.j2          # L2 Content层模板
├── fact.md.j2             # L3 Fact模板
├── entities.md.j2         # L3 Entity图谱模板
├── trace.md.j2            # L3 追溯链模板
└── README.md.j2           # 导出概览模板
```

---

## 五、4层架构 vs 6层架构导出对比

| 维度 | 6层架构导出 | 4层架构导出 | 改进 |
|------|-------------|-------------|------|
| **导出结构** | 按资源类型扁平化 | 按架构层分层 (L2/L3) | ✅ 更清晰 |
| **Tiered导出** | 独立L0/L1/L2文件 | 作为Content的内置视图 | ✅ 减少文件数 |
| **Knowledge导出** | Facts单独导出 | L3层独立目录 | ✅ 与架构对应 |
| **追溯链** | 简单source_id | 完整L2→L3链路 | ✅ 更完整 |
| **实体图谱** | 未实现 | L3实体导出 | ✅ 新增能力 |

---

## 六、使用场景

### 6.1 场景1: 用户查阅自己的Content

```bash
# 查看L2 Content (包含L0/L1/L2三层)
cat ~/.agents_mem/export/user-123/L2-content/documents/2025-04/doc-001.md

# 快速查看L0摘要
grep -A 5 "## L0" doc-001.md
```

### 6.2 场景2: 分析知识图谱

```bash
# 查看实体关联
cat ~/.agents_mem/export/user-123/L3-knowledge/entities/entity-graph.md

# 查看特定类型的事实
cat ~/.agents_mem/export/user-123/L3-knowledge/facts/by-type/preferences.md
```

### 6.3 场景3: 追溯事实来源

```bash
# 查看事实及其追溯链
cat ~/.agents_mem/export/user-123/L3-knowledge/traces/trace-001.md
```

### 6.4 场景4: Git版本控制

```bash
cd ~/.agents_mem/export/user-123

# 查看L2 Content的变更历史
git log --follow L2-content/documents/2025-04/doc-001.md

# 查看L3 Knowledge的变更历史
git log --follow L3-knowledge/facts/2025-04/fact-001.md
```

---

## 七、实施检查清单

- [ ] L2 Content导出实现
- [ ] L3 Knowledge导出实现
- [ ] Tiered视图内置到Content导出
- [ ] Entity图谱导出实现
- [ ] 追溯链导出实现
- [ ] 分层模板设计
- [ ] Git集成保持
- [ ] MCP工具 mem_export 更新

---

**文档结束**
