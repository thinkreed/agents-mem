/**
 * @file tests/lance/documents_vec.test.ts
 * @description Documents vector table tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  addDocumentVector,
  getDocumentVector,
  deleteDocumentVector,
  searchDocumentVectors,
  updateDocumentVector,
  countDocumentVectors
} from '../../src/lance/documents_vec';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema } from '../../src/lance/schema';

describe('Documents Vector Table', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-docs-test');
  
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

  describe('addDocumentVector', () => {
    it('should add document vector', async () => {
      const vector = new Float32Array(768).fill(0.1);
      
      await addDocumentVector({
        id: 'doc-1',
        content: 'Test content',
        vector: vector,
        user_id: 'user-1',
        title: 'Test Document'
      });
      
      const result = await getDocumentVector('doc-1');
      expect(result).toBeDefined();
    });

    it('should add with all fields', async () => {
      const vector = new Float32Array(768).fill(0.2);
      
      await addDocumentVector({
        id: 'doc-2',
        content: 'Full content',
        vector: vector,
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-1',
        is_global: false,
        title: 'Full Document',
        topic: 'project',
        importance: 0.8
      });
      
      const result = await getDocumentVector('doc-2');
      expect(result).toBeDefined();
    });
  });

  describe('getDocumentVector', () => {
    it('should get document vector by id', async () => {
      const vector = new Float32Array(768).fill(0.3);
      await addDocumentVector({
        id: 'doc-3',
        content: 'Get test',
        vector: vector,
        user_id: 'user-1',
        title: 'Get Document'
      });
      
      const result = await getDocumentVector('doc-3');
      
      expect(result).toBeDefined();
      expect(result?.id).toBe('doc-3');
    });

    it('should return undefined for non-existent', async () => {
      const result = await getDocumentVector('non-existent');
      
      expect(result).toBeUndefined();
    });
  });

  describe('deleteDocumentVector', () => {
    it('should delete document vector', async () => {
      const vector = new Float32Array(768).fill(0.4);
      await addDocumentVector({
        id: 'doc-4',
        content: 'Delete test',
        vector: vector,
        user_id: 'user-1',
        title: 'Delete Document'
      });
      
      await deleteDocumentVector('doc-4');
      
      const result = await getDocumentVector('doc-4');
      expect(result).toBeUndefined();
    });
  });

  describe('searchDocumentVectors', () => {
    it('should search by vector similarity', async () => {
      const vector1 = new Float32Array(768).fill(0.5);
      const vector2 = new Float32Array(768).fill(0.6);
      
      await addDocumentVector({
        id: 'doc-5',
        content: 'Search doc 1',
        vector: vector1,
        user_id: 'user-1',
        title: 'Search 1'
      });
      
      await addDocumentVector({
        id: 'doc-6',
        content: 'Search doc 2',
        vector: vector2,
        user_id: 'user-1',
        title: 'Search 2'
      });
      
      const queryVector = new Float32Array(768).fill(0.55);
      const results = await searchDocumentVectors(queryVector, 10);
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search with agent scope', async () => {
      const vector = new Float32Array(768).fill(0.5);
      
      await addDocumentVector({
        id: 'doc-agent',
        content: 'Agent document',
        vector: vector,
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'Agent Doc'
      });
      
      await addDocumentVector({
        id: 'doc-no-agent',
        content: 'No agent document',
        vector: vector,
        user_id: 'user-1',
        title: 'No Agent Doc'
      });
      
      const queryVector = new Float32Array(768).fill(0.5);
      const results = await searchDocumentVectors(queryVector, 10, { userId: 'user-1', agentId: 'agent-1' });
      
      // Should return results filtered by agent scope
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search with team scope', async () => {
      const vector = new Float32Array(768).fill(0.5);
      
      await addDocumentVector({
        id: 'doc-team',
        content: 'Team document',
        vector: vector,
        user_id: 'user-1',
        team_id: 'team-1',
        title: 'Team Doc'
      });
      
      await addDocumentVector({
        id: 'doc-no-team',
        content: 'No team document',
        vector: vector,
        user_id: 'user-1',
        title: 'No Team Doc'
      });
      
      const queryVector = new Float32Array(768).fill(0.5);
      const results = await searchDocumentVectors(queryVector, 10, { userId: 'user-1', teamId: 'team-1' });
      
      // Should return results filtered by team scope
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('updateDocumentVector', () => {
    it('should update document vector', async () => {
      const vector = new Float32Array(768).fill(0.7);
      await addDocumentVector({
        id: 'doc-7',
        content: 'Original',
        vector: vector,
        user_id: 'user-1',
        title: 'Original Title',
        importance: 0.5
      });
      
      const newVector = new Float32Array(768).fill(0.8);
      await updateDocumentVector('doc-7', {
        content: 'Updated',
        vector: newVector,
        importance: 0.9
      });
      
      const result = await getDocumentVector('doc-7');
      expect(result?.importance).toBe(0.9);
    });
  });

  describe('countDocumentVectors', () => {
    it('should count vectors', async () => {
      const vector = new Float32Array(768).fill(0.9);
      
      await addDocumentVector({
        id: 'doc-8',
        content: 'Count 1',
        vector: vector,
        user_id: 'user-1',
        title: 'Count 1'
      });
      
      await addDocumentVector({
        id: 'doc-9',
        content: 'Count 2',
        vector: vector,
        user_id: 'user-1',
        title: 'Count 2'
      });
      
      const count = await countDocumentVectors();
      expect(count).toBeGreaterThan(0);
    });
  });
});