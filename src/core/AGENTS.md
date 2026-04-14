# src/core

基础层，所有模块都从此处导入。

## 核心类型 (types.ts)

- `MaterialURI` - mem:// URI 结构
- `Scope` - 用户/代理/团队隔离
- `EntityType` - 实体联合类型
- `FactType` - 事实分类
- `TieredContent` - L0/L1 内容包装

## 关键函数

**URI** (uri.ts):
- `buildURI()` - 构建 mem:// URI
- `parseURI()` - 解析 MaterialURI
- `URI_FORMAT` - 正则格式

**Scope** (scope.ts):
- `createScope(userId, agentId?, teamId?)` - 工厂函数
- `validateScope()` - 验证必填字段
- `ScopeFilter` - SQL 过滤构建器

## 常量

```typescript
EMBED_DIMENSION = 1024    // bge-m3
L0_TOKEN_BUDGET = 100
L1_TOKEN_BUDGET = 2000
BASE_THRESHOLD = 0.7      // 实体树
DEPTH_FACTOR = 0.1
STORAGE_DIR = ~/.agents_mem/
```

## 注意

- **无 index.ts**: 没有根导出 barrel 文件
