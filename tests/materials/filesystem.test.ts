/**
 * @file tests/materials/filesystem.test.ts
 * @description File system operations for materials tests using real SQLite
 * 
 * NOTE: We use real SQLite database for readMaterial tests to avoid cross-file mock pollution.
 * listMaterials, getMaterialTree, grepMaterials are placeholders returning empty results.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  listMaterials,
  getMaterialTree,
  grepMaterials,
  readMaterial
} from '../../src/materials/filesystem';
import { resetConnection, closeConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { createUser } from '../../src/sqlite/users';
import { createDocument, getDocumentById } from '../../src/sqlite/documents';
import { createAsset, getAssetById } from '../../src/sqlite/assets';
import { createMemoryIndex } from '../../src/sqlite/memory_index';

describe('Filesystem Materials', () => {

  // Placeholder function tests (no database needed)
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

  // readMaterial tests with real database
  describe('readMaterial', () => {
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

    it('should return null for invalid URI', async () => {
      const result = await readMaterial('invalid-uri');

      expect(result).toBeNull();
    });

    it('should return null for malformed URI', async () => {
      const result = await readMaterial('not-a-mem-uri');

      expect(result).toBeNull();
    });

    it('should return content for valid document URI', async () => {
      // Create a document
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Test Document',
        content: 'This is the document content'
      });

      const result = await readMaterial('mem://user-1/_/_/documents/doc-1');

      expect(result).toBe('This is the document content');
    });

    it('should return null for missing document', async () => {
      const result = await readMaterial('mem://user-1/_/_/documents/missing-doc');

      expect(result).toBeNull();
    });

    it('should return content for valid asset URI', async () => {
      // Create an asset with extracted text
      createAsset({
        id: 'asset-1',
        user_id: 'user-1',
        filename: 'test.pdf',
        file_type: 'pdf',
        file_size: 1024,
        storage_path: '/path/to/asset',
        extracted_text: 'Extracted text from asset',
        text_extracted: true
      });

      const result = await readMaterial('mem://user-1/_/_/assets/asset-1');

      expect(result).toBe('Extracted text from asset');
    });

    it('should return null for asset without extracted text', async () => {
      // Create an asset without extracted text
      createAsset({
        id: 'asset-2',
        user_id: 'user-1',
        filename: 'image.png',
        file_type: 'png',
        file_size: 512,
        storage_path: '/path/to/image',
        text_extracted: false
      });

      const result = await readMaterial('mem://user-1/_/_/assets/asset-2');

      expect(result).toBeNull();
    });

    it('should return null for missing asset', async () => {
      const result = await readMaterial('mem://user-1/_/_/assets/missing-asset');

      expect(result).toBeNull();
    });

    it('should return null for unknown type', async () => {
      const result = await readMaterial('mem://user-1/_/_/unknown/item-1');

      expect(result).toBeNull();
    });

    it('should return null for facts type', async () => {
      const result = await readMaterial('mem://user-1/_/_/facts/fact-1');

      expect(result).toBeNull();
    });

    it('should return null for tiered type', async () => {
      const result = await readMaterial('mem://user-1/_/_/tiered/tiered-1');

      expect(result).toBeNull();
    });

    it('should return null for messages type', async () => {
      const result = await readMaterial('mem://user-1/_/_/messages/msg-1');

      expect(result).toBeNull();
    });

    it('should return null for conversations type', async () => {
      const result = await readMaterial('mem://user-1/_/_/conversations/conv-1');

      expect(result).toBeNull();
    });

    it('should handle empty document content', async () => {
      // Create a document with empty content
      createDocument({
        id: 'doc-empty',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Empty Doc',
        content: ''
      });

      const result = await readMaterial('mem://user-1/_/_/documents/doc-empty');

      expect(result).toBe('');
    });
  });
});