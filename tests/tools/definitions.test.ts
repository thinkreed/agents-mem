/**
 * @file tests/tools/definitions.test.ts
 */

import { describe, it, expect } from 'vitest';
import { getToolDefinitions, TOOL_DEFINITIONS } from '../../src/tools/definitions';

describe('Tool Definitions', () => {
  it('should have tool definitions', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('should have scope_set tool', () => {
    const scopeSet = TOOL_DEFINITIONS.find(t => t.name === 'scope_set');
    expect(scopeSet).toBeDefined();
  });

  it('should have document_save tool', () => {
    const docSave = TOOL_DEFINITIONS.find(t => t.name === 'document_save');
    expect(docSave).toBeDefined();
  });

  it('should get tool definitions', () => {
    const defs = getToolDefinitions();
    expect(defs.length).toBeGreaterThan(0);
  });
});