/**
 * @file tests/lance/messages_vec.test.ts
 * @description Messages vector table tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  addMessageVector,
  getMessageVector,
  deleteMessageVector,
  searchMessageVectors,
  countMessageVectors
} from '../../src/lance/messages_vec';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createMessagesVecSchema } from '../../src/lance/schema';

describe('Messages Vector Table', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-msgs-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('messages_vec', createMessagesVecSchema());
  });

  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('addMessageVector', () => {
    it('should add message vector', async () => {
      const vector = new Float32Array(768).fill(0.1);
      
      await addMessageVector({
        id: 'msg-1',
        content: 'Hello world',
        vector: vector,
        user_id: 'user-1',
        conversation_id: 'conv-1',
        role: 'user'
      });
      
      const result = await getMessageVector('msg-1');
      expect(result).toBeDefined();
    });

    it('should add with timestamp', async () => {
      const vector = new Float32Array(768).fill(0.2);
      const timestamp = Math.floor(Date.now() / 1000);
      
      await addMessageVector({
        id: 'msg-2',
        content: 'Timestamp message',
        vector: vector,
        user_id: 'user-1',
        conversation_id: 'conv-1',
        role: 'assistant',
        timestamp: timestamp
      });
      
      const result = await getMessageVector('msg-2');
      expect(Number(result?.timestamp)).toBe(timestamp);
    });
  });

  describe('getMessageVector', () => {
    it('should get by id', async () => {
      const vector = new Float32Array(768).fill(0.3);
      
      await addMessageVector({
        id: 'msg-3',
        content: 'Get test',
        vector: vector,
        user_id: 'user-1',
        conversation_id: 'conv-2',
        role: 'user'
      });
      
      const result = await getMessageVector('msg-3');
      expect(result?.id).toBe('msg-3');
    });
  });

  describe('deleteMessageVector', () => {
    it('should delete message vector', async () => {
      const vector = new Float32Array(768).fill(0.4);
      
      await addMessageVector({
        id: 'msg-4',
        content: 'Delete test',
        vector: vector,
        user_id: 'user-1',
        conversation_id: 'conv-3',
        role: 'user'
      });
      
      await deleteMessageVector('msg-4');
      
      const result = await getMessageVector('msg-4');
      expect(result).toBeUndefined();
    });
  });

  describe('searchMessageVectors', () => {
    it('should search by vector', async () => {
      const vector1 = new Float32Array(768).fill(0.5);
      const vector2 = new Float32Array(768).fill(0.6);
      
      await addMessageVector({
        id: 'msg-5',
        content: 'Search 1',
        vector: vector1,
        user_id: 'user-1',
        conversation_id: 'conv-4',
        role: 'user'
      });
      
      await addMessageVector({
        id: 'msg-6',
        content: 'Search 2',
        vector: vector2,
        user_id: 'user-1',
        conversation_id: 'conv-4',
        role: 'assistant'
      });
      
      const queryVector = new Float32Array(768).fill(0.55);
      const results = await searchMessageVectors(queryVector, 10);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('countMessageVectors', () => {
    it('should count vectors', async () => {
      const vector = new Float32Array(768).fill(0.7);
      
      await addMessageVector({
        id: 'msg-7',
        content: 'Count 1',
        vector: vector,
        user_id: 'user-1',
        conversation_id: 'conv-5',
        role: 'user'
      });
      
      const count = await countMessageVectors();
      expect(count).toBeGreaterThan(0);
    });
  });
});