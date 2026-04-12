/**
 * @file tests/core/scope.test.ts
 * @description Scope utilities tests (TDD)
 */

import { describe, it, expect } from 'vitest';
import {
  createScope,
  validateScope,
  scopeToString,
  parseScopeString,
  scopeEquals,
  scopeContains,
  isGlobalScope,
  isAgentScope,
  isTeamScope,
  mergeScopes,
  ScopeFilter
} from '../../src/core/scope';

describe('Scope Utilities', () => {
  describe('createScope', () => {
    it('should create scope with userId only', () => {
      const scope = createScope({ userId: 'user123' });
      
      expect(scope.userId).toBe('user123');
      expect(scope.agentId).toBeUndefined();
      expect(scope.teamId).toBeUndefined();
      expect(scope.isGlobal).toBe(false);
    });

    it('should create scope with userId and agentId', () => {
      const scope = createScope({
        userId: 'user123',
        agentId: 'agent1'
      });
      
      expect(scope.userId).toBe('user123');
      expect(scope.agentId).toBe('agent1');
      expect(scope.teamId).toBeUndefined();
    });

    it('should create scope with userId and teamId', () => {
      const scope = createScope({
        userId: 'user123',
        teamId: 'team5'
      });
      
      expect(scope.userId).toBe('user123');
      expect(scope.teamId).toBe('team5');
      expect(scope.agentId).toBeUndefined();
    });

    it('should create global scope', () => {
      const scope = createScope({
        userId: 'user123',
        isGlobal: true
      });
      
      expect(scope.isGlobal).toBe(true);
    });

    it('should create full scope', () => {
      const scope = createScope({
        userId: 'user123',
        agentId: 'agent1',
        teamId: 'team5',
        isGlobal: false
      });
      
      expect(scope.userId).toBe('user123');
      expect(scope.agentId).toBe('agent1');
      expect(scope.teamId).toBe('team5');
      expect(scope.isGlobal).toBe(false);
    });
  });

  describe('validateScope', () => {
    it('should return true for valid scope', () => {
      expect(validateScope({ userId: 'user123' })).toBe(true);
      expect(validateScope({ userId: 'user123', agentId: 'agent1' })).toBe(true);
    });

    it('should return false for scope without userId', () => {
      expect(validateScope({ agentId: 'agent1' })).toBe(false);
      expect(validateScope({ teamId: 'team5' })).toBe(false);
      expect(validateScope({})).toBe(false);
    });

    it('should return false for empty userId', () => {
      expect(validateScope({ userId: '' })).toBe(false);
    });
  });

  describe('scopeToString', () => {
    it('should convert scope to string', () => {
      const str = scopeToString({
        userId: 'user123',
        agentId: 'agent1'
      });
      
      expect(str).toContain('user123');
      expect(str).toContain('agent1');
    });

    it('should include global flag', () => {
      const str = scopeToString({
        userId: 'user123',
        isGlobal: true
      });
      
      expect(str).toContain('global');
    });

    it('should handle minimal scope', () => {
      const str = scopeToString({ userId: 'user123' });
      
      expect(str).toContain('user123');
    });
  });

  describe('parseScopeString', () => {
    it('should parse scope string back to object', () => {
      const scope = parseScopeString('user:user123/agent:agent1');
      
      expect(scope?.userId).toBe('user123');
      expect(scope?.agentId).toBe('agent1');
    });

    it('should return null for invalid string', () => {
      expect(parseScopeString('invalid')).toBeNull();
      expect(parseScopeString('')).toBeNull();
    });
  });

  describe('scopeEquals', () => {
    it('should return true for equal scopes', () => {
      const a = { userId: 'user123', agentId: 'agent1' };
      const b = { userId: 'user123', agentId: 'agent1' };
      
      expect(scopeEquals(a, b)).toBe(true);
    });

    it('should return false for different scopes', () => {
      const a = { userId: 'user123' };
      const b = { userId: 'user456' };
      
      expect(scopeEquals(a, b)).toBe(false);
    });

    it('should handle undefined fields', () => {
      const a = { userId: 'user123' };
      const b = { userId: 'user123', agentId: undefined };
      
      expect(scopeEquals(a, b)).toBe(true);
    });

    it('should compare isGlobal flag', () => {
      const a = { userId: 'user123', isGlobal: true };
      const b = { userId: 'user123', isGlobal: false };
      
      expect(scopeEquals(a, b)).toBe(false);
    });
  });

  describe('scopeContains', () => {
    it('should return true when scope contains target', () => {
      const scope = { userId: 'user123', agentId: 'agent1' };
      const target = { userId: 'user123' };
      
      expect(scopeContains(scope, target)).toBe(true);
    });

    it('should return false when scope does not contain target', () => {
      const scope = { userId: 'user123' };
      const target = { userId: 'user123', agentId: 'agent1' };
      
      expect(scopeContains(scope, target)).toBe(false);
    });

    it('should handle exact match', () => {
      const scope = { userId: 'user123', agentId: 'agent1' };
      const target = { userId: 'user123', agentId: 'agent1' };
      
      expect(scopeContains(scope, target)).toBe(true);
    });
  });

  describe('isGlobalScope', () => {
    it('should return true for global scope', () => {
      expect(isGlobalScope({ userId: 'user123', isGlobal: true })).toBe(true);
    });

    it('should return false for non-global scope', () => {
      expect(isGlobalScope({ userId: 'user123' })).toBe(false);
      expect(isGlobalScope({ userId: 'user123', isGlobal: false })).toBe(false);
    });

    it('should return false for undefined isGlobal', () => {
      expect(isGlobalScope({ userId: 'user123' })).toBe(false);
    });
  });

  describe('isAgentScope', () => {
    it('should return true for agent scope', () => {
      expect(isAgentScope({ userId: 'user123', agentId: 'agent1' })).toBe(true);
    });

    it('should return false for non-agent scope', () => {
      expect(isAgentScope({ userId: 'user123' })).toBe(false);
      expect(isAgentScope({ userId: 'user123', teamId: 'team5' })).toBe(false);
    });
  });

  describe('isTeamScope', () => {
    it('should return true for team scope', () => {
      expect(isTeamScope({ userId: 'user123', teamId: 'team5' })).toBe(true);
    });

    it('should return false for non-team scope', () => {
      expect(isTeamScope({ userId: 'user123' })).toBe(false);
      expect(isTeamScope({ userId: 'user123', agentId: 'agent1' })).toBe(false);
    });
  });

  describe('mergeScopes', () => {
    it('should merge scopes', () => {
      const a = { userId: 'user123' };
      const b = { agentId: 'agent1' };
      
      const merged = mergeScopes(a, b);
      
      expect(merged.userId).toBe('user123');
      expect(merged.agentId).toBe('agent1');
    });

    it('should override with second scope', () => {
      const a = { userId: 'user123', agentId: 'agent1' };
      const b = { agentId: 'agent2' };
      
      const merged = mergeScopes(a, b);
      
      expect(merged.userId).toBe('user123');
      expect(merged.agentId).toBe('agent2');
    });

    it('should handle global flag', () => {
      const a = { userId: 'user123', isGlobal: false };
      const b = { isGlobal: true };
      
      const merged = mergeScopes(a, b);
      
      expect(merged.isGlobal).toBe(true);
    });
  });

  describe('ScopeFilter', () => {
    it('should create filter from scope', () => {
      const filter = ScopeFilter.fromScope({
        userId: 'user123',
        agentId: 'agent1'
      });
      
      expect(filter.userId).toBe('user123');
      expect(filter.agentId).toBe('agent1');
    });

    it('should generate SQL where clause', () => {
      const filter = ScopeFilter.fromScope({
        userId: 'user123',
        agentId: 'agent1'
      });
      
      const where = filter.toWhereClause();
      
      expect(where).toContain('user_id');
      expect(where).toContain('user123');
    });

    it('should handle global scope in filter', () => {
      const filter = ScopeFilter.fromScope({
        userId: 'user123',
        isGlobal: true
      });
      
      const where = filter.toWhereClause();
      
      expect(where).toContain('is_global');
    });
  });
});