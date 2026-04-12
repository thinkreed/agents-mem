/**
 * @file tests/lance/semantic_search_fixes.test.ts
 * @description Tests for semantic search scope filtering bug (TDD - tests should FAIL initially)
 * 
 * Bug: Each .where() call overwrites previous filter - only last filter (team_id) applied
 * Expected: Use ScopeFilter class to combine filters into single .where() call
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { semanticSearchDocuments } from '../../src/lance/semantic_search';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';

describe('Semantic Search Scope Filtering Bug', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-scope-filter-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('documents_vec', createDocumentsVecSchema());
  });

  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('Scope filtering with userId only', () => {
    it('should filter by userId and return ONLY user-1 documents', async () => {
      // Create documents for user-1
      const vector1 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-user1-1',
        content: 'User 1 Python document',
        vector: vector1,
        user_id: 'user-1',
        title: 'User1 Python'
      });

      // Create documents for user-2
      const vector2 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-user2-1',
        content: 'User 2 Python document',
        vector: vector2,
        user_id: 'user-2',
        title: 'User2 Python'
      });

      // Search with user-1 scope
      const queryVector = new Float32Array(768).fill(0.1);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-1' }
      });

      // Should ONLY return user-1 documents (BUG: currently returns all documents)
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-user1-1');
    });
  });

  describe('Scope filtering with userId + agentId', () => {
    it('should apply BOTH userId AND agentId filters', async () => {
      // Create doc for user-1, agent-1
      const vector1 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-user1-agent1',
        content: 'User 1 Agent 1 document',
        vector: vector1,
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'U1A1 Doc'
      });

      // Create doc for user-1, agent-2
      const vector2 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-user1-agent2',
        content: 'User 1 Agent 2 document',
        vector: vector2,
        user_id: 'user-1',
        agent_id: 'agent-2',
        title: 'U1A2 Doc'
      });

      // Create doc for user-2, agent-1
      const vector3 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-user2-agent1',
        content: 'User 2 Agent 1 document',
        vector: vector3,
        user_id: 'user-2',
        agent_id: 'agent-1',
        title: 'U2A1 Doc'
      });

      // Search with user-1 AND agent-1 scope
      const queryVector = new Float32Array(768).fill(0.1);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-1', agentId: 'agent-1' }
      });

      // Should ONLY return user-1 AND agent-1 documents
      // BUG: Currently only agent_id filter is applied (team_id is last), so returns doc-user1-agent1 and doc-user2-agent1
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-user1-agent1');
    });

    it('should exclude documents that match userId but not agentId', async () => {
      // Create doc for user-1 without agent_id
      const vector1 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-user1-no-agent',
        content: 'User 1 no agent document',
        vector: vector1,
        user_id: 'user-1',
        title: 'U1 No Agent'
      });

      // Create doc for user-1 with agent-1
      const vector2 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-user1-agent1',
        content: 'User 1 agent 1 document',
        vector: vector2,
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'U1A1'
      });

      // Search with user-1 AND agent-1 scope
      const queryVector = new Float32Array(768).fill(0.1);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-1', agentId: 'agent-1' }
      });

      // Should NOT return doc-user1-no-agent (no agent_id)
      // BUG: Currently returns all docs because only agent_id filter is applied
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-user1-agent1');
    });
  });

  describe('Scope filtering with userId + agentId + teamId', () => {
    it('should apply ALL THREE filters: userId, agentId, and teamId', async () => {
      // Create doc: user-1, agent-1, team-1
      const vector1 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-u1-a1-t1',
        content: 'User 1 Agent 1 Team 1 document',
        vector: vector1,
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-1',
        title: 'U1A1T1'
      });

      // Create doc: user-1, agent-1, team-2
      const vector2 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-u1-a1-t2',
        content: 'User 1 Agent 1 Team 2 document',
        vector: vector2,
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-2',
        title: 'U1A1T2'
      });

      // Create doc: user-1, agent-2, team-1
      const vector3 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-u1-a2-t1',
        content: 'User 1 Agent 2 Team 1 document',
        vector: vector3,
        user_id: 'user-1',
        agent_id: 'agent-2',
        team_id: 'team-1',
        title: 'U1A2T1'
      });

      // Search with user-1, agent-1, team-1 scope
      const queryVector = new Float32Array(768).fill(0.1);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-1', agentId: 'agent-1', teamId: 'team-1' }
      });

      // Should ONLY return doc-u1-a1-t1 (matches ALL three)
      // BUG: Currently only team_id filter is applied, returns user-1 AND agent-1 docs for team-1
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-u1-a1-t1');
    });
  });

  describe('Cross-user isolation', () => {
    it('should NOT allow user A to see user B documents', async () => {
      // Create multiple documents for different users
      const vectorBase = new Float32Array(768).fill(0.1);

      // User A documents
      await addDocumentVector({
        id: 'doc-userA-1',
        content: 'User A private document',
        vector: vectorBase,
        user_id: 'user-A',
        title: 'UserA Doc 1'
      });
      await addDocumentVector({
        id: 'doc-userA-2',
        content: 'User A another document',
        vector: vectorBase,
        user_id: 'user-A',
        title: 'UserA Doc 2'
      });

      // User B documents
      await addDocumentVector({
        id: 'doc-userB-1',
        content: 'User B private document',
        vector: vectorBase,
        user_id: 'user-B',
        title: 'UserB Doc 1'
      });

      // Search as user-A
      const queryVector = new Float32Array(768).fill(0.1);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-A' }
      });

      // Should ONLY see user-A documents
      // BUG: Currently returns ALL documents because where() calls overwrite each other
      expect(results.length).toBe(2);
      const userIds = results.map(r => r.metadata?.user_id);
      expect(userIds).not.toContain('user-B');
      expect(userIds).toContain('user-A');
    });

    it('should isolate agent-scoped documents between different agents', async () => {
      // Create document for agent-1
      const vector1 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-agent1-private',
        content: 'Agent 1 private data',
        vector: vector1,
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'Agent1 Private'
      });

      // Create document for agent-2
      const vector2 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-agent2-private',
        content: 'Agent 2 private data',
        vector: vector2,
        user_id: 'user-1',
        agent_id: 'agent-2',
        title: 'Agent2 Private'
      });

      // Search with agent-1 scope
      const queryVector = new Float32Array(768).fill(0.1);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-1', agentId: 'agent-1' }
      });

      // Should NOT see agent-2's document
      // BUG: Agent filter overwrites user filter, returns all users' agent-1 docs
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-agent1-private');
    });
  });

  describe('Empty/null scope field handling', () => {
    it('should handle search without agentId (only userId filter)', async () => {
      const vector1 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-with-agent',
        content: 'Document with agent',
        vector: vector1,
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'With Agent'
      });

      const vector2 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-no-agent',
        content: 'Document without agent',
        vector: vector2,
        user_id: 'user-1',
        title: 'No Agent'
      });

      const queryVector = new Float32Array(768).fill(0.1);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-1' }
      });

      // Should return BOTH documents (no agentId filter means any/no agent)
      expect(results.length).toBe(2);
    });

    it('should handle search without teamId (userId + agentId only)', async () => {
      const vector1 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-with-team',
        content: 'Document with team',
        vector: vector1,
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-1',
        title: 'With Team'
      });

      const vector2 = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-no-team',
        content: 'Document without team',
        vector: vector2,
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'No Team'
      });

      const queryVector = new Float32Array(768).fill(0.1);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-1', agentId: 'agent-1' }
      });

      // Should return BOTH documents (no teamId filter means any/no team)
      expect(results.length).toBe(2);
    });
  });
});