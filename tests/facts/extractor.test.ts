/**
 * @file tests/facts/extractor.test.ts
 * @description Fact extractor tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FactExtractor,
  ExtractedFact,
  getFactExtractor
} from '../../src/facts/extractor';
import {
  getFactsBySource
} from '../../src/sqlite/facts';
import {
  getExtractionStatusByTarget
} from '../../src/sqlite/extraction_status';
import { createUser } from '../../src/sqlite/users';
import {
  closeConnection,
  resetConnection,
  setDatabasePath
} from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('FactExtractor', () => {
  beforeEach(() => {
    // Reset SQLite connection
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    
    // Create test user
    createUser({ id: 'user-1', name: 'Test User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('FactExtractor class', () => {
    it('should instantiate FactExtractor', () => {
      const extractor = new FactExtractor();
      
      expect(extractor).toBeDefined();
      expect(extractor).toBeInstanceOf(FactExtractor);
    });

    it('should have extract method', () => {
      const extractor = new FactExtractor();
      
      expect(typeof extractor.extract).toBe('function');
    });

    it('should have extractAndSave method', () => {
      const extractor = new FactExtractor();
      
      expect(typeof extractor.extractAndSave).toBe('function');
    });
  });

  describe('extract()', () => {
    it('should return empty array (placeholder implementation)', async () => {
      const extractor = new FactExtractor();
      const result = await extractor.extract('some content');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return empty array for empty content', async () => {
      const extractor = new FactExtractor();
      const result = await extractor.extract('');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return empty array for whitespace content', async () => {
      const extractor = new FactExtractor();
      const result = await extractor.extract('   ');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return empty array for null-like content', async () => {
      const extractor = new FactExtractor();
      const result = await extractor.extract('null');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should accept string parameter', async () => {
      const extractor = new FactExtractor();
      
      // Should not throw for various string inputs
      await expect(extractor.extract('test')).resolves.toBeDefined();
      await expect(extractor.extract('long content here')).resolves.toBeDefined();
    });

    it('should be async (return Promise)', () => {
      const extractor = new FactExtractor();
      const result = extractor.extract('content');
      
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('extractAndSave()', () => {
    it('should create extraction status', async () => {
      const extractor = new FactExtractor();
      await extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-1',
        content: 'Test content'
      });
      
      const status = getExtractionStatusByTarget('documents', 'doc-1');
      
      expect(status).toBeDefined();
      expect(status?.target_type).toBe('documents');
      expect(status?.target_id).toBe('doc-1');
      expect(status?.status).toBe('completed');
    });

    it('should return empty array of fact IDs (placeholder implementation)', async () => {
      const extractor = new FactExtractor();
      const factIds = await extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-2',
        content: 'Test content'
      });
      
      expect(factIds).toBeDefined();
      expect(Array.isArray(factIds)).toBe(true);
      expect(factIds.length).toBe(0);
    });

    it('should set extraction mode to on_demand', async () => {
      const extractor = new FactExtractor();
      await extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-3',
        content: 'Test content'
      });
      
      const status = getExtractionStatusByTarget('documents', 'doc-3');
      
      expect(status?.extraction_mode).toBe('on_demand');
    });

    it('should set facts_count to 0', async () => {
      const extractor = new FactExtractor();
      await extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-4',
        content: 'Test content'
      });
      
      const status = getExtractionStatusByTarget('documents', 'doc-4');
      
      expect(status?.facts_count).toBe(0);
    });

    it('should work with different source types', async () => {
      const extractor = new FactExtractor();
      
      // Test with messages source type
      await extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'messages',
        sourceId: 'msg-1',
        content: 'Message content'
      });
      
      const msgStatus = getExtractionStatusByTarget('messages', 'msg-1');
      expect(msgStatus).toBeDefined();
      expect(msgStatus?.target_type).toBe('messages');
      
      // Test with documents source type
      await extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-5',
        content: 'Document content'
      });
      
      const docStatus = getExtractionStatusByTarget('documents', 'doc-5');
      expect(docStatus).toBeDefined();
      expect(docStatus?.target_type).toBe('documents');
    });

    it('should work with empty content', async () => {
      const extractor = new FactExtractor();
      const factIds = await extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-empty',
        content: ''
      });
      
      expect(factIds).toBeDefined();
      expect(factIds.length).toBe(0);
      
      const status = getExtractionStatusByTarget('documents', 'doc-empty');
      expect(status).toBeDefined();
      expect(status?.status).toBe('completed');
    });

    it('should return Promise', () => {
      const extractor = new FactExtractor();
      const result = extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-promise',
        content: 'content'
      });
      
      expect(result).toBeInstanceOf(Promise);
    });

    it('should accept required input parameters', async () => {
      const extractor = new FactExtractor();
      
      // Should work with all required fields
      await expect(extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-6',
        content: 'content'
      })).resolves.toBeDefined();
    });

    it('should save facts when extract returns data', async () => {
      // Create a mock extractor that returns facts
      class MockExtractor extends FactExtractor {
        async extract(content: string): Promise<ExtractedFact[]> {
          return [
            {
              content: 'User prefers dark mode',
              factType: 'preference',
              entities: ['user', 'theme'],
              confidence: 0.9
            },
            {
              content: 'User works on project X',
              factType: 'observation',
              entities: ['user', 'project'],
              confidence: 0.8
            }
          ];
        }
      }
      
      const mockExtractor = new MockExtractor();
      const factIds = await mockExtractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-with-facts',
        content: 'Some content with facts'
      });
      
      expect(factIds).toBeDefined();
      expect(Array.isArray(factIds)).toBe(true);
      expect(factIds.length).toBe(2);
      
      // Verify facts were created
      const savedFacts = getFactsBySource('documents', 'doc-with-facts');
      expect(savedFacts.length).toBe(2);
      expect(savedFacts[0].content).toBe('User prefers dark mode');
      expect(savedFacts[1].content).toBe('User works on project X');
      
      // Verify extraction status was updated
      const status = getExtractionStatusByTarget('documents', 'doc-with-facts');
      expect(status?.facts_count).toBe(2);
    });

    it('should handle single fact extraction', async () => {
      class MockExtractor extends FactExtractor {
        async extract(content: string): Promise<ExtractedFact[]> {
          return [
            {
              content: 'Single fact',
              factType: 'decision',
              entities: ['entity'],
              confidence: 0.75
            }
          ];
        }
      }
      
      const mockExtractor = new MockExtractor();
      const factIds = await mockExtractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'messages',
        sourceId: 'msg-single',
        content: 'content'
      });
      
      expect(factIds.length).toBe(1);
      
      const savedFacts = getFactsBySource('messages', 'msg-single');
      expect(savedFacts.length).toBe(1);
      expect(savedFacts[0].fact_type).toBe('decision');
      expect(savedFacts[0].confidence).toBe(0.75);
    });

    it('should create facts with correct entities JSON', async () => {
      class MockExtractor extends FactExtractor {
        async extract(content: string): Promise<ExtractedFact[]> {
          return [
            {
              content: 'Test fact with entities',
              factType: 'observation',
              entities: ['person', 'location', 'date'],
              confidence: 0.95
            }
          ];
        }
      }
      
      const mockExtractor = new MockExtractor();
      await mockExtractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-entities',
        content: 'content'
      });
      
      const savedFacts = getFactsBySource('documents', 'doc-entities');
      expect(savedFacts.length).toBe(1);
      
      const entities = JSON.parse(savedFacts[0].entities);
      expect(entities).toEqual(['person', 'location', 'date']);
    });
  });

  describe('getFactExtractor()', () => {
    it('should return FactExtractor instance', () => {
      const extractor = getFactExtractor();
      
      expect(extractor).toBeDefined();
      expect(extractor).toBeInstanceOf(FactExtractor);
    });

    it('should return same instance (singleton pattern)', () => {
      const extractor1 = getFactExtractor();
      const extractor2 = getFactExtractor();
      
      expect(extractor1).toBe(extractor2);
    });

    it('should return same instance on multiple calls', () => {
      const instances = [
        getFactExtractor(),
        getFactExtractor(),
        getFactExtractor(),
        getFactExtractor()
      ];
      
      // All instances should be the same object reference
      for (const instance of instances) {
        expect(instance).toBe(instances[0]);
      }
    });

    it('should create instance only once', () => {
      // First call should create the instance
      const extractor1 = getFactExtractor();
      expect(extractor1).toBeDefined();
      
      // Subsequent calls should return the same instance
      const extractor2 = getFactExtractor();
      expect(extractor2).toBe(extractor1);
    });
  });

  describe('ExtractedFact interface', () => {
    it('should have correct structure', () => {
      // Type check - ExtractedFact is just an interface, so we check the structure
      const mockFact: ExtractedFact = {
        content: 'test content',
        factType: 'preference',
        entities: ['entity1', 'entity2'],
        confidence: 0.9
      };
      
      expect(mockFact.content).toBe('test content');
      expect(mockFact.factType).toBe('preference');
      expect(mockFact.entities).toHaveLength(2);
      expect(mockFact.confidence).toBe(0.9);
    });

    it('should allow empty entities array', () => {
      const mockFact: ExtractedFact = {
        content: 'test content',
        factType: 'observation',
        entities: [],
        confidence: 0.5
      };
      
      expect(mockFact.entities).toHaveLength(0);
    });

    it('should allow confidence values between 0 and 1', () => {
      const lowConfidence: ExtractedFact = {
        content: 'test',
        factType: 'test',
        entities: [],
        confidence: 0.0
      };
      
      const highConfidence: ExtractedFact = {
        content: 'test',
        factType: 'test',
        entities: [],
        confidence: 1.0
      };
      
      expect(lowConfidence.confidence).toBe(0.0);
      expect(highConfidence.confidence).toBe(1.0);
    });
  });
});