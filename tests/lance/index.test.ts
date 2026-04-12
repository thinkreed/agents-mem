/**
 * @file tests/lance/index.test.ts
 * @description LanceDB index tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  createVectorIndex,
  createFTSIndex,
  createAllIndexes,
  getIndexStats,
  optimizeIndex
} from '../../src/lance/index';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema, createFactsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';

describe('LanceDB Index', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-index-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('documents_vec', createDocumentsVecSchema());
    await createTable('facts_vec', createFactsVecSchema());
  });

  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('createVectorIndex', () => {
    it('should skip index when not enough rows', async () => {
      // LanceDB requires 256+ rows to create vector index
      // Empty table should skip index creation gracefully
      await createVectorIndex('documents_vec');
      
      const stats = await getIndexStats('documents_vec');
      expect(stats).toBeDefined();
      expect(stats.rowCount).toBe(0);
    });

    it('should create index when enough rows (256+)', async () => {
      // Add 256 documents to trigger index creation path
      const vector = new Float32Array(768).fill(0.1);
      for (let i = 0; i < 256; i++) {
        await addDocumentVector({
          id: `doc-${i}`,
          content: `Test content ${i}`,
          vector: vector,
          user_id: 'user-1',
          title: `Test ${i}`
        });
      }

      // Should now create index (256 rows)
      await createVectorIndex('documents_vec');

      const stats = await getIndexStats('documents_vec');
      expect(stats.rowCount).toBe(256);
      expect(stats.hasVectorIndex).toBe(true); // Has enough rows for index
    });
  });

  describe('createFTSIndex', () => {
    it('should create FTS index on content', async () => {
      await createFTSIndex('documents_vec', 'content');
      
      // FTS index should be created
      const stats = await getIndexStats('documents_vec');
      expect(stats).toBeDefined();
    });
  });

  describe('createAllIndexes', () => {
    it('should handle tables with few rows', async () => {
      // Should gracefully handle tables that don't have enough rows
      await createAllIndexes();
      
      const docStats = await getIndexStats('documents_vec');
      const factStats = await getIndexStats('facts_vec');
      
      expect(docStats).toBeDefined();
      expect(factStats).toBeDefined();
    });
  });

  describe('getIndexStats', () => {
    it('should return index statistics', async () => {
      // Add some data (less than 256, so no index will be created)
      const vector = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-1',
        content: 'Test content for index',
        vector: vector,
        user_id: 'user-1',
        title: 'Test'
      });
      
      // This will skip index creation since only 1 row
      await createVectorIndex('documents_vec');
      
      const stats = await getIndexStats('documents_vec');
      
      expect(stats).toBeDefined();
      expect(stats.rowCount).toBe(1);
      expect(stats.hasVectorIndex).toBe(false); // Not enough rows
    });
  });

  describe('optimizeIndex', () => {
    it('should handle tables with few rows', async () => {
      await optimizeIndex('documents_vec');
      
      // Optimization should complete without error
      expect(true).toBe(true);
    });
  });
});