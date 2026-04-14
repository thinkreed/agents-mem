# 执行计划: 落地 OpenAI Harness Engineering 实践

**状态**: active  
**开始**: 2026-04-14  
**来源**: [OpenAI Harness Engineering 文章](https://openai.com/zh-Hans-CN/index/harness-engineering/)

---

## 目标

将 OpenAI 团队在智能体优先工程中验证的实践应用到本项目:

1. 从"工程师写代码"转向"工程师设计环境，智能体执行"
2. 建立知识库体系，使智能体能够独立导航和理解项目
3. 建立质量门禁和自动化检查
4. 建立持续垃圾回收机制

---

## 进度

### 阶段 1: 知识库结构 ✅

- [x] 优化 AGENTS.md 为内容目录 (~100 行)
- [x] 建立结构化 docs/ 目录
- [x] 创建 design-docs/index.md
- [x] 创建 core-beliefs.md
- [x] 创建 ARCHITECTURE.md
- [x] 创建 references/index.md

### 阶段 2: 质量与规范 ✅

- [x] 创建 QUALITY_SCORE.md 质量评分系统
- [x] 创建 RELIABILITY.md 可靠性指南
- [x] 创建 SECURITY.md 安全规范
- [x] 创建自定义 linter (依赖边界检查)
- [x] 创建文档检查 linter
- [x] 更新 package.json 添加 lint 命令

### 阶段 3: 执行计划体系 ✅

- [x] 建立 exec-plans/ 目录结构
- [x] 创建执行计划索引
- [x] 创建技术债务跟踪器

### 阶段 4: 完成 ✅

- [x] 创建 GOLDEN_RULES.md (黄金原则)
- [x] 创建 doc-gardener 智能体脚本
- [ ] 建立 CI 集成 (可选)
- [ ] 首次质量评分评估
- [ ] 更新 DESIGN.md 反映新架构

---

## 决策日志

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-04-14 | AGENTS.md 改为 ~100 行目录 | 文章指出大 AGENTS.md 会挤占情境、失效快、难验证 |
| 2026-04-14 | 建立分层架构 + linter | 智能体需要严格边界才能高效工作 |
| 2026-04-14 | 质量评分系统 | 需要可量化的质量指标追踪 |

---

## 技术债务

- [ ] linter 需要完整的 import 解析 (当前是简化版)
- [ ] 文档检查需要更全面的链接解析
- [ ] 缺少 CI 自动集成
