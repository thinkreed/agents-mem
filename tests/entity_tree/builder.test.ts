/**
 * @file tests/entity_tree/builder.test.ts
 * @description Entity tree builder tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getConnection,
  closeConnection,
  resetConnection,
  setDatabasePath
} from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { createUser } from '../../src/sqlite/users';
import { createFact } from '../../src/sqlite/facts';
import { createEntityNode, getEntityNodeById, getRootNodes } from '../../src/sqlite/entity_nodes';
import { EntityTreeBuilder, getEntityTreeBuilder } from '../../src/entity_tree/builder';

describe('EntityTreeBuilder', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'Test User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('EntityTreeBuilder class', () => {
    it('should instantiate', () => {
      const builder = new EntityTreeBuilder();
      expect(builder).toBeDefined();
    });

    it('should have buildTree method', () => {
      const builder = new EntityTreeBuilder();
      expect(typeof builder.buildTree).toBe('function');
    });

    it('should have addChild method', () => {
      const builder = new EntityTreeBuilder();
      expect(typeof builder.addChild).toBe('function');
    });
  });

  describe('buildTree', () => {
    it('should build tree from entities', async () => {
      const builder = new EntityTreeBuilder();
      
      createFact({
        id: 'fact-1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test fact',
        fact_type: 'observation',
        entities: '["Entity1"]',
        confidence: 0.8
      });
      
      const entities = [
        { name: 'Entity1', facts: ['fact-1'] }
      ];
      
      const result = await builder.buildTree('user-1', entities);
      expect(result).toBe('built');
    });

    it('should handle empty entities array', async () => {
      const builder = new EntityTreeBuilder();
      
      const result = await builder.buildTree('user-1', []);
      expect(result).toBe('built');
    });

    it('should create root nodes for each entity', async () => {
      const builder = new EntityTreeBuilder();
      
      createFact({
        id: 'fact-1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test fact',
        fact_type: 'observation',
        entities: '[]',
        confidence: 0.8
      });
      createFact({
        id: 'fact-2',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2',
        content: 'Test fact 2',
        fact_type: 'observation',
        entities: '[]',
        confidence: 0.8
      });
      
      const entities = [
        { name: 'Entity A', facts: ['fact-1'] },
        { name: 'Entity B', facts: ['fact-2'] }
      ];
      
      await builder.buildTree('user-1', entities);
      
      const roots = getRootNodes('user-1');
      expect(roots.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('addChild', () => {
    it('should throw error when parent not found', async () => {
      const builder = new EntityTreeBuilder();
      
      await expect(builder.addChild('nonexistent-parent', 'ChildEntity', []))
        .rejects.toThrow('Parent not found');
    });

    it('should create child node when parent exists', async () => {
      const builder = new EntityTreeBuilder();
      
      // Create parent first
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });
      
      const childId = await builder.addChild('parent-1', 'Child', ['fact-1']);
      
      expect(childId).toBeDefined();
      
      const child = getEntityNodeById(childId);
      expect(child).toBeDefined();
      expect(child?.parent_id).toBe('parent-1');
      expect(child?.depth).toBe(1);
    });
  });

  describe('getEntityTreeBuilder singleton', () => {
    it('should return EntityTreeBuilder instance', () => {
      const instance = getEntityTreeBuilder();
      expect(instance).toBeInstanceOf(EntityTreeBuilder);
    });

    it('should return same instance on multiple calls', () => {
      const instance1 = getEntityTreeBuilder();
      const instance2 = getEntityTreeBuilder();
      expect(instance1).toBe(instance2);
    });
  });
});