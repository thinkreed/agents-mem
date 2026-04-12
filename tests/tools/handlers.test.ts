/**
 * @file tests/tools/handlers.test.ts
 * @description TDD tests for tool handlers implementation
 * 
 * Tests for:
 * - Task 3: hybrid_search handler
 * - Task 4: fact_extract handler + entity tree linking
 * - Task 5: entity_tree_build handler
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock all dependencies
vi.mock('../../src/materials/store', () => ({
  storeDocument: vi.fn(),
  storeAsset: vi.fn()
}));

vi.mock('../../src/lance/hybrid_search', () => ({
  hybridSearchDocuments: vi.fn()
}));

vi.mock('../../src/facts/extractor', () => ({
  getFactExtractor: vi.fn()
}));

vi.mock('../../src/entity_tree/search', () => ({
  searchEntityTree: vi.fn()
}));

vi.mock('../../src/entity_tree/builder', () => ({
  getEntityTreeBuilder: vi.fn()
}));

vi.mock('../../src/facts/linker', () => ({
  linkFactToEntities: vi.fn()
}));

vi.mock('../../src/materials/filesystem', () => ({
  listMaterials: vi.fn()
}));

vi.mock('../../src/embedder/ollama', () => ({
  getEmbedding: vi.fn()
}));

// Import handlers after mocks
import { TOOL_HANDLERS, getHandler } from '../../src/tools/handlers';
import { storeDocument } from '../../src/materials/store';
import { hybridSearchDocuments } from '../../src/lance/hybrid_search';
import { getFactExtractor } from '../../src/facts/extractor';
import { searchEntityTree } from '../../src/entity_tree/search';
import { getEntityTreeBuilder } from '../../src/entity_tree/builder';
import { linkFactToEntities } from '../../src/facts/linker';
import { listMaterials } from '../../src/materials/filesystem';
import { getEmbedding } from '../../src/embedder/ollama';

// Type definitions for handler return values
interface HybridSearchResult {
  results: unknown[];
  error?: string;
}

interface FactExtractResult {
  factIds: string[];
}

interface EntityTreeBuildResult {
  status: string;
  entitiesCount?: number;
  error?: string;
}

describe('Tool Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('TOOL_HANDLERS map', () => {
    it('should have all handlers defined', () => {
      expect(TOOL_HANDLERS).toBeDefined();
      expect(TOOL_HANDLERS['scope_set']).toBeDefined();
      expect(TOOL_HANDLERS['document_save']).toBeDefined();
      expect(TOOL_HANDLERS['hybrid_search']).toBeDefined();
      expect(TOOL_HANDLERS['fact_extract']).toBeDefined();
      expect(TOOL_HANDLERS['materials_ls']).toBeDefined();
      expect(TOOL_HANDLERS['entity_tree_search']).toBeDefined();
    });
  });

  describe('scope_set handler', () => {
    it('should return scope params', async () => {
      const handler = TOOL_HANDLERS['scope_set'];
      const params = { userId: 'user-123', agentId: 'agent-456' };
      
      const result = await handler(params);
      
      expect(result).toEqual({ scope: params });
    });
  });

  describe('document_save handler', () => {
    it('should call storeDocument with correct params', async () => {
      const mockResult = { id: 'doc-123', uri: 'mem://user/user-123/documents/doc-123' };
      (storeDocument as Mock).mockResolvedValue(mockResult);
      
      const handler = TOOL_HANDLERS['document_save'];
      const params = {
        userId: 'user-123',
        title: 'Test Document',
        content: 'Test content',
        docType: 'note'
      };
      
      const result = await handler(params);
      
      expect(storeDocument).toHaveBeenCalledWith({
        userId: 'user-123',
        title: 'Test Document',
        content: 'Test content',
        docType: 'note'
      });
      expect(result).toEqual(mockResult);
    });

    it('should use default docType when not provided', async () => {
      const mockResult = { id: 'doc-456', uri: 'mem://user/user-456/documents/doc-456' };
      (storeDocument as Mock).mockResolvedValue(mockResult);
      
      const handler = TOOL_HANDLERS['document_save'];
      const params = {
        userId: 'user-456',
        title: 'Another Document',
        content: 'More content'
      };
      
      await handler(params);
      
      expect(storeDocument).toHaveBeenCalledWith({
        userId: 'user-456',
        title: 'Another Document',
        content: 'More content',
        docType: 'note'
      });
    });
  });

  // Task 3: hybrid_search handler TDD tests
  describe('hybrid_search handler', () => {
    it('should generate embedding from query', async () => {
      const mockEmbedding = new Float32Array(768).fill(0.5);
      (getEmbedding as Mock).mockResolvedValue(mockEmbedding);
      
      const mockResults = [
        { id: 'doc-1', content: 'Test', score: 0.9, sourceType: 'documents' }
      ];
      (hybridSearchDocuments as Mock).mockResolvedValue(mockResults);
      
      const handler = TOOL_HANDLERS['hybrid_search'];
      const params = {
        query: 'search query',
        userId: 'user-123'
      };
      
      await handler(params);
      
      expect(getEmbedding).toHaveBeenCalledWith('search query');
    });

    it('should call hybridSearchDocuments with embedding and scope', async () => {
      const mockEmbedding = new Float32Array(768).fill(0.5);
      (getEmbedding as Mock).mockResolvedValue(mockEmbedding);
      
      const mockResults = [
        { id: 'doc-1', content: 'Test', score: 0.9, sourceType: 'documents' }
      ];
      (hybridSearchDocuments as Mock).mockResolvedValue(mockResults);
      
      const handler = TOOL_HANDLERS['hybrid_search'];
      const params = {
        query: 'search query',
        userId: 'user-123',
        limit: 5
      };
      
      const result = await handler(params);
      
      expect(hybridSearchDocuments).toHaveBeenCalledWith({
        queryVector: mockEmbedding,
        queryText: 'search query',
        limit: 5,
        scope: { userId: 'user-123' }
      });
      expect(result).toEqual({ results: mockResults });
    });

    it('should return error info when embedding fails', async () => {
      (getEmbedding as Mock).mockRejectedValue(new Error('Embedding service unavailable'));
      
      const handler = TOOL_HANDLERS['hybrid_search'];
      const params = {
        query: 'search query',
        userId: 'user-123'
      };
      
      const result = await handler(params) as HybridSearchResult;
      
      expect(result).toHaveProperty('results');
      expect(result.results).toEqual([]);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('embedding');
    });

    it('should use default limit of 10 when not provided', async () => {
      const mockEmbedding = new Float32Array(768).fill(0.5);
      (getEmbedding as Mock).mockResolvedValue(mockEmbedding);
      (hybridSearchDocuments as Mock).mockResolvedValue([]);
      
      const handler = TOOL_HANDLERS['hybrid_search'];
      const params = {
        query: 'search query',
        userId: 'user-123'
      };
      
      await handler(params);
      
      expect(hybridSearchDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });

    it('should return search results', async () => {
      const mockEmbedding = new Float32Array(768).fill(0.5);
      (getEmbedding as Mock).mockResolvedValue(mockEmbedding);
      
      const mockResults = [
        { id: 'doc-1', content: 'Result 1', score: 0.9, sourceType: 'documents' },
        { id: 'doc-2', content: 'Result 2', score: 0.8, sourceType: 'documents' }
      ];
      (hybridSearchDocuments as Mock).mockResolvedValue(mockResults);
      
      const handler = TOOL_HANDLERS['hybrid_search'];
      const params = {
        query: 'search query',
        userId: 'user-123'
      };
      
      const result = await handler(params) as HybridSearchResult;
      
      expect(result.results.length).toBe(2);
      expect((result.results[0] as {id: string}).id).toBe('doc-1');
    });
  });

  // Task 4: fact_extract handler TDD tests
  describe('fact_extract handler', () => {
    it('should call extractAndSave with correct params', async () => {
      const mockExtractor = {
        extract: vi.fn().mockResolvedValue([]),
        extractAndSave: vi.fn().mockResolvedValue(['fact-1', 'fact-2'])
      };
      (getFactExtractor as Mock).mockReturnValue(mockExtractor);
      
      const handler = TOOL_HANDLERS['fact_extract'];
      const params = {
        userId: 'user-123',
        sourceType: 'documents',
        sourceId: 'doc-456',
        content: 'Document content to extract facts from'
      };
      
      const result = await handler(params) as FactExtractResult;
      
      expect(mockExtractor.extractAndSave).toHaveBeenCalledWith({
        userId: 'user-123',
        sourceType: 'documents',
        sourceId: 'doc-456',
        content: 'Document content to extract facts from'
      });
      expect(result.factIds.length).toBe(2);
    });

    it('should return extracted factIds', async () => {
      const mockExtractor = {
        extract: vi.fn().mockResolvedValue([]),
        extractAndSave: vi.fn().mockResolvedValue(['fact-1', 'fact-2', 'fact-3'])
      };
      (getFactExtractor as Mock).mockReturnValue(mockExtractor);
      
      const handler = TOOL_HANDLERS['fact_extract'];
      const params = {
        userId: 'user-123',
        sourceType: 'documents',
        sourceId: 'doc-456',
        content: 'Content'
      };
      
      const result = await handler(params) as FactExtractResult;
      
      expect(result).toHaveProperty('factIds');
      expect(result.factIds).toEqual(['fact-1', 'fact-2', 'fact-3']);
    });

    it('should return empty factIds when extraction fails', async () => {
      const mockExtractor = {
        extract: vi.fn().mockResolvedValue([]),
        extractAndSave: vi.fn().mockResolvedValue([])
      };
      (getFactExtractor as Mock).mockReturnValue(mockExtractor);
      
      const handler = TOOL_HANDLERS['fact_extract'];
      const params = {
        userId: 'user-123',
        sourceType: 'documents',
        sourceId: 'doc-456',
        content: 'Content'
      };
      
      const result = await handler(params) as FactExtractResult;
      
      expect(result.factIds).toEqual([]);
    });
  });

  describe('materials_ls handler', () => {
    it('should call listMaterials with correct params', async () => {
      const mockResult = [
        { id: 'mat-1', uri: 'mem://user/user-123/documents/doc-1', title: 'Doc 1' },
        { id: 'mat-2', uri: 'mem://user/user-123/documents/doc-2', title: 'Doc 2' }
      ];
      (listMaterials as Mock).mockResolvedValue(mockResult);
      
      const handler = TOOL_HANDLERS['materials_ls'];
      const params = { userId: 'user-123' };
      
      const result = await handler(params);
      
      expect(listMaterials).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(result).toEqual(mockResult);
    });
  });

  describe('entity_tree_search handler', () => {
    it('should call searchEntityTree with correct params', async () => {
      const mockResult = [
        { id: 'node-1', entity_name: 'Entity1', depth: 0 }
      ];
      (searchEntityTree as Mock).mockResolvedValue(mockResult);
      
      const handler = TOOL_HANDLERS['entity_tree_search'];
      const params = {
        userId: 'user-123',
        entityName: 'TestEntity'
      };
      
      const result = await handler(params);
      
      expect(searchEntityTree).toHaveBeenCalledWith({
        userId: 'user-123',
        entityName: 'TestEntity'
      });
      expect(result).toEqual(mockResult);
    });
  });

  // Task 5: entity_tree_build handler TDD tests
  describe('entity_tree_build handler', () => {
    it('should build tree from entities array', async () => {
      const mockBuilder = {
        buildTree: vi.fn().mockResolvedValue('built')
      };
      (getEntityTreeBuilder as Mock).mockReturnValue(mockBuilder);
      
      const handler = TOOL_HANDLERS['entity_tree_build'];
      const params = {
        userId: 'user-123',
        entities: [
          { name: 'Entity1', facts: ['fact-1'] },
          { name: 'Entity2', facts: ['fact-2', 'fact-3'] }
        ]
      };
      
      const result = await handler(params) as EntityTreeBuildResult;
      
      expect(mockBuilder.buildTree).toHaveBeenCalledWith('user-123', params.entities);
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('built');
    });

    it('should return entitiesCount in response', async () => {
      const mockBuilder = {
        buildTree: vi.fn().mockResolvedValue('built')
      };
      (getEntityTreeBuilder as Mock).mockReturnValue(mockBuilder);
      
      const handler = TOOL_HANDLERS['entity_tree_build'];
      const params = {
        userId: 'user-123',
        entities: [
          { name: 'Entity1', facts: ['fact-1'] },
          { name: 'Entity2', facts: ['fact-2'] }
        ]
      };
      
      const result = await handler(params) as EntityTreeBuildResult;
      
      expect(result).toHaveProperty('entitiesCount');
      expect(result.entitiesCount).toBe(2);
    });

    it('should return error for empty entities array', async () => {
      const handler = TOOL_HANDLERS['entity_tree_build'];
      const params = {
        userId: 'user-123',
        entities: []
      };
      
      const result = await handler(params) as EntityTreeBuildResult;
      
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('entities');
    });

    it('should return error when entities not provided', async () => {
      const handler = TOOL_HANDLERS['entity_tree_build'];
      const params = {
        userId: 'user-123'
      };
      
      const result = await handler(params) as EntityTreeBuildResult;
      
      expect(result).toHaveProperty('error');
    });
  });

  describe('getHandler', () => {
    it('should return correct handler for known tools', () => {
      expect(getHandler('scope_set')).toBe(TOOL_HANDLERS['scope_set']);
      expect(getHandler('document_save')).toBe(TOOL_HANDLERS['document_save']);
      expect(getHandler('hybrid_search')).toBe(TOOL_HANDLERS['hybrid_search']);
      expect(getHandler('fact_extract')).toBe(TOOL_HANDLERS['fact_extract']);
      expect(getHandler('materials_ls')).toBe(TOOL_HANDLERS['materials_ls']);
      expect(getHandler('entity_tree_search')).toBe(TOOL_HANDLERS['entity_tree_search']);
    });

    it('should return undefined for unknown tool', () => {
      expect(getHandler('unknown_tool')).toBeUndefined();
      expect(getHandler('nonexistent')).toBeUndefined();
      expect(getHandler('')).toBeUndefined();
    });
  });
});