/**
 * @file tests/facts/verifier.test.ts
 * @description Fact verifier tests using real SQLite
 * 
 * NOTE: We use real SQLite database instead of mocks to avoid cross-file mock pollution.
 * Each test uses isolated :memory: database with proper setup/teardown.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyFact, verifyFacts } from '../../src/facts/verifier';
import { resetConnection, closeConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { createUser } from '../../src/sqlite/users';
import { createFact, getFactById } from '../../src/sqlite/facts';

describe('Fact Verifier', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'Test User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('verifyFact', () => {
    it('should return false for non-existent fact', async () => {
      const result = await verifyFact('non-existent-id');

      expect(result).toBe(false);
    });

    it('should return true and update existing fact', async () => {
      // Create a fact first
      createFact({
        id: 'fact-1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test fact content',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      const result = await verifyFact('fact-1');

      expect(result).toBe(true);

      // Verify fact was updated
      const fact = getFactById('fact-1');
      expect(fact?.verified).toBeTruthy(); // SQLite returns 1 for true
    });

    it('should call updateFact with verified true', async () => {
      // Create a fact first
      createFact({
        id: 'fact-2',
        user_id: 'user-1',
        source_type: 'messages',
        source_id: 'msg-1',
        content: 'Another fact',
        fact_type: 'preference',
        entities: '["user-2"]',
        importance: 0.7,
        confidence: 0.9,
        verified: false
      });

      await verifyFact('fact-2');

      // Verify fact was updated with verified true
      const fact = getFactById('fact-2');
      expect(fact?.verified).toBeTruthy();
    });
  });

  describe('verifyFacts', () => {
    it('should handle multiple IDs and return results', async () => {
      // Create two facts
      createFact({
        id: 'fact-a',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Fact A',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      createFact({
        id: 'fact-b',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2',
        content: 'Fact B',
        fact_type: 'decision',
        entities: '[]',
        importance: 0.6,
        confidence: 0.9,
        verified: false
      });

      const result = await verifyFacts(['fact-a', 'fact-b', 'fact-c']);

      expect(result).toEqual({
        'fact-a': true,
        'fact-b': true,
        'fact-c': false
      });

      // Verify facts were updated
      const factA = getFactById('fact-a');
      const factB = getFactById('fact-b');
      expect(factA?.verified).toBeTruthy();
      expect(factB?.verified).toBeTruthy();
    });

    it('should handle empty array', async () => {
      const result = await verifyFacts([]);

      expect(result).toEqual({});
    });

    it('should handle all non-existent facts', async () => {
      const result = await verifyFacts(['missing-1', 'missing-2']);

      expect(result).toEqual({
        'missing-1': false,
        'missing-2': false
      });
    });

    it('should handle mixed results', async () => {
      // Create one existing fact
      createFact({
        id: 'existing',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Existing fact',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      const result = await verifyFacts(['missing', 'existing']);

      expect(result).toEqual({
        'missing': false,
        'existing': true
      });

      // Verify existing fact was updated
      const fact = getFactById('existing');
      expect(fact?.verified).toBeTruthy();
    });
  });
});