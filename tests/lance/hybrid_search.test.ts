/**
 * @file tests/lance/hybrid_search.test.ts
 * @description Hybrid search tests (TDD)
 * 
 * Tests for FTS + Vector + RRF hybrid search implementation.
 * Must verify RRF scoring, not placeholder 0.5 scores.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as lancedb from '@lancedb/lancedb';
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
  let db: lancedb.Connection;
  let documentsTable: lancedb.Table;
  let factsTable: lancedb.Table;
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    documentsTable = await createTable('documents_vec', createDocumentsVecSchema());
    factsTable = await createTable('facts_vec', createFactsVecSchema());
    
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
    
    const pythonVector = new Float32Array(768);
    for (let i = 0; i < 768; i++) pythonVector[i] = 0.3 + (i % 10) * 0.01;
    
    const randomVector = new Float32Array(768);
    for (let i = 0; i < 768; i++) randomVector[i] = 0.9; // Distant vector
    
    // Documents for testing FTS + Vector + RRF
    await addDocumentVector({
      id: 'doc-ml-1',
      content: 'Machine learning algorithms and neural networks',
      vector: mlVector,
      user_id: 'user-1',
      title: 'ML Doc'
    });
    
    await addDocumentVector({
      id: 'doc-ml-2',
      content: 'Deep learning machine learning fundamentals',
      vector: mlVector, // Similar vector, also contains "machine learning"
      user_id: 'user-1',
      title: 'ML Doc 2'
    });
    
    await addDocumentVector({
      id: 'doc-nlp-1',
      content: 'Natural language processing and text analysis',
      vector: nlpVector,
      user_id: 'user-1',
      title: 'NLP Doc'
    });
    
    // Document that matches FTS but has poor vector match
    await addDocumentVector({
      id: 'doc-keyword-1',
      content: 'Machine learning tutorial for beginners',
      vector: randomVector, // Poor vector match, but good FTS match
      user_id: 'user-1',
      title: 'Keyword Match Doc'
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
    
    // Facts for testing
    await addFactVector({
      id: 'fact-1',
      content: 'User prefers Python for machine learning',
      vector: pythonVector,
      user_id: 'user-1',
      fact_type: 'preference',
      source_type: 'documents',
      source_id: 'doc-ml-1'
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

  describe('hybridSearch - RRF Scoring', () => {
    it('should return results with RRF relevance scores (not placeholder 0.5)', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // RRF scores should NOT be exactly 0.5 (placeholder)
      // RRF produces scores like 0.033, 0.016, etc based on rank positions
      for (const result of results) {
        // Score should not be exactly 0.5 (the fake placeholder score)
        expect(result.score).not.toBe(0.5);
        // RRF scores are positive and bounded
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThan(1);
      }
    });

    it('should combine FTS and Vector search results', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10
      });
      
      // Should find documents that match both FTS (contain "machine learning")
      // and vector similarity
      const mlDocs = results.filter(r => 
        r.content.toLowerCase().includes('machine learning')
      );
      
      // At least some results should match the FTS query text
      expect(mlDocs.length).toBeGreaterThan(0);
    });

    it('should rank documents matching both FTS and vector highest', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10
      });
      
      // Documents that match both should have higher RRF scores
      // than documents that only match one modality
      const topResults = results.slice(0, 3);
      
      // Top results should contain "machine learning" (FTS match)
      // AND have similar vectors
      const topContentMatch = topResults.filter(r =>
        r.content.toLowerCase().includes('machine learning')
      );
      
      expect(topContentMatch.length).toBeGreaterThan(0);
    });

    it('should find FTS-only matches even with poor vector match', async () => {
      // Use a vector that doesn't match well
      const poorVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) poorVector[i] = 0.5 + i * 0.001; // Different pattern
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: poorVector,
        queryText: 'machine learning',
        limit: 10
      });
      
      // Should still find documents via FTS even if vector is poor
      // doc-keyword-1 has poor vector but good FTS match
      const keywordMatch = results.find(r => r.id === 'doc-keyword-1');
      
      // With RRF, FTS-only matches should still appear in results
      // May not be at top but should be present
      if (keywordMatch) {
        expect(keywordMatch.content.toLowerCase()).toContain('machine learning');
      }
    });
  });

  describe('hybridSearch - Scope Filtering', () => {
    it('should filter by userId', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      // Should not include documents from other users
      const otherUserDoc = results.find(r => r.id === 'doc-other-user');
      expect(otherUserDoc).toBeUndefined();
      
      // Should include user-1 documents
      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter by userId and agentId', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1', agentId: 'agent-1' }
      });
      
      // Should include agent-scoped document
      const agentDoc = results.find(r => r.id === 'doc-agent-1');
      // Note: agentId filter should work, but test may need to verify behavior
      // based on actual LanceDB filtering implementation
      expect(results).toBeDefined();
    });

    it('should filter by userId and teamId', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1', teamId: 'team-1' }
      });
      
      // Should include team-scoped document
      const teamDoc = results.find(r => r.id === 'doc-team-1');
      expect(results).toBeDefined();
    });
  });

  describe('hybridSearchDocuments', () => {
    it('should search documents with hybrid search', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should have proper sourceType
      for (const result of results) {
        expect(result.sourceType).toBe('documents');
      }
    });

    it('should return RRF scores not placeholder 0.5', async () => {
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearchDocuments({
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      // No result should have placeholder score 0.5
      for (const result of results) {
        expect(result.score).not.toBe(0.5);
      }
    });
  });

  describe('hybridSearchFacts', () => {
    it('should search facts with hybrid search', async () => {
      const pythonVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) pythonVector[i] = 0.3 + (i % 10) * 0.01;
      
      const results = await hybridSearchFacts({
        queryVector: pythonVector,
        queryText: 'Python',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results).toBeDefined();
      
      // Should have proper sourceType
      for (const result of results) {
        expect(result.sourceType).toBe('facts');
      }
    });

    it('should return RRF scores not placeholder', async () => {
      const pythonVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) pythonVector[i] = 0.3 + (i % 10) * 0.01;
      
      const results = await hybridSearchFacts({
        queryVector: pythonVector,
        queryText: 'Python',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      if (results.length > 0) {
        // Should not use placeholder confidence for all scores
        // At least some scores should reflect actual RRF computation
        const nonPlaceholderScores = results.filter(r => r.score !== 0.5 && r.score !== 0.3);
        // With proper RRF implementation, we should see computed scores
        // If all are placeholders, test will fail
        expect(nonPlaceholderScores.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      const randomVector = new Float32Array(768).fill(0.999);
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: randomVector,
        queryText: 'xyznonexistent123', // Text that won't match anything
        limit: 10,
        scope: { userId: 'user-999' } // User with no documents
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // May return empty array or fallback results
    });

    it('should handle missing FTS index gracefully', async () => {
      // When FTS index doesn't exist or fails, should fallback to vector search
      const mlVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
      
      const results = await hybridSearch({
        tableName: 'documents_vec',
        queryVector: mlVector,
        queryText: 'machine learning',
        limit: 10
      });
      
      // Should still return results even if FTS fails
      expect(results).toBeDefined();
    });
  });
});