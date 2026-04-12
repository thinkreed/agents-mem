/**
 * @file tests/lance/fts_search.test.ts
 * @description FTS search tests (TDD) - BM25 scoring tests
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
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable, getTable } from '../../src/lance/connection';
import { createDocumentsVecSchema, createFactsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';
import { addFactVector } from '../../src/lance/facts_vec';
import { createFTSIndex } from '../../src/lance/index';
import { Index } from '@lancedb/lancedb';

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
    
    await addDocumentVector({
      id: 'doc-3',
      content: 'machine learning machine learning machine learning',
      vector: vector,
      user_id: 'user-1',
      title: 'ML Repeated Doc'
    });
    
    await addDocumentVector({
      id: 'doc-4',
      content: 'Deep learning with neural networks for machine learning',
      vector: vector,
      user_id: 'user-2',
      title: 'Other User Doc'
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
    
    // Create FTS index for BM25 scoring
    const documentsTable = await getTable('documents_vec');
    await documentsTable.createIndex('content', { config: Index.fts() });
    
    const factsTable = await getTable('facts_vec');
    await factsTable.createIndex('content', { config: Index.fts() });
  });

  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('BM25 Scoring', () => {
    it('should return BM25 scores (not 0.5 placeholder)', async () => {
      const results = await ftsSearch({
        tableName: 'documents_vec',
        queryText: 'machine learning',
        column: 'content',
        limit: 10
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // BM25 scores should NOT be 0.5 placeholder
      for (const result of results) {
        expect(result.score).not.toBe(0.5);
        // BM25 scores are typically > 0 for matches
        expect(result.score).toBeGreaterThan(0);
      }
    });

    it('should return higher BM25 scores for more relevant documents', async () => {
      const results = await ftsSearch({
        tableName: 'documents_vec',
        queryText: 'machine learning',
        column: 'content',
        limit: 10
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // doc-3 has "machine learning" repeated 3 times, should score highest
      const doc3Result = results.find(r => r.id === 'doc-3');
      const doc1Result = results.find(r => r.id === 'doc-1');
      
      // Both should exist in results
      expect(doc3Result).toBeDefined();
      expect(doc1Result).toBeDefined();
      
      // Higher term frequency should yield higher BM25 score
      if (doc3Result && doc1Result) {
        expect(doc3Result.score).toBeGreaterThan(doc1Result.score);
      }
    });

    it('should rank exact phrase matches appropriately', async () => {
      const results = await ftsSearchDocuments({
        queryText: 'neural networks',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // All results should have BM25 scores (not placeholder)
      for (const result of results) {
        expect(result.score).not.toBe(0.5);
      }
      
      // Results should be sorted by score descending
      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
        }
      }
    });
  });

  describe('Scope Filtering', () => {
    it('should filter results by scope userId', async () => {
      const results = await ftsSearchDocuments({
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // Should only return user-1 documents (doc-1, doc-2, doc-3)
      expect(results.every(r => r.id !== 'doc-4')).toBe(true);
      
      // doc-4 belongs to user-2, should not appear
      expect(results.find(r => r.id === 'doc-4')).toBeUndefined();
    });

    it('should return all matching documents when no scope provided', async () => {
      const results = await ftsSearch({
        tableName: 'documents_vec',
        queryText: 'machine learning',
        column: 'content',
        limit: 10
      });
      
      // Should return documents from both users
      expect(results.some(r => r.id === 'doc-1' || r.id === 'doc-3')).toBe(true);
      expect(results.some(r => r.id === 'doc-4')).toBe(true);
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
      expect(Array.isArray(results)).toBe(true);
      
      // Should find doc-2 with "Natural language processing"
      expect(results.find(r => r.id === 'doc-2')).toBeDefined();
      
      // BM25 scores, not placeholder
      for (const result of results) {
        expect(result.score).not.toBe(0.5);
      }
    });

    it('should handle empty query gracefully', async () => {
      const results = await ftsSearchDocuments({
        queryText: '',
        limit: 5
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Empty query should return empty results or all results
      // depending on implementation
    });

    it('should handle no matching documents', async () => {
      const results = await ftsSearchDocuments({
        queryText: 'quantum computing',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
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
      expect(Array.isArray(results)).toBe(true);
      
      // Should find fact-1
      expect(results.find(r => r.id === 'fact-1')).toBeDefined();
      
      // BM25 scores, not placeholder
      for (const result of results) {
        expect(result.score).not.toBe(0.5);
      }
    });
  });

  describe('LanceDB API Usage', () => {
    it('should use fullTextSearch query method for FTS', async () => {
      // This test verifies the implementation uses LanceDB's fullTextSearch API
      // rather than substring matching
      const results = await ftsSearch({
        tableName: 'documents_vec',
        queryText: 'neural',
        column: 'content',
        limit: 5
      });
      
      // Results should come from LanceDB FTS, not manual filtering
      expect(results.length).toBeGreaterThan(0);
      
      // BM25 scores indicate proper FTS usage
      for (const result of results) {
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).not.toBe(0.5);
      }
    });
  });
});