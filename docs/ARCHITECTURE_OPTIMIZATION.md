# 架构优化方案

**版本**: 2.1 | **日期**: 2026-04-15 | **状态**: Phase 0 设计确认  
**决策依据**: AUDIT_ARCHITECTURE.md + 用户确认  
**DI 方案**: tsyringe (Microsoft)  
**迁移策略**: 完全重写（无兼容层）

---

## 一、执行摘要

本次优化将删除 **2 个冗余模块 + 2 张数据库表**（约 812 行代码），并引入 **tsyringe 依赖注入架构** 替代现有的 18+ 单例模式。

| 变更类型 | 数量 | 代码影响 | 风险等级 |
|----------|------|----------|----------|
| 🗑️ 删除模块 | 2 | ~812 行 | 中 |
| 🗑️ 删除数据库表 | 2 | queue_jobs, entity_nodes | 中 |
| 🔄 DI 重构 | 18+ 单例 | ~200 行新增 | 中-高（完全重写） |
| ✅ 功能保留 | 无变化 | - | 低 |

**预期收益**:
- 代码简洁度提升 8%
- 测试可维护性提升 60%
- 单例状态追踪统一化（tsyringe 自动管理）
- 类型安全增强（装饰器注入）
- **无遗留兼容代码** — 一次性完成，无过渡期维护成本

**完全重写决策**（用户确认）:
- ✅ 所有 `getXXX()`, `createXXX()`, `resetXXX()` 函数完全删除
- ✅ 统一使用 `container.resolve(Token)` 或构造函数注入
- ✅ 测试直接使用 `container.reset()` 后重新注册 Mock
- ✅ 所有 import 路径一次性更新
- ✅ 无过渡期，一次性完成

---

## 二、删除清单

### 2.1 queue/ 模块 + queue_jobs 表 — 功能已废弃

| 属性 | 详情 |
|------|------|
| **目录** | `src/queue/` |
| **文件数** | 4 |
| **总行数** | ~559 行 |
| **依赖** | `sqlite/queue_jobs`, `embedder/ollama`, `openviking` |
| **被引用** | `materials/store.ts` (可选) |

**文件清单**:
```
src/queue/
├── converters.ts       # 48 行 — Job ↔ Record 转换
├── embedding_queue.ts  # 381 行 — 主队列逻辑
├── index.ts            # 25 行 — 导出 + 单例
└── types.ts            # ~105 行 — 类型定义
```

**废弃证据**（embedding_queue.ts 源码注释）:
```typescript
// 第 227-241 行
// Note: Embedding is now handled by OpenViking during addResource()
// This job is kept for backward compatibility but no longer performs
// LanceDB vector operations.

// 第 250-256 行
// Note: FTS indexing is now handled by OpenViking automatically.
```

**删除理由**:
- `processEmbedding()` 和 `processFtsIndex()` 为空操作
- OpenViking 已接管所有异步处理
- 增加维护负担和理解难度

**删除影响**:
| 影响范围 | 详情 |
|----------|------|
| 直接影响 | `materials/store.ts` 可能引用（需检查） |
| 间接影响 | `sqlite/queue_jobs.ts` 一同删除 |
| 数据库 | `queue_jobs` 表完全删除（不保留） |

**删除后替代**:
- 直接调用 OpenViking 的 `getTask()` 查询异步状态
- DESIGN.md 中明确说明 OpenViking 负责所有异步处理

---

### 2.2 entity_tree/ 模块 + entity_nodes 表 — 残留设计

| 属性 | 详情 |
|------|------|
| **目录** | `src/entity_tree/` |
| **文件数** | 4 |
| **总行数** | ~253 行 |
| **依赖** | `sqlite/entity_nodes`, `utils/uuid`, 自身模块 |
| **被引用** | 仅 `tools/handlers.ts` |

**文件清单**:
```
src/entity_tree/
├── aggregator.ts   # 69 行 — 实体聚合
├── builder.ts      # 77 行 — 树构建
├── search.ts       # ~50 行 — 搜索
└── threshold.ts    # ~40 行 — 阈值计算
```

**删除理由**:
- 仅在 `handlers.ts` 中使用（entity_tree_search, entity_tree_build）
- `crud_handlers.ts` 无 entity_nodes CRUD
- 用户无法通过主 MCP 工具访问该功能
- DESIGN.md 描述的"实体树阈值 θ(d)"功能未暴露

**删除影响**:
| 影响范围 | 详情 |
|----------|------|
| 直接影响 | `handlers.ts` 中 2 个处理器失效 |
| 间接影响 | `handlers.ts` 一同删除 |
| 数据库 | `entity_nodes` 表完全删除（不保留） |

**删除后清理**:
- 删除 `tools/handlers.ts` 中 `entity_tree_search`, `entity_tree_build` 处理器
- 删除 `sqlite/entity_nodes.ts` 相关 CRUD
- 更新迁移脚本删除表

---

### 2.3 server.ts — 冗余入口

| 属性 | 详情 |
|------|------|
| **文件** | `src/server.ts` |
| **行数** | 54 行 |
| **依赖** | `tools/registry.ts`, `sqlite/migrations` |
| **被引用** | 无 |
| **功能** | MCPServer 类 + startServer() |

**删除理由**:
- `mcp_server.ts` 已是唯一入口点
- `server.ts` 的 MCPServer 类使用 registry 系统（另一套工具系统）
- `startServer()` 未被任何模块调用

**删除影响**:
| 影响范围 | 详情 |
|----------|------|
| 直接影响 | 无调用方 |
| 间接影响 | registry.ts 可一同删除 |
| 数据库 | 无影响 |

---

### 2.4 关联删除清单

删除上述模块后，以下文件也可一并删除：

| 文件 | 行数 | 理由 |
|------|------|------|
| `tools/registry.ts` | 76 | server.ts 使用，crud_handlers 不使用 |
| `tools/definitions.ts` | 81 | registry.ts 依赖，未在 crud_handlers 中 |
| `tools/handlers.ts` | 119 | entity_tree 处理器 + 与 crud_handlers 重叠 |
| `sqlite/queue_jobs.ts` | ~30 | queue/ 模块依赖，表删除 |
| `sqlite/entity_nodes.ts` | ~30 | entity_tree 模块依赖，表删除 |

**保留文件**:
- `tools/crud_handlers.ts` — MCP 主接口
- `tools/AGENTS.md` — 模块文档

---

### 2.5 删除代码统计

| 类别 | 文件数 | 总行数 |
|------|--------|--------|
| queue/ | 4 | 559 |
| entity_tree/ | 4 | 253 |
| server.ts | 1 | 54 |
| registry.ts | 1 | 76 |
| definitions.ts | 1 | 81 |
| handlers.ts | 1 | 119 |
| sqlite/queue_jobs.ts | 1 | ~30 |
| sqlite/entity_nodes.ts | 1 | ~30 |
| **合计** | **14** | **~1212** |

**数据库表删除**:
| 表名 | 理由 |
|------|------|
| `queue_jobs` | queue/ 模块删除，无其他用途 |
| `entity_nodes` | entity_tree/ 模块删除，无其他用途 |

---

## 三、依赖注入设计方案（tsyringe）

### 3.1 为什么选择 tsyringe

| 对比维度 | 原生方案 | tsyringe |
|----------|----------|----------|
| **代码量** | ~300 行容器代码 | ~50 行配置 |
| **类型安全** | 手动维护 token 类型 | 装饰器自动推断 |
| **生命周期** | 手动实现 singleton/transient | 内置 `@singleton()` 装饰器 |
| **测试 mock** | 手动替换实例 | `container.reset()` + 重新注册 |
| **循环依赖** | 需手动处理 | 自动延迟解析 |
| **IDE 支持** | 无特殊支持 | 装饰器跳转、重构支持 |
| **维护成本** | 高（自建容器） | 低（成熟库） |
| **社区支持** | 无 | Microsoft 维护，广泛使用 |

**tsyringe 核心优势**:
1. **装饰器注入** — 类声明即定义依赖，无需额外工厂
2. **自动单例** — `@singleton()` 自动管理生命周期
3. **类型完整** — 完整 TypeScript 支持，编译时检查
4. **测试友好** — 支持容器重置、mock 替换、隔离测试

**为何放弃原生方案**:
- 自建容器增加维护负担（~300 行代码）
- token 类型需手动维护，易出错
- singleton 状态需手动追踪
- 测试 mock 需要额外的 override 机制
- 循环依赖需手动处理延迟解析

---

### 3.2 tsyringe 配置

#### 依赖安装

```bash
bun add tsyringe reflect-metadata
```

#### TypeScript 配置

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

#### 入口初始化

```typescript
// src/mcp_server.ts (顶部)
import 'reflect-metadata'; // 必须最先导入
import { container } from 'tsyringe';

// 注册服务
import './core/registration';

// ... 其他代码
```

---

### 3.3 服务定义

#### 接口定义（保持不变）

```typescript
// src/core/interfaces.ts

/**
 * 数据库连接接口
 */
export interface IDatabaseConnection {
  isOpen(): boolean;
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): DatabaseResult;
  query<T>(sql: string, params?: unknown[]): T[];
  queryOne<T>(sql: string, params?: unknown[]): T | undefined;
  transaction(fn: () => void): void;
  close(): void;
}

/**
 * OpenViking HTTP 客户端接口
 */
export interface IOpenVikingClient {
  healthCheck(): Promise<HealthCheckResult>;
  addResource(params: AddResourceParams): Promise<AddResourceResult>;
  find(params: FindParams): Promise<FindResult>;
  getAbstract(uri: string): Promise<string>;
  getOverview(uri: string): Promise<string>;
  read(uri: string): Promise<ResourceContent>;
  write(uri: string, content: string): Promise<WriteResult>;
  delete(uri: string): Promise<DeleteResult>;
  getTask(taskId: string): Promise<TaskStatus>;
}

/**
 * Embedder 接口
 */
export interface IEmbedder {
  getEmbedding(text: string): Promise<Float32Array>;
  getEmbeddings(texts: string[]): Promise<Float32Array[]>;
  getModel(): string;
  getDimension(): number;
}

/**
 * LLM 客户端接口
 */
export interface ILLMClient {
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  generateJSON<T>(prompt: string, fallback: T): Promise<T>;
}

/**
 * 分层内容生成器接口
 */
export interface ITieredGenerator {
  generateL0(content: string): Promise<string>;
  generateL1(content: string): Promise<string>;
  generateBoth(content: string): Promise<{ abstract: string; overview: string }>;
}

/**
 * 审计日志接口
 */
export interface IAuditLogger {
  log(entry: AuditEntry): void;
}
```

---

#### 服务令牌（用于接口注入）

```typescript
// src/core/tokens.ts

export const TOKENS = {
  // 基础设施层
  DatabaseConnection: 'DatabaseConnection',
  OpenVikingClient: 'OpenVikingClient',
  Embedder: 'Embedder',
  LLMClient: 'LLMClient',

  // 服务层
  TieredGenerator: 'TieredGenerator',
  FactExtractor: 'FactExtractor',
  URIAdapter: 'URIAdapter',
  ScopeMapper: 'ScopeMapper',

  // 横切关注点
  AuditLogger: 'AuditLogger',
} as const;
```

---

#### 服务注册

```typescript
// src/core/registration.ts

import 'reflect-metadata';
import { container, singleton } from 'tsyringe';
import { TOKENS } from './tokens';
import { DatabaseConnection } from '../sqlite/connection';
import { OpenVikingHTTPClient } from '../openviking/http_client';
import { OllamaEmbedder } from '../embedder/ollama';
import { OllamaLLMClient } from '../llm/ollama';
import { TieredGenerator } from '../tiered/generator';
import { FactExtractor } from '../facts/extractor';
import { AuditLogger } from '../utils/audit_logger';
import { URIAdapter } from '../openviking/uri_adapter';
import { ScopeMapper } from '../openviking/scope_mapper';

/**
 * 注册所有服务到 tsyringe 容器
 */
export function registerServices(): void {
  // 基础设施层 — 单例
  container.register(TOKENS.DatabaseConnection, { useClass: DatabaseConnection });
  container.register(TOKENS.OpenVikingClient, { useClass: OpenVikingHTTPClient });
  container.register(TOKENS.Embedder, { useClass: OllamaEmbedder });
  container.register(TOKENS.LLMClient, { useClass: OllamaLLMClient });

  // 服务层 — 单例
  container.register(TOKENS.TieredGenerator, { useClass: TieredGenerator });
  container.register(TOKENS.FactExtractor, { useClass: FactExtractor });
  container.register(TOKENS.URIAdapter, { useClass: URIAdapter });
  container.register(TOKENS.ScopeMapper, { useClass: ScopeMapper });

  // 横切关注点 — 单例
  container.register(TOKENS.AuditLogger, { useClass: AuditLogger });
}

// 自动注册（入口导入时执行）
registerServices();
```

---

### 3.4 装饰器注入示例

#### 单例服务（使用 @singleton）

```typescript
// src/sqlite/connection.ts

import { singleton } from 'tsyringe';
import Database from 'better-sqlite3';

@singleton()
export class DatabaseConnection {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    this.dbPath = process.env.AGENTS_MEM_DB_PATH || '~/.agents_mem/memory.db';
    this.db = new Database(this.dbPath);
  }

  isOpen(): boolean {
    return this.db.open;
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  // ... 其他方法
}
```

---

#### 接口注入（使用 @inject）

```typescript
// src/tools/crud_handlers.ts

import { singleton, inject } from 'tsyringe';
import { TOKENS } from '../core/tokens';
import type { IDatabaseConnection, IOpenVikingClient, IAuditLogger } from '../core/interfaces';

@singleton()
export class CrudHandlers {
  constructor(
    @inject(TOKENS.DatabaseConnection) private db: IDatabaseConnection,
    @inject(TOKENS.OpenVikingClient) private openviking: IOpenVikingClient,
    @inject(TOKENS.AuditLogger) private audit: IAuditLogger,
  ) {}

  async handleMemCreate(params: MemCreateParams): Promise<MemCreateResult> {
    this.audit.log({ action: 'create', resource: params.resource, scope: params.scope });
    
    // 使用注入的依赖
    const result = await this.openviking.addResource({
      uri: params.data.uri,
      content: params.data.content,
      scope: params.scope,
    });

    return result;
  }

  // ... 其他处理器方法
}
```

---

#### 可选依赖注入

```typescript
// src/tiered/generator.ts

import { singleton, inject, optional } from 'tsyringe';
import { TOKENS } from '../core/tokens';
import type { ILLMClient, IAuditLogger } from '../core/interfaces';

@singleton()
export class TieredGenerator {
  constructor(
    @inject(TOKENS.LLMClient) private llm: ILLMClient,
    @optional() @inject(TOKENS.AuditLogger) private audit?: IAuditLogger,
  ) {}

  async generateL0(content: string): Promise<string> {
    // audit 可选，不存在则跳过日志
    this.audit?.log({ action: 'generateL0', contentLength: content.length });
    
    return this.llm.generate(`Summarize in ~100 tokens:\n${content}`);
  }
}
```

---

### 3.5 测试 Mock

#### Mock 类定义

```typescript
// tests/helpers/mocks.ts

import type { IDatabaseConnection, IOpenVikingClient, IEmbedder } from '../../src/core/interfaces';

/**
 * Mock 数据库连接
 */
export class MockDatabaseConnection implements IDatabaseConnection {
  private data: Map<string, unknown[]> = new Map();

  isOpen() { return true; }
  exec(_sql: string) {}
  run(sql: string, params?: unknown[]) { 
    console.log('[MockDB] run:', sql, params);
    return { changes: 1, lastInsertRowid: 1 };
  }
  query<T>(sql: string, params?: unknown[]): T[] {
    console.log('[MockDB] query:', sql, params);
    return (this.data.get(sql) as T[]) || [];
  }
  queryOne<T>(sql: string, params?: unknown[]): T | undefined {
    const results = this.query<T>(sql, params);
    return results[0];
  }
  transaction(fn: () => void) { fn(); }
  close() {}

  // 测试辅助方法
  setMockData(sql: string, data: unknown[]): void {
    this.data.set(sql, data);
  }
}

/**
 * Mock OpenViking 客户端
 */
export class MockOpenVikingClient implements IOpenVikingClient {
  async healthCheck() { return { status: 'ok' }; }
  async addResource(_params: unknown) { return { rootUri: 'mem://test', taskId: 'task-1' }; }
  async find(_params: unknown) { return { memories: [], total: 0 }; }
  async getAbstract(_uri: string) { return 'Mock abstract'; }
  async getOverview(_uri: string) { return 'Mock overview'; }
  async read(_uri: string) { return { content: 'Mock content' }; }
  async write(_uri: string, _content: string) { return { success: true }; }
  async delete(_uri: string) { return { success: true }; }
  async getTask(_taskId: string) { return { status: 'completed' }; }
}

/**
 * Mock Embedder
 */
export class MockEmbedder implements IEmbedder {
  async getEmbedding(_text: string) { return new Float32Array(1024).fill(0.1); }
  async getEmbeddings(_texts: string[]) { 
    return _texts.map(() => new Float32Array(1024).fill(0.1));
  }
  getModel() { return 'mock-model'; }
  getDimension() { return 1024; }
}
```

---

#### 测试容器配置

```typescript
// tests/helpers/test_container.ts

import { container } from 'tsyringe';
import { TOKENS } from '../../src/core/tokens';
import { MockDatabaseConnection, MockOpenVikingClient, MockEmbedder } from './mocks';

/**
 * 创建测试容器（替换所有服务为 Mock）
 */
export function setupTestContainer(): void {
  // 清除所有注册
  container.reset();

  // 注册 Mock 实现
  container.register(TOKENS.DatabaseConnection, { useClass: MockDatabaseConnection });
  container.register(TOKENS.OpenVikingClient, { useClass: MockOpenVikingClient });
  container.register(TOKENS.Embedder, { useClass: MockEmbedder });
  // ... 其他 Mock
}

/**
 * 清理测试容器
 */
export function teardownTestContainer(): void {
  container.reset();
}

/**
 * 注册单个 Mock（针对性替换）
 */
export function registerMock<T>(token: string, mock: T): void {
  container.register(token, { useValue: mock });
}
```

---

#### 测试示例

```typescript
// tests/tools/crud_handlers.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { TOKENS } from '../../src/core/tokens';
import { CrudHandlers } from '../../src/tools/crud_handlers';
import { setupTestContainer, teardownTestContainer, registerMock } from '../helpers/test_container';
import { MockOpenVikingClient } from '../helpers/mocks';

describe('CrudHandlers', () => {
  beforeEach(() => {
    setupTestContainer();
  });

  afterEach(() => {
    teardownTestContainer();
  });

  it('should create document with injected dependencies', async () => {
    // 获取注入后的处理器
    const handlers = container.resolve(CrudHandlers);

    const result = await handlers.handleMemCreate({
      resource: 'document',
      data: { title: 'Test', content: 'Test content' },
      scope: { userId: 'user-1' },
    });

    expect(result).toBeDefined();
    expect(result.rootUri).toContain('mem://');
  });

  it('should use custom mock for specific test', async () => {
    // 创建自定义 Mock
    const customMock = new MockOpenVikingClient();
    customMock.addResource = async () => ({ rootUri: 'mem://custom', taskId: 'custom-task' });
    
    registerMock(TOKENS.OpenVikingClient, customMock);

    const handlers = container.resolve(CrudHandlers);
    const result = await handlers.handleMemCreate({
      resource: 'document',
      data: { title: 'Test' },
      scope: { userId: 'user-1' },
    });

    expect(result.rootUri).toBe('mem://custom');
  });
});
```

---

### 3.6 完全重写示例

#### 重写前（单例模式 + 工厂函数）

```typescript
// src/sqlite/connection.ts (旧版)

let connectionInstance: DatabaseConnection | null = null;

export class DatabaseConnection {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.AGENTS_MEM_DB_PATH || '~/.agents_mem/memory.db';
    this.db = new Database(dbPath);
  }

  // ... 方法实现
}

export function getConnection(): DatabaseConnection {
  if (!connectionInstance) {
    connectionInstance = new DatabaseConnection();
  }
  return connectionInstance;
}

export function resetConnection(): void {
  if (connectionInstance) {
    connectionInstance.close();
  }
  connectionInstance = null;
}
```

---

#### 重写后（tsyringe 单例）— 无工厂函数

```typescript
// src/sqlite/connection.ts (新版)

import { singleton } from 'tsyringe';
import Database from 'better-sqlite3';

@singleton()
export class DatabaseConnection {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.AGENTS_MEM_DB_PATH || '~/.agents_mem/memory.db';
    this.db = new Database(dbPath);
  }

  isOpen(): boolean {
    return this.db.open;
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  // ... 其他方法

  close(): void {
    this.db.close();
  }
}

// 注意：getConnection() 和 resetConnection() 已完全删除
// 使用方式：
//   - 生产代码：构造函数注入或 container.resolve(DatabaseConnection)
//   - 测试代码：container.reset() 后重新注册 Mock
```

---

#### 调用点变更示例

```typescript
// src/tools/crud_handlers.ts (旧版)

import { getConnection } from '../sqlite/connection';
import { getOpenVikingClient } from '../openviking/http_client';

export function handleMemCreate(params: MemCreateParams) {
  const db = getConnection();  // 旧方式：工厂函数
  const client = getOpenVikingClient();  // 旧方式：工厂函数
  
  // ... 业务逻辑
}
```

```typescript
// src/tools/crud_handlers.ts (新版)

import { singleton, inject } from 'tsyringe';
import { TOKENS } from '../core/tokens';
import type { IDatabaseConnection, IOpenVikingClient } from '../core/interfaces';

@singleton()
export class CrudHandlers {
  constructor(
    @inject(TOKENS.DatabaseConnection) private db: IDatabaseConnection,
    @inject(TOKENS.OpenVikingClient) private client: IOpenVikingClient,
  ) {}

  async handleMemCreate(params: MemCreateParams) {
    // 直接使用注入的依赖，无需工厂函数
    // ... 业务逻辑
  }
}

// 入口使用方式：
// const handlers = container.resolve(CrudHandlers);
// handlers.handleMemCreate(params);
```

---

#### 完全重写策略（无过渡期）

| 阶段 | 变更 | 说明 |
|------|------|------|
| Phase 1 | 安装 tsyringe + 创建基础设施 | 接口、令牌、注册 |
| Phase 2 | 一次性重写所有模块 | 删除所有工厂函数，更新所有调用点 |
| Phase 3 | 重写测试 | 使用 container.reset() 替代旧 reset 函数 |
| Phase 4 | 文档更新 | 同步 ARCHITECTURE.md, AGENTS.md |

**关键原则**:
- ❌ **不保留兼容层** — 所有 `getXXX()`, `resetXXX()` 函数完全删除
- ❌ **无过渡期** — 一次性完成，不提供 deprecated 函数
- ✅ **统一注入** — 生产代码使用构造函数注入，测试使用 container.reset()
- ✅ **一次性导入更新** — 所有 import 路径统一修改

---

### 3.7 tsyringe vs 原生方案对比

| 特性 | tsyringe | 原生自建 |
|------|----------|----------|
| **装饰器支持** | ✅ `@singleton`, `@inject`, `@optional` | ❌ 需手动实现 |
| **类型推断** | ✅ 自动推断注入类型 | ❌ 手动维护 token 类型 |
| **生命周期** | ✅ 内置 singleton/transient | ❌ 需自建逻辑 |
| **循环依赖** | ✅ 自动延迟解析 | ❌ 需手动处理 |
| **测试 mock** | ✅ `container.reset()` + 重注册 | ❌ 需 override 机制 |
| **代码量** | ~50 行配置 | ~300 行容器代码 |
| **维护成本** | 低（成熟库） | 高（自维护） |
| **社区支持** | Microsoft 维护 | 无 |

---

## 四、重构路线图

### 4.1 Phase 0: 删除冗余模块（优先级最高）

| 步骤 | 任务 | 预估时间 | 风险 |
|------|------|----------|------|
| 0.1 | 删除 `src/queue/` 目录 | 10 分钟 | 低 |
| 0.2 | 删除 `sqlite/queue_jobs.ts` 文件 | 5 分钟 | 低 |
| 0.3 | 删除 `queue_jobs` 数据库表（迁移脚本） | 15 分钟 | 中 |
| 0.4 | 删除 `src/entity_tree/` 目录 | 10 分钟 | 低 |
| 0.5 | 删除 `sqlite/entity_nodes.ts` 文件 | 5 分钟 | 低 |
| 0.6 | 删除 `entity_nodes` 数据库表（迁移脚本） | 15 分钟 | 中 |
| 0.7 | 删除 `server.ts` | 5 分钟 | 低 |
| 0.8 | 删除 `tools/registry.ts` | 5 分钟 | 低 |
| 0.9 | 删除 `tools/definitions.ts` | 5 分钟 | 低 |
| 0.10 | 删除 `tools/handlers.ts` | 10 分钟 | 低 |
| 0.11 | 更新 DESIGN.md 文档 | 15 分钟 | 低 |
| 0.12 | 运行测试验证 | 15 分钟 | 低 |

**预估总时间**: 1.5 小时

---

### 4.2 Phase 1: 安装 tsyringe + 创建基础设施（优先级高）

| 步骤 | 任务 | 预估时间 | 风险 |
|------|------|----------|------|
| 1.1 | 安装 `tsyringe` + `reflect-metadata` | 5 分钟 | 低 |
| 1.2 | 配置 `tsconfig.json`（decorators） | 5 分钟 | 低 |
| 1.3 | 创建 `src/core/interfaces.ts` | 15 分钟 | 低 |
| 1.4 | 创建 `src/core/tokens.ts` | 10 分钟 | 低 |
| 1.5 | 创建 `src/core/registration.ts` | 15 分钟 | 低 |
| 1.6 | 更新 `mcp_server.ts` 入口导入 | 10 分钟 | 低 |
| 1.7 | 编写单元测试（基础注入验证） | 20 分钟 | 低 |
| 1.8 | 更新 ARCHITECTURE.md | 10 分钟 | 低 |

**预估总时间**: 1.5 小时

---

### 4.3 Phase 2: 完全重写现有模块（优先级中，一次性完成）

**核心原则**: 一次性删除所有工厂函数，无兼容层

| 步骤 | 模块 | 变更内容 | 预估时间 | 风险 |
|------|------|----------|----------|------|
| 2.1 | `sqlite/connection.ts` | 添加 @singleton，删除 getConnection/resetConnection | 15 分钟 | 中 |
| 2.2 | `openviking/http_client.ts` | 添加 @singleton，删除 getClient/resetClient | 15 分钟 | 中 |
| 2.3 | `embedder/ollama.ts` | 添加 @singleton，删除 getEmbedder | 10 分钟 | 低 |
| 2.4 | `llm/ollama.ts` | 添加 @singleton，删除 getLLMClient/resetLLMClient | 10 分钟 | 低 |
| 2.5 | `tiered/generator.ts` | 添加 @singleton + @inject，删除 getGenerator/resetGenerator | 20 分钟 | 中 |
| 2.6 | `facts/extractor.ts` | 添加 @singleton + @inject，删除 getExtractor/resetExtractor | 20 分钟 | 中 |
| 2.7 | `openviking/uri_adapter.ts` | 添加 @singleton，删除 getURIAdapter | 10 分钟 | 低 |
| 2.8 | `openviking/scope_mapper.ts` | 添加 @singleton，删除 getScopeMapper | 10 分钟 | 低 |
| 2.9 | `utils/audit_logger.ts` | 添加 @singleton，删除 getAuditLogger/resetAuditLogger | 10 分钟 | 低 |
| 2.10 | `utils/log_buffer.ts` | 添加 @singleton（如有工厂函数则删除） | 10 分钟 | 低 |
| 2.11 | `tools/crud_handlers.ts` | 重构为 @singleton + 构造函数注入，删除所有工厂调用 | 40 分钟 | 中-高 |
| 2.12 | **更新所有调用点** | 扫描并更新所有 import 和调用 | 60 分钟 | 中-高 |
| 2.13 | **删除所有工厂函数导出** | 从各模块 index.ts 中移除 | 20 分钟 | 中 |
| 2.14 | 编译验证 | bun run typecheck | 10 分钟 | 低 |

**预估总时间**: 3.5 小时

**Phase 2 完整性检查清单**:
- ✅ 所有 `getXXX()` 函数已删除
- ✅ 所有 `createXXX()` 函数已删除
- ✅ 所有 `resetXXX()` 函数已删除
- ✅ 所有模块 index.ts 不再导出工厂函数
- ✅ 所有调用点已改为注入或 container.resolve()
- ✅ 编译通过，无 TypeScript 错误

---

### 4.4 Phase 3: 统一测试基础设施（优先级中）

| 步骤 | 任务 | 预估时间 | 风险 |
|------|------|----------|------|
| 3.1 | 创建 `tests/helpers/mocks.ts` | 20 分钟 | 低 |
| 3.2 | 创建 `tests/helpers/test_container.ts` | 15 分钟 | 低 |
| 3.3 | 重写现有测试（删除旧 reset 调用） | 1.5 小时 | 中 |
| 3.4 | 验证所有测试通过 | 15 分钟 | 低 |

**预估总时间**: 2.5 小时

**测试重写要点**:
- ❌ 删除所有 `resetConnection()`, `resetClient()` 等调用
- ✅ 使用 `setupTestContainer()` 在 beforeEach 中初始化
- ✅ 使用 `teardownTestContainer()` 在 afterEach 中清理
- ✅ 使用 `container.resolve(Class)` 获取测试实例

---

### 4.5 Phase 4: 文档更新（优先级低）

**注意**: 代码变更已在 Phase 2 完成，Phase 4 仅做文档同步

| 步骤 | 任务 | 预估时间 | 风险 |
|------|------|----------|------|
| 4.1 | 更新 ARCHITECTURE.md（DI 模块结构） | 15 分钟 | 低 |
| 4.2 | 更新 AGENTS.md（删除单例描述） | 10 分钟 | 低 |
| 4.3 | 更新 DESIGN.md（注入说明） | 15 分钟 | 低 |
| 4.4 | 更新各模块 AGENTS.md | 20 分钟 | 低 |

**预估总时间**: 1 小时

---

### 4.6 总时间预估

| 阶段 | 时间 | 累计 |
|------|------|------|
| Phase 0 | 1.5 小时 | 1.5 小时 |
| Phase 1 | 1.5 小时 | 3.0 小时 |
| Phase 2 | 3.5 小时 | 6.5 小时 |
| Phase 3 | 2.5 小时 | 9.0 小时 |
| Phase 4 | 1.0 小时 | 10.0 小时 |

**建议执行顺序**: Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4

---

## 五、风险评估（完全重写策略）

### 5.1 删除模块风险

| 模块/表 | 风险 | 影响 | 应对措施 |
|---------|------|------|----------|
| `queue/` | 🟢 低 | 功能已废弃，OpenViking 替代 | 直接删除 |
| `queue_jobs` 表 | 🟡 中 | 需迁移脚本 | 先备份数据，再删除 |
| `entity_tree/` | 🟢 低 | handlers.ts 失效，一并删除 | 直接删除 |
| `entity_nodes` 表 | 🟡 中 | 需迁移脚本 | 先备份数据，再删除 |
| `server.ts` | 🟢 低 | 无调用方 | 直接删除 |
| `registry.ts` | 🟢 低 | 仅 server.ts 使用 | 删除 server.ts 后删除 |
| `handlers.ts` | 🟢 低 | entity_tree 处理器失效 | 一并删除 |

---

### 5.2 tsyringe DI 风险（完全重写）

| 风险项 | 风险等级 | 影响 | 应对措施 |
|--------|----------|------|----------|
| **一次性调用点更新遗漏** | 🟠 中-高 | 运行时 undefined 错误 | 使用 grep 全量扫描，逐文件确认 |
| **循环依赖** | 🟡 中 | 运行时警告 | 使用 `@optional()` 或延迟 resolve |
| **装饰器配置错误** | 🟢 低 | 编译失败 | tsconfig.json 严格检查 |
| **单例状态污染** | 🟢 低 | 测试失败 | `container.reset()` 每测试 |
| **接口定义不完整** | 🟡 中 | 类型错误 | 渐进添加接口方法 |
| **测试 reset 遗漏** | 🟡 中 | 测试污染 | beforeEach/afterEach 统一 reset |

**完全重写额外风险**:
| 风险项 | 风险等级 | 影响 | 应对措施 |
|--------|----------|------|----------|
| **无兼容层导致编译中断** | 🟠 中-高 | Phase 2 完成前无法编译 | Phase 2 作为原子操作，一次性完成 |
| **import 路径批量修改** | 🟠 中-高 | IDE 批量重命名可能遗漏 | 手动逐文件确认 + grep 扫描 |
| **测试全部失败** | 🟡 中 | Phase 2 完成后测试需重写 | Phase 3 专门处理测试 |
| **文档同步延迟** | 🟡 中 | 开发者困惑 | Phase 4 立即更新 |

---

### 5.3 完全重写 vs 渐进迁移风险对比

| 维度 | 渐进迁移 | 完全重写 |
|------|----------|----------|
| **过渡期维护成本** | 🟡 中（需维护兼容层） | 🟢 低（无过渡期） |
| **一次性失败风险** | 🟢 低（可回滚） | 🟠 中-高（需原子完成） |
| **代码整洁度** | 🟡 中（遗留 deprecated） | 🟢 高（无遗留） |
| **测试重写工作量** | 🟢 低（渐进替换） | 🟡 中（一次性重写） |
| **文档同步复杂度** | 🟡 中（多阶段更新） | 🟢 低（一次性更新） |
| **长期维护成本** | 🟡 中（兼容层残留） | 🟢 低（无残留） |

**完全重写风险应对策略**:
1. **原子操作** — Phase 2 作为不可分割的操作，一次性完成所有变更
2. **全量扫描** — 使用 grep 搜索所有 `getXXX()` 调用，确保无遗漏
3. **分模块执行** — Phase 2 内部按模块分步，但整体作为原子提交
4. **测试先行** — Phase 1 创建基础注入验证测试，确保 DI 配置正确
5. **回滚准备** — Git 分支开发，Phase 2 失败可整体回滚

---

### 5.4 测试风险

| 风险项 | 风险等级 | 影响 | 应对措施 |
|--------|----------|------|----------|
| Mock 不完整 | 🟡 中 | 测试失败 | 创建完整 Mock 类 |
| 测试覆盖下降 | 🟡 中 | 质量门禁失败 | DI 后重新编写测试 |
| 容器重置遗漏 | 🟡 中 | 测试污染 | beforeEach/afterEach 统一 reset |
| **旧 reset 函数调用残留** | 🟠 中-高 | 测试运行时错误 | grep 扫描删除所有 resetXXX() |

---

### 5.5 文档风险

| 风险项 | 风险等级 | 影响 | 应对措施 |
|--------|----------|------|----------|
| ARCHITECTURE.md 未同步 | 🟡 中 | 开发者困惑 | Phase 4 立即更新 |
| DESIGN.md 实体树描述过时 | 🟡 中 | 规范冲突 | Phase 0 删除模块时更新 |
| AGENTS.md 单例描述过时 | 🟡 中 | 使用错误 | Phase 4 删除单例描述 |

---

### 5.6 总体风险矩阵（完全重写）

| 风险类型 | 数量 | 最高等级 | 建议策略 |
|----------|------|----------|----------|
| 删除模块 | 7 | 🟡 中 | 先检查依赖再删除 |
| tsyringe DI（完全重写） | 6 | 🟠 中-高 | 原子操作 + 全量扫描 |
| 测试 | 4 | 🟠 中-高 | Phase 3 专门处理 |
| 文档 | 3 | 🟡 中 | Phase 4 同步更新 |

**总体风险评估**:
- 渐进迁移最高风险：🟡 中（兼容层维护）
- 完全重写最高风险：🟠 中-高（一次性调用点更新）
- **完全重写风险可控**：通过原子操作 + 全量扫描 + 回滚准备

---

## 六、决策确认记录

| 决策项 | 状态 | 日期 | 确认者 |
|--------|------|------|--------|
| queue/ 模块删除 | ✅ 确认 | 2026-04-15 | 用户 |
| queue_jobs 表删除 | ✅ 确认 | 2026-04-15 | 用户 |
| entity_tree/ 模块删除 | ✅ 确认 | 2026-04-15 | 用户 |
| entity_nodes 表删除 | ✅ 睇确认 | 2026-04-15 | 用户 |
| DI 方案选择 tsyringe | ✅ 确认 | 2026-04-15 | 用户 |
| Phase 0 设计讨论 | ✅ 确认 | 2026-04-15 | 用户 |
| **完全迁移策略** | ✅ 确认 | 2026-04-15 | 用户 |
| **完全重写（无兼容层）** | ✅ 确认 | 2026-04-15 | 用户 |
| **统一使用 tsyringe DI** | ✅ 确认 | 2026-04-15 | 用户 |
| **删除所有工厂函数** | ✅ 确认 | 2026-04-15 | 用户 |

---

## 七、附录

### 7.1 单例迁移清单（完全重写方式）

**迁移原则**: 直接删除工厂函数，无兼容层

| 模块 | 旧单例变量 | 旧工厂函数 | 重写方式 |
|------|-----------|-----------|----------|
| `sqlite/connection.ts` | `connectionInstance` | `getConnection()` `resetConnection()` | @singleton() + 删除工厂函数 |
| `openviking/http_client.ts` | `clientInstance` | `getClient()` `resetClient()` | @singleton() + 删除工厂函数 |
| `embedder/ollama.ts` | `embedderInstance` | `getEmbedder()` | @singleton() + 删除工厂函数 |
| `llm/ollama.ts` | `llmClientInstance` | `getLLMClient()` `resetLLMClient()` | @singleton() + 删除工厂函数 |
| `tiered/generator.ts` | `generatorInstance` | `getTieredGenerator()` `resetTieredGenerator()` | @singleton() + @inject + 删除工厂函数 |
| `facts/extractor.ts` | `extractorInstance` | `getFactExtractor()` `resetFactExtractor()` | @singleton() + @inject + 删除工厂函数 |
| `openviking/uri_adapter.ts` | `adapterInstance` | `getURIAdapter()` | @singleton() + 删除工厂函数 |
| `openviking/scope_mapper.ts` | `mapperInstance` | `getScopeMapper()` | @singleton() + 删除工厂函数 |
| `utils/audit_logger.ts` | `auditLoggerInstance` | `getAuditLogger()` `resetAuditLogger()` | @singleton() + 删除工厂函数 |
| `utils/log_buffer.ts` | `logBufferInstance` | （如有） | @singleton() + 删除工厂函数 |

**重写后使用方式**:
| 场景 | 旧方式 | 新方式 |
|------|--------|--------|
| 生产代码获取实例 | `getConnection()` | `container.resolve(DatabaseConnection)` 或构造函数注入 |
| 测试重置实例 | `resetConnection()` | `container.reset()` |
| 测试获取实例 | `getConnection()` | `container.resolve(DatabaseConnection)` |

---

### 7.2 删除模块依赖图

```
queue/index.ts
  ├── queue/embedding_queue.ts
  │    ├── sqlite/queue_jobs.ts ────── queue_jobs 表
  │    ├── embedder/ollama.ts
  │    └── openviking/scope_mapper.ts
  ├── queue/converters.ts
  └── queue/types.ts

entity_tree/index.ts
  ├── entity_tree/search.ts
  ├── entity_tree/builder.ts
  │    ├── entity_tree/aggregator.ts
  │    └── entity_tree/threshold.ts
  └── sqlite/entity_nodes.ts ────── entity_nodes 表

server.ts
  └── registry.ts
       ├── definitions.ts
       └── handlers.ts
            ├── entity_tree/search.ts
            ├── entity_tree/builder.ts
            ├── facts/extractor.ts
            ├── materials/store.ts
            └── openviking/http_client.ts
```

---

### 7.3 tsyringe DI 迁移后的模块结构

```
src/
├── core/
│   ├── interfaces.ts     # 服务接口定义
│   ├── tokens.ts         # 服务令牌（用于 @inject）
│   ├── registration.ts   # 服务注册（入口导入）
│   ├── types.ts          # 类型定义
│   ├── scope.ts          # Scope 工具
│   ├── uri.ts            # URI 工具
│   └── constants.ts      # 常量
├── sqlite/
│   └── connection.ts     # @singleton() DatabaseConnection（无工厂函数）
├── openviking/
│   ├── http_client.ts    # @singleton() OpenVikingHTTPClient（无工厂函数）
│   ├── uri_adapter.ts    # @singleton() URIAdapter（无工厂函数）
│   └── scope_mapper.ts   # @singleton() ScopeMapper（无工厂函数）
├── embedder/
│   └── ollama.ts         # @singleton() OllamaEmbedder（无工厂函数）
├── llm/
│   └── ollama.ts         # @singleton() OllamaLLMClient（无工厂函数）
├── tiered/
│   └── generator.ts      # @singleton() + @inject(LLMClient)（无工厂函数）
├── facts/
│   └── extractor.ts      # @singleton() + @inject(LLMClient)（无工厂函数）
├── materials/            # 无 DI（无单例）
├── utils/
│   ├── audit_logger.ts   # @singleton() AuditLogger（无工厂函数）
│   └── log_buffer.ts     # @singleton() LogBuffer（无工厂函数）
├── tools/
│   └── crud_handlers.ts  # @singleton() + @inject(多个服务)（无工厂函数）
└── mcp_server.ts         # 入口点（导入 registration）
```

---

### 7.4 tsyringe 快速参考

#### 常用装饰器

| 装饰器 | 用途 | 示例 |
|--------|------|------|
| `@singleton()` | 单例服务 | `@singleton() class Db {}` |
| `@injectable()` | 可注入类（非单例） | `@injectable() class Service {}` |
| `@inject(token)` | 注入依赖 | `constructor(@inject(TOKEN) dep: IDep)` |
| `@optional()` | 可选依赖 | `@optional() @inject(TOKEN) dep?` |
| `@registry()` | 多服务注册 | 配合 `useClass`/`useValue` |

#### 常用 API

| API | 用途 |
|-----|------|
| `container.resolve<T>(Class)` | 解析服务 |
| `container.register(token, { useClass })` | 注册类 |
| `container.register(token, { useValue })` | 注册值 |
| `container.reset()` | 清除所有单例（测试用） |
| `container.clearInstances()` | 仅清除实例 |

---

### 7.5 破坏性变更清单（完全重写）

**本节列出 Phase 2 完成后所有需要修改的导入/调用点**

#### 7.5.1 删除的导出函数

| 模块 | 删除的函数 | 替代方案 |
|------|-----------|----------|
| `sqlite/connection.ts` | `getConnection()` `resetConnection()` | `container.resolve(DatabaseConnection)` / `container.reset()` |
| `openviking/http_client.ts` | `getClient()` `resetClient()` | `container.resolve(OpenVikingHTTPClient)` / `container.reset()` |
| `embedder/ollama.ts` | `getEmbedder()` | `container.resolve(OllamaEmbedder)` 或构造函数注入 |
| `llm/ollama.ts` | `getLLMClient()` `resetLLMClient()` | `container.resolve(OllamaLLMClient)` / `container.reset()` |
| `tiered/generator.ts` | `getTieredGenerator()` `resetTieredGenerator()` | `container.resolve(TieredGenerator)` / `container.reset()` |
| `facts/extractor.ts` | `getFactExtractor()` `resetFactExtractor()` | `container.resolve(FactExtractor)` / `container.reset()` |
| `openviking/uri_adapter.ts` | `getURIAdapter()` | `container.resolve(URIAdapter)` 或构造函数注入 |
| `openviking/scope_mapper.ts` | `getScopeMapper()` | `container.resolve(ScopeMapper)` 或构造函数注入 |
| `utils/audit_logger.ts` | `getAuditLogger()` `resetAuditLogger()` | `container.resolve(AuditLogger)` / `container.reset()` |
| `utils/log_buffer.ts` | （如有） | `container.resolve(LogBuffer)` |

---

#### 7.5.2 需要修改的 import 路径

**旧导入方式**:
```typescript
import { getConnection } from '../sqlite/connection';
import { getOpenVikingClient } from '../openviking/http_client';
import { getEmbedder } from '../embedder/ollama';
import { getLLMClient } from '../llm/ollama';
import { getTieredGenerator } from '../tiered/generator';
import { getFactExtractor } from '../facts/extractor';
import { getURIAdapter } from '../openviking/uri_adapter';
import { getScopeMapper } from '../openviking/scope_mapper';
import { getAuditLogger } from '../utils/audit_logger';
```

**新导入方式**:
```typescript
import { container } from 'tsyringe';
import { TOKENS } from '../core/tokens';
import { DatabaseConnection } from '../sqlite/connection';
import { OpenVikingHTTPClient } from '../openviking/http_client';
import { OllamaEmbedder } from '../embedder/ollama';
import { OllamaLLMClient } from '../llm/ollama';
import { TieredGenerator } from '../tiered/generator';
import { FactExtractor } from '../facts/extractor';
import { URIAdapter } from '../openviking/uri_adapter';
import { ScopeMapper } from '../openviking/scope_mapper';
import { AuditLogger } from '../utils/audit_logger';

// 或使用接口类型
import type { IDatabaseConnection, IOpenVikingClient } from '../core/interfaces';
```

---

#### 7.5.3 需要修改的调用点

**旧调用方式**:
```typescript
// 直接调用工厂函数
const db = getConnection();
const client = getOpenVikingClient();
const embedder = getEmbedder();
const llm = getLLMClient();

// 测试中重置
resetConnection();
resetClient();
resetLLMClient();
```

**新调用方式**:
```typescript
// 生产代码：构造函数注入（推荐）
@singleton()
export class MyService {
  constructor(
    @inject(TOKENS.DatabaseConnection) private db: IDatabaseConnection,
    @inject(TOKENS.OpenVikingClient) private client: IOpenVikingClient,
  ) {}
}

// 生产代码：直接 resolve（入口点）
const db = container.resolve(DatabaseConnection);
const client = container.resolve(OpenVikingHTTPClient);

// 测试代码：容器重置
container.reset(); // 替代所有 resetXXX() 函数
```

---

#### 7.5.4 测试代码修改清单

| 旧测试代码 | 新测试代码 |
|-----------|-----------|
| `resetConnection()` | `container.reset()` |
| `resetClient()` | `container.reset()` |
| `resetLLMClient()` | `container.reset()` |
| `resetTieredGenerator()` | `container.reset()` |
| `resetFactExtractor()` | `container.reset()` |
| `resetAuditLogger()` | `container.reset()` |
| `getConnection()` | `container.resolve(DatabaseConnection)` |
| `getClient()` | `container.resolve(OpenVikingHTTPClient)` |

**测试模板**:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { container } from 'tsyringe';
import { setupTestContainer, teardownTestContainer } from '../helpers/test_container';

describe('MyModule', () => {
  beforeEach(() => {
    setupTestContainer(); // 替代所有 resetXXX() 调用
  });

  afterEach(() => {
    teardownTestContainer();
  });

  it('should work', async () => {
    const service = container.resolve(MyService);
    // ...
  });
});
```

---

#### 7.5.5 文件级变更统计

| 文件类型 | 预估变更数量 | 变更内容 |
|----------|-------------|----------|
| 生产代码模块 | ~10 | 删除工厂函数，添加装饰器 |
| 生产代码调用点 | ~30-50 | 更新 import 和调用方式 |
| 测试文件 | ~20-30 | 删除 reset 调用，使用 container |
| 模块 index.ts | ~10 | 删除工厂函数导出 |
| **总计** | **~70-100** | |

---

#### 7.5.6 grep 扫描命令（验证遗漏）

**Phase 2 完成后执行**:
```bash
# 扫描残留的工厂函数调用
grep -r "getConnection\|getClient\|getEmbedder\|getLLMClient\|getTieredGenerator\|getFactExtractor\|getURIAdapter\|getScopeMapper\|getAuditLogger" src/ tests/

# 扫描残留的 reset 函数调用
grep -r "resetConnection\|resetClient\|resetLLMClient\|resetTieredGenerator\|resetFactExtractor\|resetAuditLogger" src/ tests/

# 扫描残留的单例变量
grep -r "connectionInstance\|clientInstance\|embedderInstance\|llmClientInstance\|generatorInstance\|extractorInstance\|adapterInstance\|mapperInstance\|auditLoggerInstance" src/
```

**预期结果**: 无匹配（所有工厂函数和单例变量已删除）

---

**文档完成** | Phase 0 设计确认 | 完全重写策略 | 版本 2.1