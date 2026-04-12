/**
 * @file tests/tools/registry.test.ts
 */

import { describe, it, expect } from 'vitest';
import { getToolRegistry, ToolRegistry } from '../../src/tools/registry';

describe('Tool Registry', () => {
  it('should create registry', () => {
    const registry = getToolRegistry();
    expect(registry).toBeDefined();
  });

  it('should list tools', () => {
    const registry = getToolRegistry();
    const tools = registry.list();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should get tool names', () => {
    const registry = getToolRegistry();
    const names = registry.names();
    expect(names).toContain('scope_set');
  });
});