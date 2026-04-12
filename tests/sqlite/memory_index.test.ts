/**
 * @file tests/sqlite/memory_index.test.ts
 * @description Memory index table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMemoryIndex,
  getMemoryIndexByURI,
  getMemoryIndexesByScope,
  getMemoryIndexesByTarget,
  updateMemoryIndex,
  deleteMemoryIndex,
  searchMemoryIndex,
  MemoryIndexRecord
} from '../../src/sqlite/memory_index';
import { createUser } from '../../src/sqlite/users';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Memory Index Table', () => {
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

  describe('createMemoryIndex', () => {
    it('should create memory index', () => {
      const index = createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-1',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-1',
        title: 'Test Document'
      });
      
      expect(index).toBeDefined();
      expect(index.uri).toBe('mem://user-1/_/_/documents/doc-1');
      expect(index.target_type).toBe('documents');
    });

    it('should create index with metadata', () => {
      const index = createMemoryIndex({
        uri: 'mem://user-1/_/_/facts/fact-1',
        user_id: 'user-1',
        target_type: 'facts',
        target_id: 'fact-1',
        title: 'Test Fact',
        topic: 'project',
        entity: 'user-1',
        importance: 0.8
      });
      
      expect(index.topic).toBe('project');
      expect(index.entity).toBe('user-1');
      expect(index.importance).toBe(0.8);
    });
  });

  describe('getMemoryIndexByURI', () => {
    it('should get index by URI', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-2',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-2',
        title: 'Get Document'
      });
      
      const index = getMemoryIndexByURI('mem://user-1/_/_/documents/doc-2');
      
      expect(index).toBeDefined();
      expect(index?.title).toBe('Get Document');
    });
  });

  describe('getMemoryIndexesByScope', () => {
    it('should get indexes by user scope', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-3',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-3',
        title: 'Doc A'
      });
      
      const indexes = getMemoryIndexesByScope({ userId: 'user-1' });
      
      expect(indexes.length).toBe(1);
    });

    it('should get indexes by user with agent scope', () => {
      createMemoryIndex({
        uri: 'mem://user-1/agent-1/_/documents/doc-agent',
        user_id: 'user-1',
        agent_id: 'agent-1',
        target_type: 'documents',
        target_id: 'doc-agent',
        title: 'Agent Doc'
      });
      
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-no-agent',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-no-agent',
        title: 'No Agent Doc'
      });
      
      const indexes = getMemoryIndexesByScope({ userId: 'user-1', agentId: 'agent-1' });
      
      expect(indexes.length).toBe(1);
      expect(indexes[0].agent_id).toBe('agent-1');
    });

    it('should get indexes by user with team scope', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/team-1/documents/doc-team',
        user_id: 'user-1',
        team_id: 'team-1',
        target_type: 'documents',
        target_id: 'doc-team',
        title: 'Team Doc'
      });
      
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-no-team',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-no-team',
        title: 'No Team Doc'
      });
      
      const indexes = getMemoryIndexesByScope({ userId: 'user-1', teamId: 'team-1' });
      
      expect(indexes.length).toBe(1);
      expect(indexes[0].team_id).toBe('team-1');
    });
  });

  describe('getMemoryIndexesByTarget', () => {
    it('should get indexes by target', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-4',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-4',
        title: 'Target Doc'
      });
      
      const indexes = getMemoryIndexesByTarget('documents', 'doc-4');
      
      expect(indexes.length).toBe(1);
    });
  });

  describe('updateMemoryIndex', () => {
    it('should update index', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-5',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-5',
        title: 'Original'
      });
      
      const updated = updateMemoryIndex('mem://user-1/_/_/documents/doc-5', {
        title: 'Updated',
        importance: 0.9
      });
      
      expect(updated?.title).toBe('Updated');
      expect(updated?.importance).toBe(0.9);
    });
  });

  describe('deleteMemoryIndex', () => {
    it('should delete index', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-6',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-6',
        title: 'Delete Doc'
      });
      
      const result = deleteMemoryIndex('mem://user-1/_/_/documents/doc-6');
      
      expect(result).toBe(true);
    });
  });

  describe('searchMemoryIndex', () => {
    it('should search by topic', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-7',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-7',
        title: 'Topic Doc',
        topic: 'project-x'
      });
      
      const results = searchMemoryIndex({ topic: 'project-x' });
      
      expect(results.length).toBe(1);
    });

    it('should search by entity', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/_/facts/fact-1',
        user_id: 'user-1',
        target_type: 'facts',
        target_id: 'fact-1',
        title: 'Entity Fact',
        entity: 'person-A'
      });
      
      const results = searchMemoryIndex({ entity: 'person-A' });
      
      expect(results.length).toBe(1);
    });

    it('should search by category', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-cat',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-cat',
        title: 'Category Doc',
        category: 'technical'
      });
      
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-other',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-other',
        title: 'Other Doc',
        category: 'general'
      });
      
      const results = searchMemoryIndex({ category: 'technical' });
      
      expect(results.length).toBe(1);
      expect(results[0].category).toBe('technical');
    });

    it('should search by importance_min', () => {
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-high',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-high',
        title: 'High Importance',
        importance: 0.9
      });
      
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-low',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-low',
        title: 'Low Importance',
        importance: 0.3
      });
      
      const results = searchMemoryIndex({ importance_min: 0.5 });
      
      expect(results.length).toBe(1);
      expect(results[0].importance).toBeGreaterThanOrEqual(0.5);
    });
  });
});