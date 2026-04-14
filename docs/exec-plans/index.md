# 执行计划索引

**用途**: 跟踪所有活跃和已完成的计划，使智能体能够独立发现和导航

---

## 活跃计划

| 计划 | 状态 | 开始日期 | 描述 |
|------|------|----------|------|
| [harness-engineering-practices](active/harness-engineering-practices.md) | 🟢 active | 2026-04-14 | 落地 OpenAI Harness Engineering 实践 |

## 已完成计划

| 计划 | 完成日期 | 描述 |
|------|----------|------|
| *(待添加)* | | |

## 技术债务

详见 → [`tech-debt-tracker.md`](tech-debt-tracker.md)

---

## 计划格式

每个计划文件包含:

```markdown
# 计划名称

**状态**: draft | active | completed | abandoned
**开始**: YYYY-MM-DD
**目标**: ...

## 进度

- [ ] 任务 1
- [x] 任务 2

## 决策日志

| 日期 | 决策 | 原因 |
|------|------|------|

## 技术债务

- [ ] 待修复项
```
