/**
 * @file tests/entity_tree/search.test.ts
 * @description Entity tree search tests
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
import { createEntityNode, getEntityNodeById, getRootNodes, getEntityNodesByParent } from '../../src/sqlite/entity_nodes';
import { searchEntityTree, foldTree, getTreePath } from '../../src/entity_tree/search';

describe('Entity Tree Search', () => {
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

  describe('searchEntityTree', () => {
    it('should return root nodes for user', async () => {
      createEntityNode({
        id: 'node-1',
        user_id: 'user-1',
        entity_name: 'Entity A',
        depth: 0
      });

      const result = await searchEntityTree({ userId: 'user-1' });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by entityName', async () => {
      createEntityNode({
        id: 'node-1',
        user_id: 'user-1',
        entity_name: 'Project Alpha',
        depth: 0
      });
      createEntityNode({
        id: 'node-2',
        user_id: 'user-1',
        entity_name: 'Task Beta',
        depth: 0
      });

      const result = await searchEntityTree({ userId: 'user-1', entityName: 'Project' });

      expect(result.length).toBe(1);
      expect(result[0]?.entity_name).toBe('Project Alpha');
    });

    it('should return empty array when no nodes exist', async () => {
      const result = await searchEntityTree({ userId: 'user-1' });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('foldTree', () => {
    it('should return nodeId when node not found', async () => {
      const result = await foldTree('nonexistent-node', 0.9);

      expect(result).toBe('nonexistent-node');
    });

    it('should return nodeId when node has no parent', async () => {
      createEntityNode({
        id: 'root-1',
        user_id: 'user-1',
        entity_name: 'Root',
        depth: 0
      });

      const result = await foldTree('root-1', 0.9);

      expect(result).toBe('root-1');
    });
  });

  describe('getTreePath', () => {
    it('should return path for root node', async () => {
      createEntityNode({
        id: 'root-1',
        user_id: 'user-1',
        entity_name: 'Root',
        depth: 0
      });

      const result = await getTreePath('root-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toBe('Root');
    });

    it('should return empty array when node not found', async () => {
      const result = await getTreePath('nonexistent-node');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should build path from child to root', async () => {
      createEntityNode({
        id: 'root-1',
        user_id: 'user-1',
        entity_name: 'Root',
        depth: 0
      });
      createEntityNode({
        id: 'child-1',
        user_id: 'user-1',
        parent_id: 'root-1',
        entity_name: 'Child',
        depth: 1
      });

      const result = await getTreePath('child-1');

      expect(result.length).toBe(2);
      expect(result[0]).toBe('Root');
      expect(result[1]).toBe('Child');
    });
  });
});