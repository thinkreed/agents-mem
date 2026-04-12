/**
 * @file tests/setup.ts
 * @description Global test setup for mock pollution prevention
 * @see E:\projects\mock污染处理.md for cleanup strategy
 */

import { beforeEach, afterEach, vi } from 'vitest';

// Clear mock call history before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Restore all spies to original implementations after each test
afterEach(() => {
  vi.restoreAllMocks();
});