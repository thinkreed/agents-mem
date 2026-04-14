# 测试改进设计文档

**日期**: 2026-04-14  
**状态**: 已批准  
**执行方式**: 分阶段逐步实施

## 问题概述

当前项目有 65 个测试文件、1084 个测试用例，但存在以下问题：

1. **vitest coverage 模式崩溃**：34 个测试套件因 `bun:sqlite` 识别失败而崩溃
2. **已知测试失败**：handlers.test.ts 断言不同步、converters.test.ts 模块加载失败
3. **关键源文件无测试**：8 个源文件缺少对应测试
4. **测试质量弱点**：缺少错误路径测试、mock 过于宽泛、有跳过测试
5. **缺少 E2E 测试**：无 MCP 协议级别端到端验证

## 阶段划分

### 阶段 1：修复基础设施（P0）

**目标**：让测试能跑、能出覆盖率报告

| 任务 | 问题 | 解决方案 |
|------|------|----------|
| 1.1 | vitest coverage 不识别 `bun:sqlite` | 在 vitest.config.ts 添加别名 mock，或配置 external 模块处理 |
| 1.2 | handlers.test.ts targetUri 断言失败 | 更新测试断言以匹配实际代码行为，或修复代码中的 targetUri 生成 |
| 1.3 | converters.test.ts 全部失败（Cannot find module） | 将 `require()` 改为动态 `import()`，修复模块导出方式 |

**验收标准**：
- `bun test` 全绿（0 fail）
- `bunx vitest run --coverage` 能生成覆盖率报告

### 阶段 2：补充缺失测试（P1）

**目标**：为未测试的源文件编写单元测试

| 源文件 | 测试文件 | 测试重点 |
|--------|----------|----------|
| `src/tools/definitions.ts` | `tests/tools/definitions.test.ts` | 工具定义结构、required 字段 |
| `src/tools/registry.ts` | `tests/tools/registry.test.ts` | 注册表 CRUD、单例模式 |
| `src/materials/trace.ts` | `tests/materials/trace.test.ts` | 事实溯源逻辑、多层追溯 |
| `src/queue/types.ts` | `tests/queue/types.test.ts` | 类型定义验证（运行时检查） |
| `src/queue/queue_jobs.ts` | `tests/sqlite/queue_jobs.test.ts` | 队列持久化 CRUD |
| `src/llm/ollama.ts` | `tests/llm/ollama.test.ts` | 重试逻辑、超时、空提示处理 |
| `src/sqlite/memory_index.ts` | `tests/sqlite/memory_index.test.ts` | 索引 CRUD、URI 匹配 |
| `src/utils/logger_types.ts` | `tests/utils/logger_types.test.ts` | 日志类型定义验证 |
| `src/core/uri.ts` | 增强 `tests/core/uri.test.ts` | 边界情况、特殊字符、长 URI |

**验收标准**：
- 所有源文件都有对应测试
- 新增测试 100% 通过

### 阶段 3：增强测试质量（P2）

**目标**：提升测试深度和可靠性

| 任务 | 内容 | 预计新增测试数 |
|------|------|---------------|
| 3.1 | 错误路径测试（网络失败、无效输入、并发冲突） | ~30 |
| 3.2 | 减少 mock 范围（部分测试使用真实 SQLite） | 重构 3-5 个测试文件 |
| 3.3 | 修复跳过的 audit isolation 测试 | 1 个测试 |
| 3.4 | 改进 mock 策略（避免全模块 mock） | 重构 2-3 个测试文件 |

**验收标准**：
- 无跳过测试
- 错误路径覆盖率 > 80%
- 至少 3 个测试文件使用真实 SQLite 而非全 mock

### 阶段 4：E2E 端到端测试（P2）

**目标**：MCP 协议级别端到端验证

| 测试场景 | 内容 |
|----------|------|
| 4.1 | 完整 CRUD 流程（create → read → update → delete） |
| 4.2 | 搜索 + 分层内容加载（L0/L1/L2） |
| 4.3 | 事实提取 + 溯源 |
| 4.4 | 团队 + 成员管理 |
| 4.5 | 并发操作一致性 |

**验收标准**：
- 5 个 E2E 测试全部通过
- 使用真实数据库和 OpenViking mock

## 测试策略

### Mock 策略

| 场景 | 策略 |
|------|------|
| SQLite CRUD | 使用真实临时数据库（`tmpdir()`） |
| OpenViking HTTP | Mock（避免网络依赖） |
| Ollama Embeddings | Mock（避免本地模型依赖） |
| LLM 生成 | Mock（避免长时间等待） |
| 文件系统 | Mock 或使用临时目录 |

### 测试数据隔离

- 每个测试使用独立临时数据库路径
- `beforeEach` 重置所有单例
- `afterEach` 清理临时文件

### 覆盖率目标

- 行覆盖率：> 85%
- 分支覆盖率：> 75%
- 函数覆盖率：> 90%

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| vitest 与 bun:sqlite 不兼容 | 添加模块别名 mock，或改用 bun 原生覆盖率工具 |
| 测试执行时间过长 | 并行执行、减少不必要的集成测试 |
| Mock 与实际行为不同步 | 定期用真实服务验证 mock 行为 |

## 成功标准

1. `bun test` 全绿（0 fail, 0 skip）✅
2. 仅保留生产测试（tests/production/）✅
3. 零外部依赖（vitest 已移除）✅
4. 使用真实 SQLite 和真实文章数据✅
