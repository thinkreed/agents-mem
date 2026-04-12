/**
 * @file tests/materials/uri_resolver.test.ts
 */

import { describe, it, expect } from 'vitest';
import { resolveURI, buildMaterialURI, extractScopeFromURI, uriMatchesScope } from '../../src/materials/uri_resolver';

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

  describe('uriMatchesScope', () => {
    it('should return true when URI matches scope exactly', () => {
      const result = uriMatchesScope('mem://user1/agent1/team1/documents/doc1', {
        userId: 'user1',
        agentId: 'agent1',
        teamId: 'team1'
      });
      expect(result).toBe(true);
    });

    it('should return true when URI has agent but scope does not require it', () => {
      const result = uriMatchesScope('mem://user1/agent1/_/documents/doc1', {
        userId: 'user1'
      });
      expect(result).toBe(true);
    });

    it('should return true when URI has team but scope does not require it', () => {
      const result = uriMatchesScope('mem://user1/_/team1/documents/doc1', {
        userId: 'user1'
      });
      expect(result).toBe(true);
    });

    it('should return false when user does not match', () => {
      const result = uriMatchesScope('mem://user2/_/_/documents/doc1', {
        userId: 'user1'
      });
      expect(result).toBe(false);
    });

    it('should return false when agent does not match', () => {
      const result = uriMatchesScope('mem://user1/agent2/_/documents/doc1', {
        userId: 'user1',
        agentId: 'agent1'
      });
      expect(result).toBe(false);
    });

    it('should return false when team does not match', () => {
      const result = uriMatchesScope('mem://user1/_/team2/documents/doc1', {
        userId: 'user1',
        teamId: 'team1'
      });
      expect(result).toBe(false);
    });

    it('should return false for invalid URI', () => {
      const result = uriMatchesScope('invalid-uri', {
        userId: 'user1'
      });
      expect(result).toBe(false);
    });

    it('should return true when URI has placeholder and scope does not require it', () => {
      const result = uriMatchesScope('mem://user1/_/_/documents/doc1', {
        userId: 'user1'
      });
      expect(result).toBe(true);
    });

    it('should return false when scope requires agent but URI has placeholder', () => {
      const result = uriMatchesScope('mem://user1/_/team1/documents/doc1', {
        userId: 'user1',
        agentId: 'agent1'
      });
      expect(result).toBe(false);
    });

    it('should return false when scope requires team but URI has placeholder', () => {
      const result = uriMatchesScope('mem://user1/agent1/_/documents/doc1', {
        userId: 'user1',
        teamId: 'team1'
      });
      expect(result).toBe(false);
    });
  });
});