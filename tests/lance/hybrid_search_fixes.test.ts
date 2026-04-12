/**
 * @file tests/lance/hybrid_search_fixes.test.ts
 * @description Failing tests for hybridSearchDocuments bug fix
 * 
 * Bug: hybridSearchDocuments returns hardcoded 0.5 scores instead of RRF scores
 * Expected: Should call hybridSearch() which performs FTS + vector + RRF reranking
 * 
 * All tests in this file MUST FAIL initially (TDD red phase)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as lancedb from '@lancedb/lancedb';
import {
  hybridSearch,
  hybridSearchDocuments,
  HybridSearchResult
} from '../../src/lance/hybrid_search';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';

describe('hybridSearchDocuments Bug Fix - RRF Scores', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-hybrid-fix-test');
  let documentsTable: lancedb.Table;
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    documentsTable = await createTable('documents_vec', createDocumentsVecSchema());
    
    // Create FTS index on content column for hybrid search
    try {
      await documentsTable.createIndex('content', {
        config: lancedb.Index.fts()
      });
    } catch {
      // FTS index may fail on small datasets, ignore
    }
    
    // Add test data with distinctive vectors
    const mlVector = new Float32Array(768);
    for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
    
    const nlpVector = new Float32Array(768);
    for (let i = 0; i < 768; i++) nlpVector[i] = 0.2 + (i % 10) * 0.01;
    
    const randomVector = new Float32Array(768);
    for (let i = 0; i < 768; i++) randomVector[i] = 0.9; // Distant vector
    
    // Document with "machine learning" in content - good FTS match
    await addDocumentVector({
      id: 'doc-ml-1',
      content: 'Machine learning algorithms and neural networks',
      vector: mlVector,
      user_id: 'user-1',
      title: 'ML Doc'
    });
    
    // Document that matches FTS but has poor vector match
    await addDocumentVector({
      id: 'doc-keyword-1',
      content: 'Machine learning tutorial for beginners',
      vector: randomVector, // Poor vector match, but good FTS match
      user_id: 'user-1',
      title: 'Keyword Match Doc'
    });
    
    await addDocumentVector({
      id: 'doc-nlp-1',
      content: 'Natural language processing and text analysis',
      vector: nlpVector,
      user_id: 'user-1',
      title: 'NLP Doc'
    });
    
    // Documents with different scopes
    await addDocumentVector({
      id: 'doc-agent-1',
      content: 'Machine learning with Python agent',
      vector: mlVector,
      user_id: 'user-1',
      agent_id: 'agent-1',
      title: 'Agent ML Doc'
    });
    
    await addDocumentVector({
      id: 'doc-team-1',
      content: 'Team machine learning project',
      vector: mlVector,
      user_id: 'user-1',
      team_id: 'team-1',
      title: 'Team ML Doc'
    });
    
    await addDocumentVector({
      id: 'doc-other-user',
      content: 'Machine learning for other user',
      vector: mlVector,
      user_id: 'user-2',
      title: 'Other User Doc'
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

  describe('BUG FIX: hybridSearchDocuments must return RRF scores, not 0.5', () => {
    it('should return RRF scores not hardcoded 0.5', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // BUG: Currently returns hardcoded 0.5 scores
      // FIX: Should return actual RRF scores from hybridSearch()
      for (const result of results) {
        // Score should NOT be exactly 0.5 (the placeholder bug)
        expect(result.score).not.toBe(0.5);
        
        // RRF scores are positive and bounded between 0 and 1
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThan(1);
      }
    });

    it('should return varying RRF scores based on relevance', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // With proper RRF, different documents should have different scores
      // If all scores are 0.5, the bug is present
      const scores = results.map(r => r.score);
      const uniqueScores = new Set(scores);
      
      // Should have at least 2 different scores among results
      expect(uniqueScores.size).toBeGreaterThan(1);
    });

    it('should return RRF scores when queryText differs from vector content', async () => {
      // Using vector similar to ML but different search text
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'neural networks', // Different from "machine learning"
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // Should still return RRF scores, not 0.5
      for (const result of results) {
        expect(result.score).not.toBe(0.5);
      }
    });
  });

  describe('BUG FIX: hybridSearchDocuments must combine FTS + vector results', () => {
    it('should find FTS-only matches even with poor vector match', async () => {
      // Use a vector that doesn't match well with doc-keyword-1
      const poorVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) poorVector[i] = 0.5 + i * 0.001;
      
      // This query should find doc-keyword-1 via FTS even with poor vector
      const results = await hybridSearchDocuments({
        queryVector: poorVector,
        queryText: 'machine learning tutorial',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // Find the document that only matches via FTS (not vector)
      const keywordMatch = results.find(r => r.id === 'doc-keyword-1');
      
      // With proper hybrid search, FTS-only matches should appear
      // The bug returns only vector results with 0.5 scores
      expect(keywordMatch).toBeDefined();
      expect(keywordMatch?.content.toLowerCase()).toContain('machine learning');
      
      // Score should be RRF, not 0.5
      expect(keywordMatch?.score).not.toBe(0.5);
    });

    it('should rank documents matching both FTS and vector higher', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // Documents matching both FTS and vector should rank higher
      // With RRF: doc-ml-1 should rank higher than doc-keyword-1
      const mlDocIndex = results.findIndex(r => r.id === 'doc-ml-1');
      const keywordDocIndex = results.findIndex(r => r.id === 'doc-keyword-1');
      
      // doc-ml-1 has both good vector AND FTS match, should rank higher
      // doc-keyword-1 has poor vector but good FTS match
      if (mlDocIndex !== -1 && keywordDocIndex !== -1) {
        expect(mlDocIndex).toBeLessThan(keywordDocIndex);
      }
    });

    it('should use queryText for FTS search', async () => {
      // Search for text that exists in doc-nlp-1 but not in ML docs
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'natural language processing',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // Should find NLP document via FTS search
      const nlpDoc = results.find(r => r.id === 'doc-nlp-1');
      
      // Bug: Currently uses only vector search, ignores queryText
      // Fix: Should use hybridSearch which includes FTS
      expect(nlpDoc).toBeDefined();
      expect(nlpDoc?.content.toLowerCase()).toContain('natural language');
      
      // Score should be RRF, not 0.5
      expect(nlpDoc?.score).not.toBe(0.5);
    });
  });

  describe('BUG FIX: hybridSearchDocuments must filter by scope correctly', () => {
    it('should filter results by userId scope', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // Should NOT include documents from other users
      const otherUserDoc = results.find(r => r.id === 'doc-other-user');
      expect(otherUserDoc).toBeUndefined();
      
      // Should include user-1 documents
      expect(results.length).toBeGreaterThan(0);
      
      // All results should have correct sourceType
      for (const result of results) {
        expect(result.sourceType).toBe('documents');
      }
    });

    it('should filter results by userId and agentId scope', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1', agentId: 'agent-1' }
      });
      
      // Should include agent-scoped document
      const agentDoc = results.find(r => r.id === 'doc-agent-1');
      expect(agentDoc).toBeDefined();
      
      // Bug: Currently returns vector-only results with 0.5 scores
      // Fix: Should return proper hybrid results with scope filtering
      expect(agentDoc?.score).not.toBe(0.5);
    });

    it('should filter results by userId and teamId scope', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1', teamId: 'team-1' }
      });
      
      // Should include team-scoped document
      const teamDoc = results.find(r => r.id === 'doc-team-1');
      expect(teamDoc).toBeDefined();
      
      // Bug fix verification
      expect(teamDoc?.score).not.toBe(0.5);
    });
  });

  describe('Comparison: hybridSearch (correct) vs hybridSearchDocuments (buggy)', () => {
    it('hybridSearch returns RRF scores correctly', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // hybridSearch (the reference implementation) works correctly
      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.score).not.toBe(0.5);
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThan(1);
      }
    });

    it('hybridSearchDocuments should match hybridSearch behavior', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const hybridRef = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      const docSearch = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // Both should return same number of results
      expect(docSearch.length).toBe(hybridRef.length);
      
      // BUG: hybridSearchDocuments returns 0.5, hybridSearch returns RRF
      // After fix: both should return similar RRF scores
      const buggyResult = docSearch.find(r => r.score === 0.5);
      expect(buggyResult).toBeUndefined(); // Bug: will find results with 0.5
    });
  });
});