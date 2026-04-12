/**
 * @file tests/lance/tiered_vec.test.ts
 * @description Tiered vector table tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  addTieredVector,
  getTieredVector,
  deleteTieredVector,
  searchTieredVectors,
  getTieredVectorsByTier,
  countTieredVectors
} from '../../src/lance/tiered_vec';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createTieredVecSchema } from '../../src/lance/schema';

describe('Tiered Vector Table', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-tiered-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('tiered_vec', createTieredVecSchema());
  });

  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('addTieredVector', () => {
    it('should add L0 tiered vector', async () => {
      const vector = new Float32Array(768).fill(0.1);
      
      await addTieredVector({
        id: 'tiered-1',
        content: 'L0 abstract content',
        vector: vector,
        tier: 0,
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        original_uri: 'mem://user-1/_/_/documents/doc-1'
      });
      
      const result = await getTieredVector('tiered-1');
      expect(result).toBeDefined();
      expect(result?.tier).toBe(0);
    });

    it('should add L1 tiered vector', async () => {
      const vector = new Float32Array(768).fill(0.2);
      
      await addTieredVector({
        id: 'tiered-2',
        content: 'L1 overview content',
        vector: vector,
        tier: 1,
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2'
      });
      
      const result = await getTieredVector('tiered-2');
      expect(result?.tier).toBe(1);
    });
  });

  describe('getTieredVector', () => {
    it('should get by id', async () => {
      const vector = new Float32Array(768).fill(0.3);
      
      await addTieredVector({
        id: 'tiered-3',
        content: 'Get test',
        vector: vector,
        tier: 0,
        user_id: 'user-1',
        source_type: 'messages',
        source_id: 'msg-1'
      });
      
      const result = await getTieredVector('tiered-3');
      expect(result?.id).toBe('tiered-3');
    });
  });

  describe('deleteTieredVector', () => {
    it('should delete tiered vector', async () => {
      const vector = new Float32Array(768).fill(0.4);
      
      await addTieredVector({
        id: 'tiered-4',
        content: 'Delete test',
        vector: vector,
        tier: 0,
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-3'
      });
      
      await deleteTieredVector('tiered-4');
      
      const result = await getTieredVector('tiered-4');
      expect(result).toBeUndefined();
    });
  });

  describe('searchTieredVectors', () => {
    it('should search by vector', async () => {
      const vector1 = new Float32Array(768).fill(0.5);
      const vector2 = new Float32Array(768).fill(0.6);
      
      await addTieredVector({
        id: 'tiered-5',
        content: 'Search 1',
        vector: vector1,
        tier: 0,
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-4'
      });
      
      await addTieredVector({
        id: 'tiered-6',
        content: 'Search 2',
        vector: vector2,
        tier: 1,
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-5'
      });
      
      const queryVector = new Float32Array(768).fill(0.55);
      const results = await searchTieredVectors(queryVector, 10);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getTieredVectorsByTier', () => {
    it('should get vectors by tier', async () => {
      const vector = new Float32Array(768).fill(0.7);
      
      await addTieredVector({
        id: 'tiered-7',
        content: 'Tier 0',
        vector: vector,
        tier: 0,
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-6'
      });
      
      await addTieredVector({
        id: 'tiered-8',
        content: 'Tier 1',
        vector: vector,
        tier: 1,
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-7'
      });
      
      const l0Vectors = await getTieredVectorsByTier(0);
      expect(l0Vectors.every(v => v.tier === 0)).toBe(true);
      
      const l1Vectors = await getTieredVectorsByTier(1);
      expect(l1Vectors.every(v => v.tier === 1)).toBe(true);
    });
  });

  describe('countTieredVectors', () => {
    it('should count vectors', async () => {
      const vector = new Float32Array(768).fill(0.8);
      
      await addTieredVector({
        id: 'tiered-9',
        content: 'Count test',
        vector: vector,
        tier: 0,
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-8'
      });
      
      const count = await countTieredVectors();
      expect(count).toBeGreaterThan(0);
    });
  });
});