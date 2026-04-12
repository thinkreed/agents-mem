/**
 * @file tests/facts/verifier.test.ts
 * @description Fact verifier tests (TDD)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { verifyFact, verifyFacts } from '../../src/facts/verifier';
import type { FactRecord } from '../../src/sqlite/facts';

// Mock the sqlite/facts module
vi.mock('../../src/sqlite/facts', () => ({
  getFactById: vi.fn(),
  updateFact: vi.fn()
}));

// Import mocked functions after vi.mock
import { getFactById, updateFact } from '../../src/sqlite/facts';

// Type the mocked functions
const mockedGetFactById = getFactById as Mock;
const mockedUpdateFact = updateFact as Mock;

describe('Fact Verifier', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('verifyFact', () => {
    it('should return false for non-existent fact', async () => {
      // Setup: getFactById returns undefined (fact not found)
      mockedGetFactById.mockReturnValue(undefined);

      const result = await verifyFact('non-existent-id');

      expect(result).toBe(false);
      expect(getFactById).toHaveBeenCalledWith('non-existent-id');
      expect(updateFact).not.toHaveBeenCalled();
    });

    it('should return true and update existing fact', async () => {
      // Setup: create a mock fact record
      const mockFact: FactRecord = {
        id: 'fact-1',
        user_id: 'user-1',
        agent_id: undefined,
        team_id: undefined,
        is_global: false,
        source_type: 'documents',
        source_id: 'doc-1',
        source_uri: undefined,
        content: 'Test fact content',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false,
        lance_id: undefined,
        extraction_mode: undefined,
        extracted_at: undefined,
        created_at: 1000,
        updated_at: 1000
      };

      mockedGetFactById.mockReturnValue(mockFact);
      mockedUpdateFact.mockReturnValue({
        ...mockFact,
        verified: true
      });

      const result = await verifyFact('fact-1');

      expect(result).toBe(true);
      expect(getFactById).toHaveBeenCalledWith('fact-1');
      expect(updateFact).toHaveBeenCalledWith('fact-1', { verified: true });
    });

    it('should call updateFact with verified true', async () => {
      const mockFact: FactRecord = {
        id: 'fact-2',
        user_id: 'user-2',
        source_type: 'messages',
        source_id: 'msg-1',
        content: 'Another fact',
        fact_type: 'preference',
        entities: '["user-2"]',
        importance: 0.7,
        confidence: 0.9,
        verified: false,
        is_global: false,
        created_at: 2000,
        updated_at: 2000
      };

      mockedGetFactById.mockReturnValue(mockFact);
      mockedUpdateFact.mockReturnValue({
        ...mockFact,
        verified: true
      });

      await verifyFact('fact-2');

      expect(updateFact).toHaveBeenCalledWith('fact-2', { verified: true });
    });
  });

  describe('verifyFacts', () => {
    it('should handle multiple IDs and return results', async () => {
      // Setup: mock facts for different IDs
      const mockFact1: FactRecord = {
        id: 'fact-a',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Fact A',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false,
        is_global: false,
        created_at: 1000,
        updated_at: 1000
      };

      const mockFact2: FactRecord = {
        id: 'fact-b',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2',
        content: 'Fact B',
        fact_type: 'decision',
        entities: '[]',
        importance: 0.6,
        confidence: 0.9,
        verified: false,
        is_global: false,
        created_at: 1100,
        updated_at: 1100
      };

      // First call returns fact-a, second returns fact-b, third returns undefined
      mockedGetFactById
        .mockReturnValueOnce(mockFact1)
        .mockReturnValueOnce(mockFact2)
        .mockReturnValueOnce(undefined);

      mockedUpdateFact
        .mockReturnValueOnce({ ...mockFact1, verified: true })
        .mockReturnValueOnce({ ...mockFact2, verified: true });

      const result = await verifyFacts(['fact-a', 'fact-b', 'fact-c']);

      expect(result).toEqual({
        'fact-a': true,
        'fact-b': true,
        'fact-c': false
      });

      expect(getFactById).toHaveBeenCalledTimes(3);
      expect(updateFact).toHaveBeenCalledTimes(2);
    });

    it('should handle empty array', async () => {
      const result = await verifyFacts([]);

      expect(result).toEqual({});
      expect(getFactById).not.toHaveBeenCalled();
      expect(updateFact).not.toHaveBeenCalled();
    });

    it('should handle all non-existent facts', async () => {
      mockedGetFactById.mockReturnValue(undefined);

      const result = await verifyFacts(['missing-1', 'missing-2']);

      expect(result).toEqual({
        'missing-1': false,
        'missing-2': false
      });

      expect(getFactById).toHaveBeenCalledTimes(2);
      expect(updateFact).not.toHaveBeenCalled();
    });

    it('should handle mixed results', async () => {
      const existingFact: FactRecord = {
        id: 'existing',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Existing fact',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false,
        is_global: false,
        created_at: 1000,
        updated_at: 1000
      };

      mockedGetFactById
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(existingFact);

      mockedUpdateFact.mockReturnValue({
        ...existingFact,
        verified: true
      });

      const result = await verifyFacts(['missing', 'existing']);

      expect(result).toEqual({
        'missing': false,
        'existing': true
      });
    });
  });
});