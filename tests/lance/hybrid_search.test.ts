/**
 * @file tests/lance/hybrid_search.test.ts
 * @description Hybrid search tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  hybridSearch,
  hybridSearchDocuments,
  hybridSearchFacts,
  HybridSearchResult
} from '../../src/lance/hybrid_search';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema, createFactsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';
import { addFactVector } from '../../src/lance/facts_vec';

describe('Hybrid Search', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-hybrid-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('documents_vec', createDocumentsVecSchema());
    await createTable('facts_vec', createFactsVecSchema());
    
    // Add test data
    const vector1 = new Float32Array(768).fill(0.1);
    const vector2 = new Float32Array(768).fill(0.2);
    
    await addDocumentVector({
      id: 'doc-1',
      content: 'Machine learning algorithms',
      vector: vector1,
      user_id: 'user-1',
      title: 'ML Doc'
    });
    
    await addDocumentVector({
      id: 'doc-2',
      content: 'Natural language processing',
      vector: vector2,
      user_id: 'user-1',
      title: 'NLP Doc'
    });
    
    await addFactVector({
      id: 'fact-1',
      content: 'User prefers Python for ML',
      vector: vector1,
      user_id: 'user-1',
      fact_type: 'preference',
      source_type: 'documents',
      source_id: 'doc-1'
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

  describe('hybridSearch', () => {
    it('should perform hybrid search', async () => {
      const queryVector = new Float32Array(768).fill(0.15);
      const queryText = 'machine learning';
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: queryVector,
        queryText: queryText,
        limit: 10
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('hybridSearchDocuments', () => {
    it('should search documents', async () => {
      const queryVector = new Float32Array(768).fill(0.15);
      
      const results = await hybridSearchDocuments({
        queryVector: queryVector,
        queryText: 'language processing',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('hybridSearchFacts', () => {
    it('should search facts', async () => {
      const queryVector = new Float32Array(768).fill(0.1);
      
      const results = await hybridSearchFacts({
        queryVector: queryVector,
        queryText: 'Python',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results).toBeDefined();
    });
  });
});