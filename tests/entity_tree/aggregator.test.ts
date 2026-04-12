/**
 * @file tests/entity_tree/aggregator.test.ts
 * @description Entity node content aggregator tests
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
import { createEntityNode } from '../../src/sqlite/entity_nodes';
import { aggregateChildContent, updateParentAggregation } from '../../src/entity_tree/aggregator';

describe('Entity Tree Aggregator', () => {
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

  describe('aggregateChildContent', () => {
    it('should return empty string when no children', async () => {
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });

      const result = await aggregateChildContent('parent-1');

      expect(result).toBe('');
    });

    it('should aggregate child content', async () => {
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0,
        aggregated_content: 'Parent content'
      });
      createEntityNode({
        id: 'child-1',
        user_id: 'user-1',
        entity_name: 'Child 1',
        depth: 1,
        parent_id: 'parent-1',
        aggregated_content: 'Child 1 content'
      });
      createEntityNode({
        id: 'child-2',
        user_id: 'user-1',
        entity_name: 'Child 2',
        depth: 1,
        parent_id: 'parent-1',
        aggregated_content: 'Child 2 content'
      });

      const result = await aggregateChildContent('parent-1');

      expect(result).toBeDefined();
      expect(result).toContain('Child 1 content');
      expect(result).toContain('Child 2 content');
    });

    it('should handle children without aggregated_content', async () => {
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });
      createEntityNode({
        id: 'child-1',
        user_id: 'user-1',
        entity_name: 'Child',
        depth: 1,
        parent_id: 'parent-1'
      });

      const result = await aggregateChildContent('parent-1');

      expect(result).toBe('');
    });
  });

  describe('updateParentAggregation', () => {
    it('should update parent node', async () => {
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });
      createEntityNode({
        id: 'child-1',
        user_id: 'user-1',
        entity_name: 'Child',
        depth: 1,
        parent_id: 'parent-1',
        aggregated_content: 'Child content'
      });

      await updateParentAggregation('parent-1');

      // Function should run without error
    });
  });
});