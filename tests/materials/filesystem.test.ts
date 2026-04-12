/**
 * @file tests/materials/filesystem.test.ts
 * @description File system operations for materials tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listMaterials,
  getMaterialTree,
  grepMaterials,
  readMaterial
} from '../../src/materials/filesystem';

// Mock sqlite/documents
vi.mock('../../src/sqlite/documents', () => ({
  getDocumentById: vi.fn()
}));

// Mock sqlite/assets
vi.mock('../../src/sqlite/assets', () => ({
  getAssetById: vi.fn()
}));

// Mock uri_resolver
vi.mock('../../src/materials/uri_resolver', () => ({
  resolveURI: vi.fn()
}));

// Import mocked modules after vi.mock
import { getDocumentById } from '../../src/sqlite/documents';
import { getAssetById } from '../../src/sqlite/assets';
import { resolveURI } from '../../src/materials/uri_resolver';

// Cast mocks for TypeScript
const mockGetDocumentById = getDocumentById as ReturnType<typeof vi.fn>;
const mockGetAssetById = getAssetById as ReturnType<typeof vi.fn>;
const mockResolveURI = resolveURI as ReturnType<typeof vi.fn>;

describe('Filesystem Materials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listMaterials', () => {
    it('should return empty array (placeholder)', async () => {
      const scope = {
        userId: 'user-1',
        agentId: 'agent-1',
        teamId: 'team-1'
      };

      const result = await listMaterials(scope);

      expect(result).toEqual([]);
    });

    it('should return empty array with minimal scope', async () => {
      const scope = {
        userId: 'user-1'
      };

      const result = await listMaterials(scope);

      expect(result).toEqual([]);
    });

    it('should return empty array with type filter', async () => {
      const scope = {
        userId: 'user-1',
        type: 'documents'
      };

      const result = await listMaterials(scope);

      expect(result).toEqual([]);
    });
  });

  describe('getMaterialTree', () => {
    it('should return expected structure', async () => {
      const scope = {
        userId: 'user-1',
        agentId: 'agent-1',
        teamId: 'team-1'
      };

      const result = await getMaterialTree(scope);

      expect(result).toEqual({
        documents: [],
        assets: [],
        facts: [],
        tiered: []
      });
    });

    it('should return structure with all empty arrays', async () => {
      const scope = {
        userId: 'user-1'
      };

      const result = await getMaterialTree(scope);

      expect(result.documents).toEqual([]);
      expect(result.assets).toEqual([]);
      expect(result.facts).toEqual([]);
      expect(result.tiered).toEqual([]);
    });

    it('should have correct keys in result', async () => {
      const scope = { userId: 'user-1' };

      const result = await getMaterialTree(scope);

      expect(Object.keys(result)).toEqual(['documents', 'assets', 'facts', 'tiered']);
    });
  });

  describe('grepMaterials', () => {
    it('should return empty array (placeholder)', async () => {
      const query = {
        scope: { userId: 'user-1' },
        pattern: 'test pattern'
      };

      const result = await grepMaterials(query);

      expect(result).toEqual([]);
    });

    it('should return empty array with full scope', async () => {
      const query = {
        scope: {
          userId: 'user-1',
          agentId: 'agent-1',
          teamId: 'team-1'
        },
        pattern: 'search term'
      };

      const result = await grepMaterials(query);

      expect(result).toEqual([]);
    });

    it('should return empty array for empty pattern', async () => {
      const query = {
        scope: { userId: 'user-1' },
        pattern: ''
      };

      const result = await grepMaterials(query);

      expect(result).toEqual([]);
    });
  });

  describe('readMaterial', () => {
    it('should return null for invalid URI', async () => {
      mockResolveURI.mockReturnValue(null);

      const result = await readMaterial('invalid-uri');

      expect(result).toBeNull();
      expect(mockResolveURI).toHaveBeenCalledWith('invalid-uri');
    });

    it('should return null for malformed URI', async () => {
      mockResolveURI.mockReturnValue(null);

      const result = await readMaterial('not-a-mem-uri');

      expect(result).toBeNull();
    });

    it('should return content for valid document URI', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'documents',
        id: 'doc-1'
      });
      mockGetDocumentById.mockReturnValue({
        id: 'doc-1',
        user_id: 'user-1',
        is_global: false,
        doc_type: 'note',
        title: 'Test Document',
        content: 'This is the document content',
        created_at: 1000,
        updated_at: 1000,
        content_length: 27
      });

      const result = await readMaterial('mem://user-1/_/_/documents/doc-1');

      expect(result).toBe('This is the document content');
      expect(mockGetDocumentById).toHaveBeenCalledWith('doc-1');
    });

    it('should return null for missing document', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'documents',
        id: 'missing-doc'
      });
      mockGetDocumentById.mockReturnValue(undefined);

      const result = await readMaterial('mem://user-1/_/_/documents/missing-doc');

      expect(result).toBeNull();
    });

    it('should return content for valid asset URI', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'assets',
        id: 'asset-1'
      });
      mockGetAssetById.mockReturnValue({
        id: 'asset-1',
        user_id: 'user-1',
        is_global: false,
        filename: 'test.pdf',
        file_type: 'pdf',
        file_size: 1024,
        storage_path: '/path/to/asset',
        extracted_text: 'Extracted text from asset',
        text_extracted: true,
        created_at: 1000,
        updated_at: 1000
      });

      const result = await readMaterial('mem://user-1/_/_/assets/asset-1');

      expect(result).toBe('Extracted text from asset');
      expect(mockGetAssetById).toHaveBeenCalledWith('asset-1');
    });

    it('should return null for asset without extracted text', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'assets',
        id: 'asset-2'
      });
      mockGetAssetById.mockReturnValue({
        id: 'asset-2',
        user_id: 'user-1',
        is_global: false,
        filename: 'image.png',
        file_type: 'png',
        file_size: 512,
        storage_path: '/path/to/image',
        text_extracted: false,
        created_at: 1000,
        updated_at: 1000
      });

      const result = await readMaterial('mem://user-1/_/_/assets/asset-2');

      expect(result).toBeNull();
    });

    it('should return null for missing asset', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'assets',
        id: 'missing-asset'
      });
      mockGetAssetById.mockReturnValue(undefined);

      const result = await readMaterial('mem://user-1/_/_/assets/missing-asset');

      expect(result).toBeNull();
    });

    it('should return null for unknown type', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'unknown',
        id: 'item-1'
      });

      const result = await readMaterial('mem://user-1/_/_/unknown/item-1');

      expect(result).toBeNull();
      expect(mockGetDocumentById).not.toHaveBeenCalled();
      expect(mockGetAssetById).not.toHaveBeenCalled();
    });

    it('should return null for facts type', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'facts',
        id: 'fact-1'
      });

      const result = await readMaterial('mem://user-1/_/_/facts/fact-1');

      expect(result).toBeNull();
    });

    it('should return null for tiered type', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'tiered',
        id: 'tiered-1'
      });

      const result = await readMaterial('mem://user-1/_/_/tiered/tiered-1');

      expect(result).toBeNull();
    });

    it('should return null for messages type', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'messages',
        id: 'msg-1'
      });

      const result = await readMaterial('mem://user-1/_/_/messages/msg-1');

      expect(result).toBeNull();
    });

    it('should return null for conversations type', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'conversations',
        id: 'conv-1'
      });

      const result = await readMaterial('mem://user-1/_/_/conversations/conv-1');

      expect(result).toBeNull();
    });

    it('should handle empty document content', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'documents',
        id: 'doc-empty'
      });
      mockGetDocumentById.mockReturnValue({
        id: 'doc-empty',
        user_id: 'user-1',
        is_global: false,
        doc_type: 'note',
        title: 'Empty Doc',
        content: '',
        created_at: 1000,
        updated_at: 1000,
        content_length: 0
      });

      const result = await readMaterial('mem://user-1/_/_/documents/doc-empty');

      expect(result).toBe('');
    });

    it('should not call document getter when URI resolves to asset', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'assets',
        id: 'asset-1'
      });
      mockGetAssetById.mockReturnValue({
        id: 'asset-1',
        user_id: 'user-1',
        is_global: false,
        filename: 'test.pdf',
        file_type: 'pdf',
        file_size: 1024,
        storage_path: '/path',
        text_extracted: true,
        created_at: 1000,
        updated_at: 1000
      });

      await readMaterial('mem://user-1/_/_/assets/asset-1');

      expect(mockGetDocumentById).not.toHaveBeenCalled();
    });

    it('should not call asset getter when URI resolves to document', async () => {
      mockResolveURI.mockReturnValue({
        userId: 'user-1',
        type: 'documents',
        id: 'doc-1'
      });
      mockGetDocumentById.mockReturnValue({
        id: 'doc-1',
        user_id: 'user-1',
        is_global: false,
        doc_type: 'note',
        title: 'Doc',
        content: 'content',
        created_at: 1000,
        updated_at: 1000,
        content_length: 7
      });

      await readMaterial('mem://user-1/_/_/documents/doc-1');

      expect(mockGetAssetById).not.toHaveBeenCalled();
    });
  });
});