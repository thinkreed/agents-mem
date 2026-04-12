/**
 * @file tests/lance/fts_search.test.ts
 * @description FTS search tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  ftsSearch,
  ftsSearchDocuments,
  ftsSearchFacts
} from '../../src/lance/fts_search';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema, createFactsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';
import { addFactVector } from '../../src/lance/facts_vec';

describe('FTS Search', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-fts-test');
  
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
    const vector = new Float32Array(768).fill(0.1);
    
    await addDocumentVector({
      id: 'doc-1',
      content: 'Machine learning and deep neural networks',
      vector: vector,
      user_id: 'user-1',
      title: 'ML Doc'
    });
    
    await addDocumentVector({
      id: 'doc-2',
      content: 'Natural language processing techniques',
      vector: vector,
      user_id: 'user-1',
      title: 'NLP Doc'
    });
    
    await addFactVector({
      id: 'fact-1',
      content: 'User prefers TensorFlow for deep learning',
      vector: vector,
      user_id: 'user-1',
      fact_type: 'preference',
      source_type: 'documents',
      source_id: 'doc-1'
    });
  });

  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('ftsSearch', () => {
    it('should perform FTS search', async () => {
      const results = await ftsSearch({
        tableName: 'documents_vec',
        queryText: 'machine learning',
        column: 'content',
        limit: 10
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('ftsSearchDocuments', () => {
    it('should search documents by text', async () => {
      const results = await ftsSearchDocuments({
        queryText: 'natural language',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results).toBeDefined();
    });

    it('should handle empty query', async () => {
      const results = await ftsSearchDocuments({
        queryText: '',
        limit: 5
      });
      
      expect(results).toBeDefined();
    });
  });

  describe('ftsSearchFacts', () => {
    it('should search facts by text', async () => {
      const results = await ftsSearchFacts({
        queryText: 'deep learning',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results).toBeDefined();
    });
  });
});