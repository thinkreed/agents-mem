/**
 * @file tests/setup.ts
 * @description Global test setup for mock pollution prevention
 * @see E:\projects\mock污染处理.md for cleanup strategy
 */

import { beforeEach, afterEach, vi } from 'vitest';

// Reset module cache before each test (prevents vi.mock hoisting pollution)
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// Restore all spies to original implementations after each test
afterEach(() => {
  vi.restoreAllMocks();
});