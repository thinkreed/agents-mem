/**
 * @file tests/materials/uri_resolver.test.ts
 */

import { describe, it, expect } from 'vitest';
import { resolveURI, buildMaterialURI, extractScopeFromURI } from '../../src/materials/uri_resolver';

describe('URI Resolver', () => {
  it('should resolve URI', () => {
    const result = resolveURI('mem://user1/_/_/documents/doc1');
    expect(result?.userId).toBe('user1');
  });

  it('should build material URI', () => {
    const uri = buildMaterialURI({
      userId: 'user1',
      type: 'documents',
      id: 'doc1'
    });
    expect(uri).toContain('user1');
    expect(uri).toContain('documents');
  });

  it('should extract scope from URI', () => {
    const scope = extractScopeFromURI('mem://user1/agent1/_/facts/fact1');
    expect(scope?.userId).toBe('user1');
    expect(scope?.agentId).toBe('agent1');
  });
});