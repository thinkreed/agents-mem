/**
 * @file tests/tools/handlers.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { TOOL_HANDLERS, getHandler } from '../../src/tools/handlers';

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

vi.mock('../../src/materials/filesystem', () => ({
  listMaterials: vi.fn()
}));

// Import mocked modules after vi.mock calls
import { storeDocument } from '../../src/materials/store';
import { getFactExtractor } from '../../src/facts/extractor';
import { searchEntityTree } from '../../src/entity_tree/search';
import { listMaterials } from '../../src/materials/filesystem';

describe('Tool Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('TOOL_HANDLERS map', () => {
    it('should have all 6 handlers defined', () => {
      expect(TOOL_HANDLERS).toBeDefined();
      expect(Object.keys(TOOL_HANDLERS)).toHaveLength(6);
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
        // docType not provided
      };
      
      await handler(params);
      
      expect(storeDocument).toHaveBeenCalledWith({
        userId: 'user-456',
        title: 'Another Document',
        content: 'More content',
        docType: 'note' // default value
      });
    });
  });

  describe('hybrid_search handler', () => {
    it('should return empty results (placeholder)', async () => {
      const handler = TOOL_HANDLERS['hybrid_search'];
      const params = { query: 'test search', userId: 'user-123' };
      
      const result = await handler(params);
      
      expect(result).toEqual({ results: [] });
    });
  });

  describe('fact_extract handler', () => {
    it('should call getFactExtractor and return empty factIds', async () => {
      const mockExtractor = {
        extract: vi.fn().mockResolvedValue([]),
        extractAndSave: vi.fn().mockResolvedValue([])
      };
      (getFactExtractor as Mock).mockReturnValue(mockExtractor);
      
      const handler = TOOL_HANDLERS['fact_extract'];
      const params = {
        userId: 'user-123',
        sourceType: 'document',
        sourceId: 'doc-456'
      };
      
      const result = await handler(params);
      
      expect(getFactExtractor).toHaveBeenCalled();
      expect(result).toEqual({ factIds: [] });
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