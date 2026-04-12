/**
 * @file tests/sqlite/entity_nodes.test.ts
 * @description Entity nodes table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createEntityNode,
  getEntityNodeById,
  getEntityNodesByParent,
  getEntityNodesByScope,
  updateEntityNode,
  deleteEntityNode,
  getRootNodes,
  EntityNodeRecord
} from '../../src/sqlite/entity_nodes';
import { createUser } from '../../src/sqlite/users';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Entity Nodes Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('createEntityNode', () => {
    it('should create root entity node', () => {
      const node = createEntityNode({
        id: 'node-1',
        user_id: 'user-1',
        entity_name: 'Project X',
        depth: 0
      });
      
      expect(node).toBeDefined();
      expect(node.id).toBe('node-1');
      expect(node.entity_name).toBe('Project X');
      expect(node.depth).toBe(0);
      expect(node.parent_id).toBeUndefined();
    });

    it('should create child node', () => {
      createEntityNode({
        id: 'node-2',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });
      
      const child = createEntityNode({
        id: 'node-3',
        user_id: 'user-1',
        parent_id: 'node-2',
        entity_name: 'Child',
        depth: 1
      });
      
      expect(child.parent_id).toBe('node-2');
      expect(child.depth).toBe(1);
    });

    it('should set threshold', () => {
      const node = createEntityNode({
        id: 'node-4',
        user_id: 'user-1',
        entity_name: 'Threshold',
        depth: 0,
        threshold: 0.7
      });
      
      expect(node.threshold).toBe(0.7);
    });
  });

  describe('getEntityNodeById', () => {
    it('should get node by id', () => {
      createEntityNode({
        id: 'node-5',
        user_id: 'user-1',
        entity_name: 'Get Node',
        depth: 0
      });
      
      const node = getEntityNodeById('node-5');
      
      expect(node).toBeDefined();
      expect(node?.entity_name).toBe('Get Node');
    });
  });

  describe('getEntityNodesByParent', () => {
    it('should get children of parent', () => {
      createEntityNode({
        id: 'node-6',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });
      createEntityNode({
        id: 'node-7',
        user_id: 'user-1',
        parent_id: 'node-6',
        entity_name: 'Child 1',
        depth: 1
      });
      createEntityNode({
        id: 'node-8',
        user_id: 'user-1',
        parent_id: 'node-6',
        entity_name: 'Child 2',
        depth: 1
      });
      
      const children = getEntityNodesByParent('node-6');
      
      expect(children.length).toBe(2);
    });
  });

  describe('getEntityNodesByScope', () => {
    it('should get nodes by user', () => {
      createEntityNode({
        id: 'node-9',
        user_id: 'user-1',
        entity_name: 'Scope Node',
        depth: 0
      });
      
      const nodes = getEntityNodesByScope({ userId: 'user-1' });
      
      expect(nodes.length).toBe(1);
    });

    it('should get nodes by user with agent scope', () => {
      createEntityNode({
        id: 'node-agent',
        user_id: 'user-1',
        agent_id: 'agent-1',
        entity_name: 'Agent Node',
        depth: 0
      });
      
      createEntityNode({
        id: 'node-no-agent',
        user_id: 'user-1',
        entity_name: 'No Agent Node',
        depth: 0
      });
      
      const nodes = getEntityNodesByScope({ userId: 'user-1', agentId: 'agent-1' });
      
      expect(nodes.length).toBe(1);
      expect(nodes[0].agent_id).toBe('agent-1');
    });

    it('should get nodes by user with team scope', () => {
      createEntityNode({
        id: 'node-team',
        user_id: 'user-1',
        team_id: 'team-1',
        entity_name: 'Team Node',
        depth: 0
      });
      
      createEntityNode({
        id: 'node-no-team',
        user_id: 'user-1',
        entity_name: 'No Team Node',
        depth: 0
      });
      
      const nodes = getEntityNodesByScope({ userId: 'user-1', teamId: 'team-1' });
      
      expect(nodes.length).toBe(1);
      expect(nodes[0].team_id).toBe('team-1');
    });
  });

  describe('getRootNodes', () => {
    it('should get root nodes (depth 0)', () => {
      createEntityNode({
        id: 'node-10',
        user_id: 'user-1',
        entity_name: 'Root',
        depth: 0
      });
      createEntityNode({
        id: 'node-11',
        user_id: 'user-1',
        parent_id: 'node-10',
        entity_name: 'Child',
        depth: 1
      });
      
      const roots = getRootNodes('user-1');
      
      expect(roots.length).toBe(1);
      expect(roots[0].depth).toBe(0);
    });
  });

  describe('updateEntityNode', () => {
    it('should update node', () => {
      createEntityNode({
        id: 'node-12',
        user_id: 'user-1',
        entity_name: 'Original',
        depth: 0
      });
      
      const updated = updateEntityNode('node-12', {
        aggregated_content: 'Aggregated',
        child_count: 3
      });
      
      expect(updated?.aggregated_content).toBe('Aggregated');
      expect(updated?.child_count).toBe(3);
    });
  });

  describe('deleteEntityNode', () => {
    it('should delete node', () => {
      createEntityNode({
        id: 'node-13',
        user_id: 'user-1',
        entity_name: 'Delete',
        depth: 0
      });
      
      const result = deleteEntityNode('node-13');
      
      expect(result).toBe(true);
    });
  });
});