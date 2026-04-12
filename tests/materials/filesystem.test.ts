/**
 * @file tests/materials/filesystem.test.ts
 * @description File system operations for materials tests using real SQLite
 * 
 * * TDD Tests for listMaterials, getMaterialTree, grepMaterials implementations
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

  // TDD Tests for listMaterials (Task 2)
  describe('listMaterials', () => {
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

    it('should return materials from memory_index for user scope', async () => {
      // Setup: create document and memory index entry
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Test Document',
        content: 'Test content'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-1',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-1',
        title: 'Test Document'
      });

      const scope = { userId: 'user-1' };
      const result = await listMaterials(scope);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('doc-1');
      expect(result[0].uri).toBe('mem://user-1/_/_/documents/doc-1');
      expect(result[0].title).toBe('Test Document');
    });

    it('should return empty array when no materials exist for user', async () => {
      const scope = { userId: 'user-1' };
      const result = await listMaterials(scope);

      expect(result).toBeDefined();
      expect(result).toEqual([]);
    });

    it('should filter by type when provided', async () => {
      // Create both documents and assets
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Document',
        content: 'Content'
      });
      createAsset({
        id: 'asset-1',
        user_id: 'user-1',
        filename: 'file.pdf',
        file_type: 'pdf',
        file_size: 1024,
        storage_path: '/path'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-1',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-1',
        title: 'Document'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/assets/asset-1',
        user_id: 'user-1',
        target_type: 'assets',
        target_id: 'asset-1',
        title: 'file.pdf'
      });

      const scope = { userId: 'user-1', type: 'documents' };
      const result = await listMaterials(scope);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('doc-1');
      expect(result[0].title).toBe('Document');
    });

    it('should return all types when type filter not provided', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Doc',
        content: 'Content'
      });
      createAsset({
        id: 'asset-1',
        user_id: 'user-1',
        filename: 'file.pdf',
        file_type: 'pdf',
        file_size: 1024,
        storage_path: '/path'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-1',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-1',
        title: 'Doc'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/assets/asset-1',
        user_id: 'user-1',
        target_type: 'assets',
        target_id: 'asset-1',
        title: 'file.pdf'
      });

      const scope = { userId: 'user-1' };
      const result = await listMaterials(scope);

      expect(result.length).toBe(2);
    });

    it('should filter by agentId when provided', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        agent_id: 'agent-1',
        doc_type: 'note',
        title: 'Agent Doc',
        content: 'Content'
      });
      createMemoryIndex({
        uri: 'mem://user-1/agent-1/_/documents/doc-1',
        user_id: 'user-1',
        agent_id: 'agent-1',
        target_type: 'documents',
        target_id: 'doc-1',
        title: 'Agent Doc'
      });

      const scope = { userId: 'user-1', agentId: 'agent-1' };
      const result = await listMaterials(scope);

      expect(result.length).toBe(1);
      expect(result[0].uri).toBe('mem://user-1/agent-1/_/documents/doc-1');
    });

    it('should filter by teamId when provided', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        team_id: 'team-1',
        doc_type: 'note',
        title: 'Team Doc',
        content: 'Content'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/team-1/documents/doc-1',
        user_id: 'user-1',
        team_id: 'team-1',
        target_type: 'documents',
        target_id: 'doc-1',
        title: 'Team Doc'
      });

      const scope = { userId: 'user-1', teamId: 'team-1' };
      const result = await listMaterials(scope);

      expect(result.length).toBe(1);
    });

    it('should return multiple materials', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Doc 1',
        content: 'Content 1'
      });
      createDocument({
        id: 'doc-2',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'Doc 2',
        content: 'Content 2'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-1',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-1',
        title: 'Doc 1'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-2',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-2',
        title: 'Doc 2'
      });

      const scope = { userId: 'user-1' };
      const result = await listMaterials(scope);

      expect(result.length).toBe(2);
    });
  });

  // TDD Tests for getMaterialTree (Task 2)
  describe('getMaterialTree', () => {
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

    it('should group materials by target_type', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Doc',
        content: 'Content'
      });
      createAsset({
        id: 'asset-1',
        user_id: 'user-1',
        filename: 'file.pdf',
        file_type: 'pdf',
        file_size: 1024,
        storage_path: '/path'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-1',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-1',
        title: 'Doc'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/assets/asset-1',
        user_id: 'user-1',
        target_type: 'assets',
        target_id: 'asset-1',
        title: 'file.pdf'
      });

      const scope = { userId: 'user-1' };
      const result = await getMaterialTree(scope);

      expect(result.documents.length).toBe(1);
      expect(result.documents[0]).toBe('mem://user-1/_/_/documents/doc-1');
      expect(result.assets.length).toBe(1);
      expect(result.assets[0]).toBe('mem://user-1/_/_/assets/asset-1');
      expect(result.facts.length).toBe(0);
      expect(result.tiered.length).toBe(0);
    });

    it('should return empty arrays when no materials exist', async () => {
      const scope = { userId: 'user-1' };
      const result = await getMaterialTree(scope);

      expect(result.documents).toEqual([]);
      expect(result.assets).toEqual([]);
      expect(result.facts).toEqual([]);
      expect(result.tiered).toEqual([]);
    });

    it('should include all expected keys in result', async () => {
      const scope = { userId: 'user-1' };
      const result = await getMaterialTree(scope);

      expect(result).toHaveProperty('documents');
      expect(result).toHaveProperty('assets');
      expect(result).toHaveProperty('facts');
      expect(result).toHaveProperty('tiered');
    });

    it('should handle multiple documents in tree', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Doc 1',
        content: 'Content 1'
      });
      createDocument({
        id: 'doc-2',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Doc 2',
        content: 'Content 2'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-1',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-1',
        title: 'Doc 1'
      });
      createMemoryIndex({
        uri: 'mem://user-1/_/_/documents/doc-2',
        user_id: 'user-1',
        target_type: 'documents',
        target_id: 'doc-2',
        title: 'Doc 2'
      });

      const scope = { userId: 'user-1' };
      const result = await getMaterialTree(scope);

      expect(result.documents.length).toBe(2);
    });
  });

  // TDD Tests for grepMaterials (Task 2)
  describe('grepMaterials', () => {
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

    it('should return matching materials for pattern', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Test Document',
        content: 'This is test content'
      });

      const query = {
        scope: { userId: 'user-1' },
        pattern: 'Test'
      };
      const result = await grepMaterials(query);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].uri).toContain('doc-1');
      expect(result[0].matches.length).toBeGreaterThan(0);
    });

    it('should return empty array for empty pattern', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Document',
        content: 'Content'
      });

      const query = {
        scope: { userId: 'user-1' },
        pattern: ''
      };
      const result = await grepMaterials(query);

      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace pattern', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Document',
        content: 'Content'
      });

      const query = {
        scope: { userId: 'user-1' },
        pattern: '   '
      };
      const result = await grepMaterials(query);

      expect(result).toEqual([]);
    });

    it('should return empty array when no matches found', async () => {
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Other Title',
        content: 'Other content'
      });

      const query = {
        scope: { userId: 'user-1' },
        pattern: 'NonExistentPattern'
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