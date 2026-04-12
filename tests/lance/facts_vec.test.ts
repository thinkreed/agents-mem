/**
 * @file tests/lance/facts_vec.test.ts
 * @description Facts vector table tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  addFactVector,
  getFactVector,
  deleteFactVector,
  searchFactVectors,
  countFactVectors
} from '../../src/lance/facts_vec';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createFactsVecSchema } from '../../src/lance/schema';

describe('Facts Vector Table', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-facts-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
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

  describe('addFactVector', () => {
    it('should add fact vector', async () => {
      const vector = new Float32Array(768).fill(0.1);
      
      await addFactVector({
        id: 'fact-1',
        content: 'User prefers dark theme',
        vector: vector,
        user_id: 'user-1',
        fact_type: 'preference',
        source_type: 'documents',
        source_id: 'doc-1'
      });
      
      const result = await getFactVector('fact-1');
      expect(result).toBeDefined();
    });

    it('should add with confidence', async () => {
      const vector = new Float32Array(768).fill(0.2);
      
      await addFactVector({
        id: 'fact-2',
        content: 'Project deadline is Friday',
        vector: vector,
        user_id: 'user-1',
        fact_type: 'decision',
        source_type: 'messages',
        source_id: 'msg-1',
        confidence: 0.9,
        importance: 0.8
      });
      
      const result = await getFactVector('fact-2');
      expect(result?.confidence).toBe(0.9);
    });
  });

  describe('getFactVector', () => {
    it('should get by id', async () => {
      const vector = new Float32Array(768).fill(0.3);
      
      await addFactVector({
        id: 'fact-3',
        content: 'Get test',
        vector: vector,
        user_id: 'user-1',
        fact_type: 'observation',
        source_type: 'documents',
        source_id: 'doc-2'
      });
      
      const result = await getFactVector('fact-3');
      expect(result?.id).toBe('fact-3');
    });
  });

  describe('deleteFactVector', () => {
    it('should delete fact vector', async () => {
      const vector = new Float32Array(768).fill(0.4);
      
      await addFactVector({
        id: 'fact-4',
        content: 'Delete test',
        vector: vector,
        user_id: 'user-1',
        fact_type: 'conclusion',
        source_type: 'documents',
        source_id: 'doc-3'
      });
      
      await deleteFactVector('fact-4');
      
      const result = await getFactVector('fact-4');
      expect(result).toBeUndefined();
    });
  });

  describe('searchFactVectors', () => {
    it('should search by vector', async () => {
      const vector1 = new Float32Array(768).fill(0.5);
      const vector2 = new Float32Array(768).fill(0.6);
      
      await addFactVector({
        id: 'fact-5',
        content: 'Search 1',
        vector: vector1,
        user_id: 'user-1',
        fact_type: 'preference',
        source_type: 'documents',
        source_id: 'doc-4'
      });
      
      await addFactVector({
        id: 'fact-6',
        content: 'Search 2',
        vector: vector2,
        user_id: 'user-1',
        fact_type: 'decision',
        source_type: 'documents',
        source_id: 'doc-5'
      });
      
      const queryVector = new Float32Array(768).fill(0.55);
      const results = await searchFactVectors(queryVector, 10);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('countFactVectors', () => {
    it('should count vectors', async () => {
      const vector = new Float32Array(768).fill(0.7);
      
      await addFactVector({
        id: 'fact-7',
        content: 'Count test',
        vector: vector,
        user_id: 'user-1',
        fact_type: 'observation',
        source_type: 'documents',
        source_id: 'doc-6'
      });
      
      const count = await countFactVectors();
      expect(count).toBeGreaterThan(0);
    });
  });
});