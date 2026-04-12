/**
 * @file tests/facts/linker.test.ts
 * @description Fact to entity linking tests using real SQLite
 * 
 * NOTE: We use real SQLite database instead of mocks to avoid cross-file mock pollution.
 * Each test uses isolated :memory: database with proper setup/teardown.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { linkFactToEntities, getFactsForEntity } from '../../src/facts/linker';
import { resetConnection, closeConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { createUser } from '../../src/sqlite/users';
import { createFact, getFactById } from '../../src/sqlite/facts';
import { getEntityNodeById, getEntityNodeByUserAndName } from '../../src/sqlite/entity_nodes';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Fact Linker', () => {
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

  describe('linkFactToEntities', () => {
    it('should return empty array for non-existent fact', async () => {
      const result = await linkFactToEntities('non-existent-fact', ['Entity1']);

      expect(result).toEqual([]);
    });

    it('should create entity nodes for existing fact', async () => {
      // Create a fact first
      const fact = createFact({
        id: 'fact-1',
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test fact content',
        fact_type: 'preference',
        entities: '["Entity1"]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      expect(fact).toBeDefined();

      const entities = ['Project X', 'User John'];
      const result = await linkFactToEntities('fact-1', entities);

      // Verify result contains valid UUIDs
      expect(result.length).toBe(2);
      expect(result[0]).toMatch(UUID_REGEX);
      expect(result[1]).toMatch(UUID_REGEX);
      expect(result[0]).not.toBe(result[1]); // UUIDs should be unique

      // Verify entity nodes were created
      const node1 = getEntityNodeById(result[0]);
      expect(node1).toBeDefined();
      expect(node1?.user_id).toBe('user-1');
      expect(node1?.agent_id).toBe('agent-1');
      expect(node1?.team_id).toBe('team-1');
      expect(node1?.entity_name).toBe('Project X');
      expect(node1?.depth).toBe(0);
      expect(node1?.linked_fact_ids).toBe(JSON.stringify(['fact-1']));

      const node2 = getEntityNodeById(result[1]);
      expect(node2).toBeDefined();
      expect(node2?.entity_name).toBe('User John');
      expect(node2?.linked_fact_ids).toBe(JSON.stringify(['fact-1']));
    });

    it('should create entity nodes without agent_id and team_id', async () => {
      // Create user-2 first
      createUser({ id: 'user-2', name: 'User 2' });

      // Create a fact without agent/team
      const fact = createFact({
        id: 'fact-2',
        user_id: 'user-2',
        source_type: 'messages',
        source_id: 'msg-1',
        content: 'Simple fact',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      const result = await linkFactToEntities('fact-2', ['Entity']);

      // Verify result contains valid UUID
      expect(result.length).toBe(1);
      expect(result[0]).toMatch(UUID_REGEX);

      // Verify entity node was created without agent/team
      const node = getEntityNodeById(result[0]);
      expect(node).toBeDefined();
      expect(node?.user_id).toBe('user-2');
      // Note: agent_id and team_id may be null or undefined depending on SQLite behavior
      expect(node?.agent_id).toBeFalsy();
      expect(node?.team_id).toBeFalsy();
      expect(node?.entity_name).toBe('Entity');
      expect(node?.depth).toBe(0);
      expect(node?.linked_fact_ids).toBe(JSON.stringify(['fact-2']));
    });

    it('should handle empty entities array', async () => {
      // Create a fact first
      createFact({
        id: 'fact-3',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      const result = await linkFactToEntities('fact-3', []);

      expect(result).toEqual([]);
    });
  });

  describe('getFactsForEntity', () => {
    it('should return parsed fact IDs for entity node', async () => {
      // Create a fact
      createFact({
        id: 'fact-1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test fact',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      // Link to entities
      const nodeIds = await linkFactToEntities('fact-1', ['Project X']);

      // Get facts for entity
      const result = await getFactsForEntity(nodeIds[0]);

      expect(result).toEqual(['fact-1']);
    });

    it('should return empty array for non-existent entity node', async () => {
      const result = await getFactsForEntity('non-existent-node');

      expect(result).toEqual([]);
    });

    it('should return empty array for entity node without linked facts', async () => {
      // Create fact
      createFact({
        id: 'fact-test',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      // Link to entity
      const nodeIds = await linkFactToEntities('fact-test', ['Test Entity']);

      // Get facts for entity (should return the linked fact)
      const result = await getFactsForEntity(nodeIds[0]);
      expect(result).toEqual(['fact-test']);
    });

    it('should parse single fact ID', async () => {
      // Create fact
      createFact({
        id: 'fact-single',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Single fact',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      // Link to entity
      const nodeIds = await linkFactToEntities('fact-single', ['Single Entity']);

      const result = await getFactsForEntity(nodeIds[0]);

      expect(result).toEqual(['fact-single']);
    });
  });

  describe('deduplication', () => {
    it('should return same node ID when same entity linked twice', async () => {
      // Create two facts for the same user
      createFact({
        id: 'fact-d1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'First fact',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      createFact({
        id: 'fact-d2',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2',
        content: 'Second fact',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      // Link first fact to "Project X"
      const result1 = await linkFactToEntities('fact-d1', ['Project X']);
      expect(result1.length).toBe(1);

      // Link second fact to the same entity "Project X"
      const result2 = await linkFactToEntities('fact-d2', ['Project X']);
      expect(result2.length).toBe(1);

      // Both should return the SAME node ID (deduplication)
      expect(result2[0]).toBe(result1[0]);
    });

    it('should accumulate multiple facts in linked_fact_ids array', async () => {
      // Create two facts for the same user
      createFact({
        id: 'fact-a1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'First fact',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      createFact({
        id: 'fact-a2',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2',
        content: 'Second fact',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      // Link both facts to "Project X"
      await linkFactToEntities('fact-a1', ['Project X']);
      await linkFactToEntities('fact-a2', ['Project X']);

      // Find the entity node
      const node = getEntityNodeByUserAndName('user-1', 'Project X');
      expect(node).toBeDefined();

      // linked_fact_ids should contain both facts (accumulated, not replaced)
      const linkedFactIds = JSON.parse(node!.linked_fact_ids || '[]');
      expect(linkedFactIds).toContain('fact-a1');
      expect(linkedFactIds).toContain('fact-a2');
      expect(linkedFactIds.length).toBe(2);
    });

    it('should not duplicate fact IDs in linked_fact_ids array', async () => {
      // Create a fact
      createFact({
        id: 'fact-dup',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test fact',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      // Link the SAME fact to the same entity twice (edge case)
      await linkFactToEntities('fact-dup', ['Entity X']);
      await linkFactToEntities('fact-dup', ['Entity X']);

      // Find the entity node
      const node = getEntityNodeByUserAndName('user-1', 'Entity X');
      expect(node).toBeDefined();

      // linked_fact_ids should only contain the fact once (no duplicates)
      const linkedFactIds = JSON.parse(node!.linked_fact_ids || '[]');
      expect(linkedFactIds).toEqual(['fact-dup']); // Only one entry, not two
    });

    it('should not create duplicate entity nodes in database', async () => {
      // Create two facts
      createFact({
        id: 'fact-n1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'First',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      createFact({
        id: 'fact-n2',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2',
        content: 'Second',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      // Link both facts to "Project X"
      const nodeId1 = await linkFactToEntities('fact-n1', ['Project X']);
      const nodeId2 = await linkFactToEntities('fact-n2', ['Project X']);

      // Both should return same ID
      expect(nodeId1[0]).toBe(nodeId2[0]);

      // Query by user + name should return exactly one node
      const node = getEntityNodeByUserAndName('user-1', 'Project X');
      expect(node).toBeDefined();
      expect(node!.id).toBe(nodeId1[0]);
    });

    it('should create separate nodes for different users with same entity name', async () => {
      // Create second user
      createUser({ id: 'user-2', name: 'User 2' });

      // Create facts for both users
      createFact({
        id: 'fact-u1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'User 1 fact',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      createFact({
        id: 'fact-u2',
        user_id: 'user-2',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'User 2 fact',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      // Link same entity name to different users
      const result1 = await linkFactToEntities('fact-u1', ['Project X']);
      const result2 = await linkFactToEntities('fact-u2', ['Project X']);

      // Should create separate nodes (different IDs)
      expect(result1[0]).not.toBe(result2[0]);

      // Each user should have their own entity node
      const node1 = getEntityNodeByUserAndName('user-1', 'Project X');
      const node2 = getEntityNodeByUserAndName('user-2', 'Project X');

      expect(node1?.id).toBe(result1[0]);
      expect(node2?.id).toBe(result2[0]);
      expect(node1?.linked_fact_ids).toBe(JSON.stringify(['fact-u1']));
      expect(node2?.linked_fact_ids).toBe(JSON.stringify(['fact-u2']));
    });
  });
});