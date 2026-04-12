/**
 * @file tests/lance/semantic_search.test.ts
 * @description Semantic search tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  semanticSearch,
  semanticSearchDocuments,
  semanticSearchMessages,
  semanticSearchFacts
} from '../../src/lance/semantic_search';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema, createMessagesVecSchema, createFactsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';
import { addMessageVector } from '../../src/lance/messages_vec';
import { addFactVector } from '../../src/lance/facts_vec';

describe('Semantic Search', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-semantic-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('documents_vec', createDocumentsVecSchema());
    await createTable('messages_vec', createMessagesVecSchema());
    await createTable('facts_vec', createFactsVecSchema());
    
    // Add test data
    const vector1 = new Float32Array(768).fill(0.1);
    const vector2 = new Float32Array(768).fill(0.2);
    const vector3 = new Float32Array(768).fill(0.3);
    
    await addDocumentVector({
      id: 'doc-1',
      content: 'Python programming tutorial',
      vector: vector1,
      user_id: 'user-1',
      title: 'Python Doc'
    });
    
    await addMessageVector({
      id: 'msg-1',
      content: 'How to write Python code',
      vector: vector2,
      user_id: 'user-1',
      conversation_id: 'conv-1',
      role: 'user'
    });
    
    await addFactVector({
      id: 'fact-1',
      content: 'User knows Python',
      vector: vector3,
      user_id: 'user-1',
      fact_type: 'observation',
      source_type: 'messages',
      source_id: 'msg-1'
    });
    
    // Note: Vector index requires 256+ rows, skip for small test data
  });

  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('semanticSearch', () => {
    it('should perform semantic search', async () => {
      const queryVector = new Float32Array(768).fill(0.15);
      
      const results = await semanticSearch({
        tableName: 'documents_vec',
        queryVector: queryVector,
        limit: 5
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('semanticSearchDocuments', () => {
    it('should search documents by vector', async () => {
      const queryVector = new Float32Array(768).fill(0.1);
      
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search documents with agent scope', async () => {
      // Add document with agent scope
      const vector = new Float32Array(768).fill(0.15);
      await addDocumentVector({
        id: 'doc-agent',
        content: 'Agent document',
        vector: vector,
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'Agent Doc'
      });
      
      const queryVector = new Float32Array(768).fill(0.15);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 5,
        scope: { userId: 'user-1', agentId: 'agent-1' }
      });
      
      expect(results).toBeDefined();
    });
  });

  describe('semanticSearchMessages', () => {
    it('should search messages by vector', async () => {
      const queryVector = new Float32Array(768).fill(0.2);
      
      const results = await semanticSearchMessages({
        queryVector: queryVector,
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results).toBeDefined();
    });
  });

  describe('semanticSearchFacts', () => {
    it('should search facts by vector', async () => {
      const queryVector = new Float32Array(768).fill(0.3);
      
      const results = await semanticSearchFacts({
        queryVector: queryVector,
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results).toBeDefined();
    });
  });
});