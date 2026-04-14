/**
 * @file tests/setup.ts
 * @description Global test setup for bun:test
 *
 * bun:test automatically re-imports modules for each test file,
 * so vi.resetModules() is not needed.
 */

// @ts-nocheck
import { beforeEach, afterEach, vi, describe as describeBun } from 'bun:test';

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Restore all spies after each test
afterEach(() => {
  vi.restoreAllMocks();
});
