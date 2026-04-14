# GOLDEN_RULES.md — 黄金原则

**性质**: 带有主观意见的机械规则，旨在保持代码库的可读性和一致性  
**维护**: 团队讨论后更新 | 状态: active

---

## 一、代码原则

### 1. 优先共享工具，而非手写辅助

**原则**: 使用共享工具包，而非手工编写的辅助函数  
**原因**: 将不变式集中管理，智能体更容易理解和复用

```typescript
// ✅ 好 — 使用共享工具
import { mapWithConcurrency } from '@/utils/async'
await mapWithConcurrency(items, process, { limit: 5 })

// ❌ 差 — 手写辅助
async function processItems(items: Item[]) {
  const results = []
  for (let i = 0; i < items.length; i += 5) {
    results.push(...await Promise.all(items.slice(i, i+5).map(process)))
  }
  return results
}
```

### 2. 验证边界，不探测数据

**原则**: 在边界处验证数据形状，不基于猜测构建  
**原因**: 智能体不会意外地基于未验证结构进行构建

```typescript
// ✅ 好 — 边界验证
const parsed = CreateSchema.parse(input)  // Zod 在入口验证

// ❌ 差 — 探测数据
if (input.name && input.email) {  // 不完整验证
  // 使用 input
}
```

### 3. 结构化日志，不打印字符串

**原则**: 所有日志使用结构化格式  
**原因**: 智能体可以查询、过滤、关联

```typescript
// ✅ 好 — 结构化
logger.warn({ module: 'openviking', retry: 2, max: 3, error: e.message })

// ❌ 差 — 字符串
console.log(`OpenViking retry 2/3: ${e.message}`)
```

### 4. 类型安全，避免 any

**原则**: 100% TypeScript strict，不使用 any  
**原因**: 类型是智能体最重要的导航线索

```typescript
// ✅ 好
interface SearchResult { id: string; score: number }

// ❌ 差
function search(query: any): any
```

---

## 二、架构原则

### 5. 依赖只能向前

**原则**: 代码只能依赖分层架构中前面的层  
**原因**: 防止循环依赖，确保可测试性

详见 → [`ARCHITECTURE.md`](ARCHITECTURE.md) § 分层领域架构

### 6. 文件不超过 500 行

**原则**: 单个源文件 ≤ 500 行  
**原因**: 智能体情境窗口有限，大文件难以理解

### 7. 函数不超过 50 行

**原则**: 单个函数 ≤ 50 行  
**原因**: 单屏可读，智能体更容易推理

---

## 三、文档原则

### 8. 文档必须可验证

**原则**: 文档中的每个声明都必须有机械验证方式  
**原因**: 无法验证的文档必然过时

```markdown
<!-- ✅ 可验证 -->
- API 端点: `/api/v1/search/find` (见 `src/openviking/http_client.ts:42`)

<!-- ❌ 不可验证 -->
- API 端点支持多种搜索模式
```

### 9. AGENTS.md 是地图，不是百科全书

**原则**: AGENTS.md 保持在约 100 行  
**原因**: 挤占任务情境，失效快，难验证

### 10. 代码仓库是唯一的真相

**原则**: 所有知识必须编码到仓库中  
**原因**: 智能体无法访问 Google Docs、Slack、人的大脑

---

## 四、测试原则

### 11. TDD 驱动

**原则**: 先写测试，再写实现  
**原因**: 确保可测试性，防止回归

### 12. 100% 覆盖

**原则**: 所有代码必须有测试覆盖  
**原因**: 智能体生成的代码更需要安全保障

---

## 五、合并原则

### 13. 纠错成本低，等待成本高

**原则**: PR 生命周期短，不阻塞非必要问题  
**原因**: 智能体吞吐量远超人类注意力

### 14. 自动化合并

**原则**: 评分 A/B 的 PR 自动合并  
**原因**: 减少人工等待时间

---

## 六、清理原则

### 15. 垃圾回收是持续的

**原则**: 技术债务 = 高息贷款，持续偿还  
**原因**: 累积的债务最终需要痛苦的一次性解决

### 16. 人类品味一旦捕捉就持续应用

**原则**: 审查意见编码到工具中  
**原因**: 人工审查不可扩展，工具可以

---

## 执行

这些原则通过以下方式执行:

| 原则 | 执行方式 |
|------|----------|
| 1-4 | Code review + Linter |
| 5-7 | `bun run lint:deps` + Linter |
| 8-10 | `bun run lint:docs` + doc-gardener |
| 11-12 | `bun test` + 覆盖率检查 |
| 13-14 | CI 门禁 |
| 15-16 | 每周审查 + doc-gardener |
