/**
 * @file tests/openviking/scope_mapper.test.ts
 * @description Tests for scope mapping between agents-mem and OpenViking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScopeMapper, getScopeMapper, resetScopeMapper } from '../../src/openviking/scope_mapper';
import type { Scope } from '../../src/core/types';

describe('ScopeMapper', () => {
  let mapper: ScopeMapper;

  beforeEach(() => {
    resetScopeMapper();
    mapper = getScopeMapper();
  });

  describe('mapToVikingScope', () => {
    it('should map basic scope', () => {
      const scope: Scope = { userId: 'user123' };
      const vikingScope = mapper.mapToVikingScope(scope);
      
      expect(vikingScope.account).toBe('default');
      expect(vikingScope.user).toBe('user123');
      expect(vikingScope.agent).toBeUndefined();
    });

    it('should map scope with agent', () => {
      const scope: Scope = { userId: 'user123', agentId: 'agent456' };
      const vikingScope = mapper.mapToVikingScope(scope);
      
      expect(vikingScope.user).toBe('user123');
      expect(vikingScope.agent).toBe('agent456');
    });
  });

  describe('mapToVikingTarget', () => {
    it('should build target URI for user', () => {
      const scope: Scope = { userId: 'user123' };
      const targetUri = mapper.mapToVikingTarget(scope);
      
      expect(targetUri).toContain('viking://');
      expect(targetUri).toContain('user123');
      expect(targetUri).toContain('memories');
    });

    it('should build target URI with agent', () => {
      const scope: Scope = { userId: 'user123', agentId: 'agent456' };
      const targetUri = mapper.mapToVikingTarget(scope);
      
      expect(targetUri).toContain('agent456');
    });
  });

  describe('buildTargetForType', () => {
    it('should build resources target', () => {
      const scope: Scope = { userId: 'user123' };
      const targetUri = mapper.buildTargetForType(scope, 'resources');
      
      expect(targetUri).toContain('resources');
    });

    it('should build memories target', () => {
      const scope: Scope = { userId: 'user123' };
      const targetUri = mapper.buildTargetForType(scope, 'memories');
      
      expect(targetUri).toContain('memories');
    });

    it('should build skills target', () => {
      const scope: Scope = { userId: 'user123' };
      const targetUri = mapper.buildTargetForType(scope, 'skills');
      
      expect(targetUri).toContain('skills');
    });
  });

  describe('mapToOpenVikingHeaders', () => {
    it('should build headers with scope', () => {
      const scope: Scope = { userId: 'user123', agentId: 'agent456' };
      const headers = mapper.mapToOpenVikingHeaders(scope);
      
      expect(headers['X-User']).toBe('user123');
      expect(headers['X-Agent']).toBe('agent456');
    });

    it('should include team in headers', () => {
      const scope: Scope = { userId: 'user123', teamId: 'team789' };
      const headers = mapper.mapToOpenVikingHeaders(scope);
      
      expect(headers['X-Team']).toBe('team789');
    });
  });

  describe('extractScopeFromUri', () => {
    it('should extract scope from viking URI', () => {
      const vikingUri = 'viking://account/user123/resources/documents';
      const scope = mapper.extractScopeFromUri(vikingUri);
      
      expect(scope.userId).toBe('user123');
    });

    it('should extract agent from URI', () => {
      const vikingUri = 'viking://account/user123/agent456/memories/facts';
      const scope = mapper.extractScopeFromUri(vikingUri);
      
      expect(scope.userId).toBe('user123');
      expect(scope.agentId).toBe('agent456');
    });
  });

  describe('validateScope', () => {
    it('should validate valid scope', () => {
      const scope: Scope = { userId: 'user123' };
      const result = mapper.validateScope(scope);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail on missing userId', () => {
      const scope: Scope = { userId: '' };
      const result = mapper.validateScope(scope);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail on invalid userId format', () => {
      const scope: Scope = { userId: 'user@special!' };
      const result = mapper.validateScope(scope);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('userId must contain only alphanumeric characters, underscores, and hyphens');
    });
  });
});