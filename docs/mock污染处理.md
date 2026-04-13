在 Bun + Vitest 场景下，Mock 污染（即前一个测试的 Mock 状态残留影响后续测试）主要是因为 Mock 状态（调用历史、自定义实现、模块替换）没有被正确隔离和清理。针对这个问题，我们可以从**函数/Spy Mock 清理**、**模块 Mock 隔离**、**局部自动清理**三个层面来解决，同时区分「Bun 自带测试运行器」和「Vitest 运行器（Bun 环境）」两种场景的差异：

---

## 一、先搞懂：3种 Mock 清理的区别
不管是哪种运行环境，Mock 清理都分为三个层级，搞清楚它们的区别才能避免用错：
| 方法 | 作用 | 适用场景 |
|------|------|----------|
| `clearAllMocks` | 仅清除所有 Mock 的**调用历史**（`calls`/`results` 等），**保留自定义实现** | 解决「前一个测试调用了 Mock，导致后一个测试的 `toHaveBeenCalledTimes` 统计错误」 |
| `resetAllMocks` | 清除调用历史 + 把 Mock 实现重置为**空函数（返回 undefined）**，但不会恢复原始函数 | 临时重置 Mock 实现，不恢复原始逻辑 |
| `restoreAllMocks` | 清除调用历史 + 把 Spy 的实现**恢复为原始函数** | 彻底还原被 Spy 篡改的方法，是最常用的「防污染」手段 |

> ⚠️ 注意：以上三个方法都**不会处理模块 Mock**（比如 `vi.mock`/`mock.module` 替换的整个模块），模块 Mock 需要单独处理。

---

## 二、函数/Spy Mock 的自动全局清理
这是最基础的防污染手段，通过全局配置，让每个测试结束后自动清理 Spy 的状态，避免残留。

### 场景1：使用 Vitest 运行器（Bun 环境）
如果你是用 Vitest 作为测试框架，仅把 Bun 作为运行环境（即 `environment: 'bun'`），可以直接在 Vitest 配置中开启自动清理：
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest'

export default defineConfig({
  test: {
    environment: 'bun', // 指定 Bun 环境
    clearMocks: true,  // 每个测试后自动清除调用历史
    restoreMocks: true,// 每个测试后自动恢复 Spy 的原始实现
    // 👉 一般不需要开启 resetMocks，因为 restoreMocks 已经包含了 reset 的能力，且会还原原始逻辑
  }
})
```

### 场景2：使用 Bun 自带的测试运行器
如果你用的是 Bun 原生的 `bun test` 命令（兼容 Vitest 的 `vi` API），Bun 默认不会自动清理 Mock，需要手动添加全局清理钩子：
1. 创建全局测试 setup 文件 `test.setup.ts`：
```typescript
// test.setup.ts
import { afterEach } from "bun:test";
import { mock } from "bun:test";

// 所有测试执行完后，自动清理 Mock
afterEach(() => {
  mock.clearAllMocks(); // 清调用历史
  mock.restore();       // 恢复所有 Spy 的原始实现
})
```
2. 在 `bunfig.toml` 中配置预加载这个文件，让所有测试都生效：
```toml
# bunfig.toml
[test]
preload = ["./test.setup.ts"]
```

---

## 三、模块 Mock 的隔离与清理
模块 Mock（比如模拟整个第三方模块、本地模块）是最容易产生污染的，因为它会修改模块缓存，默认的 `restoreAllMocks` 管不到它。我们需要单独处理模块的隔离：

### 核心方案：重置模块缓存 + 动态导入
通过重置模块缓存，让每个测试都能拿到全新的模块实例，避免前一个测试的 Mock 残留：
```typescript
import { beforeEach, it, expect } from "vitest"; // 或 bun:test

beforeEach(() => {
  // 1. 重置所有模块缓存，清除之前的 Mock 残留
  vi.resetModules(); 
})

it("测试模块 Mock1", async () => {
  // 2. 动态导入模块！不能用顶层 import，顶层 import 不会被 resetModules 重置
  const module = await import("./your-module.ts");
  
  // 3. 当前测试独有的模块 Mock，不会影响其他测试
  vi.mock("./your-module.ts", () => ({
    fetchData: () => Promise.resolve("mock1")
  }))

  // 测试逻辑
  expect(await module.fetchData()).toBe("mock1");
})

it("测试模块 Mock2", async () => {
  // 因为 beforeEach 重置了缓存，这里拿到的是全新的模块，不会被上一个测试的 Mock 影响
  const module = await import("./your-module.ts");
  
  vi.mock("./your-module.ts", () => ({
    fetchData: () => Promise.resolve("mock2")
  }))

  expect(await module.fetchData()).toBe("mock2");
})
```

> 如果是 Bun 原生运行器，没有 `vi.resetModules`，可以利用 Bun 模块 Mock 的**实时绑定特性**，在 `beforeEach` 中重置模块的默认 Mock：
> ```typescript
> import { beforeEach, mock } from "bun:test";
> 
> beforeEach(() => {
>   // 每个测试前，把模块 Mock 重置为默认值，覆盖上一个测试的修改
>   mock.module("./your-module.ts", () => ({
>     fetchData: () => Promise.resolve("default")
>   }))
> })
> ```

---

## 四、局部 Mock 的自动清理（Bun 1.3.9+ 新特性）
Bun 1.3.9 之后，Mock 和 SpyOn 都实现了 `Symbol.dispose`，可以用 `using` 关键字实现**作用域内自动清理**：
- 用 `using` 声明的 Mock，一旦超出作用域，会自动调用 `mockRestore()` 还原原始实现
- 完全不用手动写清理逻辑，也不会污染其他测试，非常适合单个测试的临时 Mock

```typescript
import { test, expect, spyOn } from "bun:test";
import api from "./api";

test("临时 Mock 接口请求", async () => {
  // 👉 用 using 声明 Spy，出了这个测试的作用域，自动还原！
  using fetchSpy = spyOn(api, "fetch");
  fetchSpy.mockResolvedValue({ data: "test" });

  // 测试逻辑
  const result = await api.fetchData();
  expect(result).toBe("test");
  expect(fetchSpy).toHaveBeenCalled();

  // 不用手动写 restore 了！测试结束自动执行清理
})

test("其他测试完全不受影响", () => {
  // 这里的 api.fetch 已经是原始的方法了，没有任何 Mock 残留
  expect(api.fetch).not.toHaveBeenMocked();
})
```

---

## 五、常见避坑点
1. **不要用顶层 import 配合模块 Mock**：顶层 import 会在模块加载时执行，`resetModules` 无法重置它，必须用动态 `import()` 在测试用例内导入。
2. **`vi.mock` 默认会被提升**：如果你在测试用例内写 `vi.mock`，它默认会被提升到文件顶部，导致所有测试都用同一个 Mock。如果要每个测试不同的 Mock，用 `vi.doMock`（不会被提升），或者配合 `resetModules`。
3. **模块 Mock 不会被 restore 处理**：不要指望 `restoreAllMocks` 能清理模块 Mock，必须用重置缓存的方式。
4. **测试文件默认是隔离的**：Vitest 和 Bun test 默认都会把不同的测试文件跑在独立的环境里，所以污染只会发生在**同一个文件的不同测试用例之间**，不用跨文件担心。