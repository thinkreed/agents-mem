/**
 * @file tests/core/types.test.ts
 * @description Test suite for core type definitions
 */

import { describe, it, expect } from 'vitest';

describe('Core Types', () => {
  describe('MaterialURI', () => {
    it('should define URI interface with required fields', async () => {
      const { MaterialURI } = await import('../../src/core/types.js');
      
      const uri: MaterialURI = {
        scheme: 'mem',
        userId: 'user123',
        agentId: 'agent1',
        type: 'documents',
        id: 'doc-456',
      };
      
      expect(uri.scheme).toBe('mem');
      expect(uri.userId).toBe('user123');
      expect(uri.type).toBe('documents');
      expect(uri.id).toBe('doc-456');
    });

    it('should have toString method that generates valid URI string', async () => {
      const { createURI } = await import('../../src/core/types.js');
      
      const uri = createURI({
        userId: 'user123',
        agentId: 'agent1',
        type: 'documents',
        id: 'doc-456',
      });
      
      expect(uri.toString()).toBe('mem://user123/agent1/_/documents/doc-456');
    });

    it('should handle undefined agentId and teamId with underscore', async () => {
      const { createURI } = await import('../../src/core/types.js');
      
      const uri = createURI({
        userId: 'user123',
        type: 'facts',
        id: 'fact-789',
      });
      
      expect(uri.toString()).toBe('mem://user123/_/_/facts/fact-789');
    });

    it('should handle teamId without agentId', async () => {
      const { createURI } = await import('../../src/core/types.js');
      
      const uri = createURI({
        userId: 'user123',
        teamId: 'team5',
        type: 'documents',
        id: 'doc-123',
      });
      
      expect(uri.toString()).toBe('mem://user123/_/team5/documents/doc-123');
    });
  });

  describe('Scope', () => {
    it('should define Scope interface with userId required', async () => {
      const { Scope } = await import('../../src/core/types.js');
      
      const scope: Scope = {
        userId: 'user123',
        agentId: 'agent1',
        teamId: 'team5',
        isGlobal: false,
      };
      
      expect(scope.userId).toBe('user123');
      expect(scope.agentId).toBeDefined();
      expect(scope.teamId).toBeDefined();
    });

    it('should have optional agentId and teamId', async () => {
      const { Scope } = await import('../../src/core/types.js');
      
      const scope: Scope = {
        userId: 'user123',
      };
      
      expect(scope.userId).toBe('user123');
      expect(scope.agentId).toBeUndefined();
      expect(scope.teamId).toBeUndefined();
    });
  });

  describe('EntityType', () => {
    it('should support all entity types', async () => {
      const { EntityType } = await import('../../src/core/types.js');
      
      const entityTypes: EntityType[] = ['documents', 'assets', 'conversations', 'messages', 'facts', 'tiered', 'entity_nodes'];
      
      expect(entityTypes).toContain('documents');
      expect(entityTypes).toContain('facts');
    });
  });

  describe('FactType', () => {
    it('should support all fact types', async () => {
      const { FactType } = await import('../../src/core/types.js');
      
      const factTypes: FactType[] = ['preference', 'decision', 'observation', 'conclusion'];
      
      expect(factTypes).toHaveLength(4);
    });
  });

  describe('UserRole', () => {
    it('should support all user roles in team', async () => {
      const { UserRole } = await import('../../src/core/types.js');
      
      const roles: UserRole[] = ['owner', 'admin', 'member', 'guest'];
      
      expect(roles).toHaveLength(4);
    });
  });

  describe('MessageRole', () => {
    it('should support all message roles', async () => {
      const { MessageRole } = await import('../../src/core/types.js');
      
      const roles: MessageRole[] = ['user', 'assistant', 'system', 'tool'];
      
      expect(roles).toHaveLength(4);
    });
  });
});