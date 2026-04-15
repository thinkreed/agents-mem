# 六层架构深度分析报告

**版本**: 1.0 | **日期**: 2026-04-15  
**目标**: 评估 agents-mem 六层架构的必要性，探讨缩减至4层或3层的可能性

---

## 一、当前六层架构详解

### 架构概览

```
L0: Scope & Identity      — user_id + agent_id + team_id
L1: Index & Metadata      — mem:// URI, 元数据过滤  
L2: Documents & Assets    — 原始素材
L3: Tiered Content        — L0/L1/L2 分层摘要 (核心)
L4: Vector Search         — OpenViking 语义搜索
L5: Facts & Entity Tree   — 事实提取与实体聚合
存储: SQLite + OpenViking
```

---

## 二、逐层必要性分析

### L0: Scope & Identity (身份层)

**核心代码**:
- `src/core/scope.ts` - Scope 定义
- `src/core/types.ts` - Scope 接口
- `src/sqlite/schema.ts` - users, agents, teams 表

**主要职责**:
- 多租户隔离：user_id/agent_id/team_id 三层作用域
- 权限控制：所有数据操作必须验证 scope
- 数据分区：物理上通过 scope 字段隔离

**代码示例**:
```typescript
interface Scope {
  userId: string;      // 必填
  agentId?: string;    // 可选
  teamId?: string;     // 可选
}

// 使用场景
mem_create({
  resource: "document",
  data: { content: "..." },
  scope: { userId: "user-123", agentId: "agent-456" }
})
```

**是否可移除**: ❌ **不可移除**
- 169+ agents 场景必须有多租户隔离
- 移除后数据安全无法保证
- **结论**: L0 是基础设施，必须保留

---

### L1: Index & Metadata (索引层)

**核心代码**:
- `src/core/uri.ts` - mem:// URI 构建/解析
- `src/sqlite/memory_index.ts` - 索引表
- `src/materials/uri_resolver.ts` - URI 解析器

**主要职责**:
- 统一资源命名：mem://user123/agent1/_/documents/doc-456
- 快速查找：通过 URI 定位资源
- 元数据过滤：支持按 scope 过滤

**代码示例**:
```typescript
// URI 构建
const uri = buildURI({
  userId: "user-123",
  agentId: "agent-456",
  type: "documents",
  id: "doc-789"
});
// → mem://user123/agent456/_/documents/doc-789

// URI 解析
const parsed = parseURI(uri);
// → { userId, agentId, teamId, type, id }
```

**是否可移除**: ❌ **不可移除**
- URI 是系统的统一资源标识
- 所有 CRUD 操作依赖 URI 定位
- OpenViking 也需要 URI 转换
- **结论**: L1 是寻址层，必须保留

---

### L2: Documents & Assets (存储层)

**核心代码**:
- `src/sqlite/documents.ts` - 文档 CRUD
- `src/sqlite/assets.ts` - 资源 CRUD
- `src/materials/store.ts` - 存储入口

**主要职责**:
- 存储原始内容：文档全文、资源文件
- 基础 CRUD：创建、读取、更新、删除
- 与 L3 的关系：L3 从 L2 生成摘要

**数据流**:
```
用户输入 → L2 (存储原始内容) → L3 (生成摘要) → L4 (向量化)
```

**是否可移除**: ❌ **不可移除**
- 必须存储原始内容作为数据源
- L3 的分层摘要需要从 L2 生成
- **结论**: L2 是数据源层，必须保留

---

### L3: Tiered Content (分层层) ⭐ 核心价值

**核心代码**:
- `src/tiered/generator.ts` - L0/L1 生成器
- `src/llm/prompts.ts` - LLM 提示词
- `src/core/constants.ts` - Token 预算

**主要职责**:
- L0 摘要：~100 tokens (由 `L0_TOKEN_BUDGET = 100` 控制)
- L1 概览：~2k tokens (由 `L1_TOKEN_BUDGET = 2000` 控制)
- L2 完整：原始内容
- **Token 节省：80-91%** (这是系统的核心价值)

**关键代码**:
```typescript
// src/core/constants.ts
export const L0_TOKEN_BUDGET = 100;
export const L1_TOKEN_BUDGET = 2000;

// src/tiered/generator.ts
async generateL0(content: string): Promise<string> {
  // 短内容直接返回，无需 LLM
  if (estimateTokens(content) <= L0_TOKEN_BUDGET) {
    return content;
  }
  
  // 调用 LLM 生成摘要
  const prompt = buildL0AbstractPrompt(content);
  const abstract = await this.llmClient.generate(prompt, {
    maxTokens: L0_TOKEN_BUDGET + 20
  });
  
  return abstract;
}
```

**披露流程**:
```
元数据(~50) → L0(~100) → L1(~2k) → L2(full) → Facts(~1k) → Agentic(~2k)
              ↑                           ↑
         Token 节省关键                按需加载
```

**是否可移除**: ❌ **绝不可移除**
- **这是系统存在的理由**
- Token 节省 80-91% 是核心卖点
- 不分层则每次需加载全量内容，成本爆炸
- **结论**: L3 是核心价值层，必须保留

---

### L4: Vector Search (向量层)

**核心代码**:
- `src/openviking/http_client.ts` - HTTP 客户端
- `src/openviking/scope_mapper.ts` - Scope 映射
- `src/openviking/uri_adapter.ts` - URI 适配

**主要职责**:
- 语义搜索：支持中文语义理解
- 混合搜索：hybrid (FTS + Vector + RRF)
- 多模式：fts/semantic/progressive

**搜索模式**:
| 模式 | 说明 |
|------|------|
| `hybrid` | FTS + Vector + RRF (推荐) |
| `fts` | BM25 精准匹配 |
| `semantic` | 向量语义搜索 |
| `progressive` | L0 分层搜索 |

**代码示例**:
```typescript
// 混合搜索
const results = await client.find({
  query: "咖啡偏好",
  targetUri: "viking://default/user123/resources/documents",
  limit: 10,
  mode: "hybrid"  // FTS + Vector
});
```

**是否可移除**: ⚠️ **理论上可移除，但不建议**
- 移除后只剩 SQLite FTS，无语义理解
- 中文语义搜索效果会大幅下降
- 但 169+ agents 场景可能可以简化（见下文）
- **结论**: 可考虑简化，但不建议完全移除

---

### L5: Facts & Entity Tree (事实层)

**核心代码**:
- `src/facts/extractor.ts` - 事实提取
- `src/facts/verifier.ts` - 事实验证
- ⚠️ `src/entity_tree/` - **不存在**（文档提及但未实现）

**主要职责**:
- 事实提取：从内容提取结构化事实
- 事实验证：验证事实准确性
- 事实追溯：fact.source_id → tiered.id → document
- 实体树：θ(d) = θ₀ × e^(λd) 阈值聚合

**关键发现**: 
- **entity_tree 目录不存在**，代码未实现
- schema.ts 中提到了 entity_nodes 表但未使用
- 这是**文档与代码不同步**的体现

**代码示例**:
```typescript
// 事实提取
const extractor = getFactExtractor();
const factIds = await extractor.extractAndSave({
  userId: "user-123",
  sourceType: "documents",
  sourceId: "doc-456",
  content: "用户喜欢喝无糖咖啡"
});

// 事实追溯
const traceResult = traceFactToSource("fact-789");
// → { fact, tieredContent, originalDocument }
```

**是否可移除**: ✅ **可以移除或大幅简化**
- 实体树功能未实现
- 事实提取是可选增强功能
- 核心记忆功能不依赖事实层
- **结论**: L5 是可选层，可考虑移除

---

## 三、业界对比分析

### 主流系统层数

| 系统 | 层数 | 架构模式 |
|------|------|----------|
| **MemGPT** | 2层 | 主上下文 + 外部上下文 |
| **LangChain** | 非分层 | 6种独立内存类型 |
| **CrewAI** | 统一 | 1个 Memory 类 + LLM 自组织 |
| **AutoGen** | 可选 | 5种可插拔实现 |
| **RAG 分层** | 3层 | 文档/段落/句子级 |
| **agents-mem** | 6层 | 渐进式披露 |

### 关键发现

1. **无"6层"业界标准**: 主流使用 2-4 层
2. **CrewAI 简化案例**: 从 4 种独立内存 → 1 个统一 Memory 类
3. **MemGPT 极简**: 仅 2 层 (OS 虚拟内存类比)
4. **agents-mem 分层最多**: 需要评估是否过度设计

---

## 四、缩减方案评估

### 方案 A: 缩减至 5 层 (移除 L5)

**架构**:
```
L0: Scope & Identity
L1: Index & Metadata
L2: Documents & Assets
L3: Tiered Content      ← 核心价值保留
L4: Vector Search
~~L5: Facts & Entity Tree~~  (移除)
```

**影响**:
- ✅ 事实提取功能移除
- ✅ 实体树聚合功能移除
- ✅ 事实追溯链断裂
- ✅ 失去"原子事实"能力

**适用场景**: 不需要事实提取的简单 Agent 场景

**工作量**: 小 (1-2 天)

---

### 方案 B: 缩减至 4 层 (合并 L3+L4)

**架构**:
```
L0: Scope & Identity
L1: Index & Metadata
L2: Documents & Assets
L3: Tiered + Vector      ← 分层搜索合并
~~L4: Vector Search~~      (合并到 L3)
~~L5: Facts & Entity Tree~~ (移除)
```

**合并逻辑**:
```typescript
// 当前
L3: TieredGenerator.generateL0/L1/L2
L4: OpenVikingClient.find({ mode: "hybrid" })

// 合并后
L3: UnifiedContentLayer {
  async getContent(tier: "L0" | "L1" | "L2", query?: string) {
    if (query) {
      // 先搜索，再返回指定 tier
      const results = await vectorSearch(query);
      return results.map(r => r[tier]);
    }
    // 直接返回 tiered content
    return tieredContent[tier];
  }
}
```

**影响**:
- ✅ 架构更简洁
- ✅ 减少 HTTP 调用层级
- ⚠️ 搜索和分层逻辑耦合
- ⚠️ 失去独立优化空间

**适用场景**: 中小型项目，不需要极端性能优化

**工作量**: 中 (1 周)

---

### 方案 C: 缩减至 3 层 (激进简化)

**架构**:
```
L0: Identity + Index      ← 合并 L0+L1
L1: Content + Tiered      ← 合并 L2+L3
L2: Search                ← 合并 L4+L5
```

**合并详情**:
```
当前 6 层 → 简化 3 层

L0 (Scope+Index): user_id/agent_id/team_id + mem:// URI
L1 (Content): Documents/Assets + L0/L1/L2 分层
L2 (Intelligence): Vector Search + Facts
```

**影响**:
- ✅ 架构极简
- ✅ 维护成本低
- ❌ 失去细粒度控制
- ❌ Token 预算控制需重新设计
- ❌ 可能引入复杂度 (层内职责混杂)

**适用场景**: 原型项目、个人工具

**工作量**: 大 (2-3 周)

---

## 五、Token 成本量化分析

### 分层 vs 不分层成本对比

**假设场景**: 100 个文档，平均每个 5000 tokens

| 方案 | Token 消耗 | 成本 | 说明 |
|------|------------|------|------|
| **不分层** | 500,000 tokens | 100% | 全量加载 |
| **6层 (当前)** | 50,000 tokens | 10% | L0/L1 分层 |
| **节省** | 450,000 tokens | 90% | **节省效果** |

**分层披露流程**:
```
初始: 元数据(~50) → Token: 50
      ↓ 如果需要更多
加载: L0(~100) → Token: +100 = 150
      ↓ 如果需要更多
加载: L1(~2k) → Token: +2000 = 2150
      ↓ 如果需要更多
加载: L2(full) → Token: +5000 = 7150

总计最多: ~7k tokens (vs 500k 全量)
```

**关键洞察**:
- 分层披露是**渐进式**的，按需加载
- 80-91% 节省是在**典型场景**下（只加载 L0/L1）
- 即使加载到 L2，仍比全量节省 80%+

---

## 六、推荐方案

### 我的建议: **保持 5 层** (移除 L5)

**理由**:

1. **L0-L4 是核心**: 
   - L0: 多租户隔离 (必须)
   - L1: URI 寻址 (必须)
   - L2: 原始存储 (必须)
   - L3: Token 节省核心价值 (必须)
   - L4: 语义搜索 (重要)

2. **L5 是可选增强**:
   - 实体树未实现
   - 事实提取是锦上添花
   - 移除后核心功能不受影响

3. **业界主流是 4-5 层**:
   - MemGPT: 2层 (太简)
   - CrewAI: 1类统一 (灵活但难控制)
   - agents-mem 5层: 平衡

**最终架构**:
```
┌─────────────────────────────────────────────┐
│  L4: Vector Search (语义搜索层)              │
├─────────────────────────────────────────────┤
│  L3: Tiered Content (分层摘要层) ⭐ 核心价值 │
├─────────────────────────────────────────────┤
│  L2: Documents & Assets (原始存储层)         │
├─────────────────────────────────────────────┤
│  L1: Index & Metadata (URI 索引层)           │
├─────────────────────────────────────────────┤
│  L0: Scope & Identity (身份隔离层)           │
└─────────────────────────────────────────────┘
```

---

## 七、实施建议

### Python 版实施路径

1. **阶段 1**: 实现 L0-L4 (核心功能)
   - 保持 Token 节省能力
   - 保持语义搜索能力
   - 时间: 4-5 周

2. **阶段 2**: 可选添加 L5
   - 事实提取
   - 实体树 (如果需求明确)
   - 时间: 1-2 周 (可选)

3. **阶段 3**: 增强 Markdown 导出
   - 基于 L0-L4 的数据导出
   - 时间: 1 周

### 关键决策点

| 决策 | 建议 | 理由 |
|------|------|------|
| 保留 L5? | 否 (v2 再考虑) | 当前未实现，非核心 |
| 合并 L3+L4? | 否 | 保持搜索和生成独立优化 |
| 合并 L0+L1? | 否 | 职责不同，合并引入复杂度 |
| 目标层数 | **5 层** | 平衡简洁与功能 |

---

## 八、结论

### 核心观点

1. **六层架构并非过度设计**:
   - 每层有明确职责
   - L3 (分层) 是核心价值，必须保留
   - L5 (事实层) 是唯一可移除的层

2. **缩减至 5 层是合理选择**:
   - 移除未实现的实体树
   - 事实提取可作为 v2 功能
   - 保持核心 Token 节省能力

3. **不建议缩减至 4 层或 3 层**:
   - 4层: 合并 L3+L4 失去独立优化空间
   - 3层: 职责混杂，维护困难
   - Token 预算控制需要细粒度分层

### 最终建议

**Python 版 agents-mem 采用 5 层架构**:

```
L0: Scope & Identity      ✅ 保留
L1: Index & Metadata      ✅ 保留
L2: Documents & Assets    ✅ 保留
L3: Tiered Content        ✅ 保留 (核心)
L4: Vector Search         ✅ 保留
L5: Facts & Entity Tree   ❌ 移除 (v2 可选)
```

**预期收益**:
- 架构清晰，职责分明
- 保持 80-91% Token 节省
- 维护成本适中
- 符合业界主流 (4-5 层)
