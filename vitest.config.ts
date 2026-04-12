/**
 * @file vitest.config.ts
 * @description Vitest configuration with mock pollution prevention
 * @see E:\projects\mock污染处理.md for cleanup strategy
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/mcp_server.ts']
    }
  }
});