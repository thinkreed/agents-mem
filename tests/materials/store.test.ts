/**
 * @file tests/materials/store.test.ts
 * @description Material store operations tests using real SQLite
 * 
 * NOTE: We use real SQLite database instead of mocks to avoid cross-file mock pollution.
 * Each test uses isolated :memory: database with proper setup/teardown.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storeDocument, storeAsset } from '../../src/materials/store';
import { resetConnection, closeConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { createUser } from '../../src/sqlite/users';
import { getDocumentById } from '../../src/sqlite/documents';
import { getAssetById } from '../../src/sqlite/assets';
import { getMemoryIndexByURI } from '../../src/sqlite/memory_index';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Material Store', () => {
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

  describe('storeDocument', () => {
    it('should create document and memory index', async () => {
      const input = {
        userId: 'user-1',
        docType: 'article',
        title: 'Test Document',
        content: 'This is test content'
      };

      const result = await storeDocument(input);

      // Verify result has valid UUID
      expect(result).toBeDefined();
      expect(result.id).toMatch(UUID_REGEX);
      
      // Verify document was created in database
      const doc = getDocumentById(result.id);
      expect(doc).toBeDefined();
      expect(doc?.user_id).toBe('user-1');
      expect(doc?.doc_type).toBe('article');
      expect(doc?.title).toBe('Test Document');

      // Verify memory index was created
      const index = getMemoryIndexByURI(result.uri);
      expect(index).toBeDefined();
      expect(index?.user_id).toBe('user-1');
      expect(index?.target_type).toBe('documents');
      expect(index?.target_id).toBe(result.id);
    });

    it('should return id and uri', async () => {
      const input = {
        userId: 'user-1',
        docType: 'note',
        title: 'Test Note',
        content: 'Note content'
      };

      const result = await storeDocument(input);

      expect(result).toBeDefined();
      expect(result.id).toMatch(UUID_REGEX);
      expect(result.uri).toMatch(/^mem:\/\/user-1\/_\/_\/documents\/[0-9a-f-]+$/);
    });

    it('should handle document with agent scope', async () => {
      const input = {
        userId: 'user-1',
        agentId: 'agent-1',
        docType: 'article',
        title: 'Agent Document',
        content: 'Content for agent'
      };

      const result = await storeDocument(input);

      // Verify document has agent_id
      const doc = getDocumentById(result.id);
      expect(doc?.agent_id).toBe('agent-1');
      
      // Verify URI contains agent
      expect(result.uri).toMatch(/^mem:\/\/user-1\/agent-1\/_\/documents\/[0-9a-f-]+$/);
    });

    it('should handle document with team scope', async () => {
      const input = {
        userId: 'user-1',
        teamId: 'team-1',
        docType: 'article',
        title: 'Team Document',
        content: 'Content for team'
      };

      const result = await storeDocument(input);

      // Verify document has team_id
      const doc = getDocumentById(result.id);
      expect(doc?.team_id).toBe('team-1');
      
      // Verify URI contains team
      expect(result.uri).toMatch(/^mem:\/\/user-1\/_\/team-1\/documents\/[0-9a-f-]+$/);
    });

    it('should handle document with metadata', async () => {
      const input = {
        userId: 'user-1',
        docType: 'article',
        title: 'Document with Metadata',
        content: 'Content',
        metadata: { author: 'test', version: 1 }
      };

      const result = await storeDocument(input);

      // Verify document has metadata
      const doc = getDocumentById(result.id);
      expect(doc?.metadata).toBe('{"author":"test","version":1}');
    });

    it('should handle document with both agent and team scope', async () => {
      const input = {
        userId: 'user-1',
        agentId: 'agent-1',
        teamId: 'team-1',
        docType: 'article',
        title: 'Scoped Document',
        content: 'Content'
      };

      const result = await storeDocument(input);

      expect(result.uri).toMatch(/^mem:\/\/user-1\/agent-1\/team-1\/documents\/[0-9a-f-]+$/);
    });
  });

  describe('storeAsset', () => {
    it('should create asset and memory index', async () => {
      const input = {
        userId: 'user-1',
        filename: 'test.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        storagePath: '/storage/test.pdf'
      };

      const result = await storeAsset(input);

      // Verify result has valid UUID
      expect(result).toBeDefined();
      expect(result.id).toMatch(UUID_REGEX);
      
      // Verify asset was created in database
      const asset = getAssetById(result.id);
      expect(asset).toBeDefined();
      expect(asset?.user_id).toBe('user-1');
      expect(asset?.filename).toBe('test.pdf');
      expect(asset?.file_type).toBe('pdf');

      // Verify memory index was created
      const index = getMemoryIndexByURI(result.uri);
      expect(index).toBeDefined();
      expect(index?.target_type).toBe('assets');
      expect(index?.target_id).toBe(result.id);
    });

    it('should return id and uri', async () => {
      const input = {
        userId: 'user-1',
        filename: 'document.txt',
        fileType: 'txt',
        fileSize: 500,
        storagePath: '/storage/document.txt'
      };

      const result = await storeAsset(input);

      expect(result).toBeDefined();
      expect(result.id).toMatch(UUID_REGEX);
      expect(result.uri).toMatch(/^mem:\/\/user-1\/_\/_\/assets\/[0-9a-f-]+$/);
    });

    it('should handle asset with agent scope', async () => {
      const input = {
        userId: 'user-1',
        agentId: 'agent-1',
        filename: 'agent-asset.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        storagePath: '/storage/agent-asset.pdf'
      };

      const result = await storeAsset(input);

      // Verify asset has agent_id
      const asset = getAssetById(result.id);
      expect(asset?.agent_id).toBe('agent-1');
      
      // Verify URI contains agent
      expect(result.uri).toMatch(/^mem:\/\/user-1\/agent-1\/_\/assets\/[0-9a-f-]+$/);
    });

    it('should handle asset with team scope', async () => {
      const input = {
        userId: 'user-1',
        teamId: 'team-1',
        filename: 'team-asset.png',
        fileType: 'png',
        fileSize: 2048,
        storagePath: '/storage/team-asset.png'
      };

      const result = await storeAsset(input);

      // Verify asset has team_id
      const asset = getAssetById(result.id);
      expect(asset?.team_id).toBe('team-1');
      
      // Verify URI contains team
      expect(result.uri).toMatch(/^mem:\/\/user-1\/_\/team-1\/assets\/[0-9a-f-]+$/);
    });

    it('should use filename as title in memory index', async () => {
      const input = {
        userId: 'user-1',
        filename: 'report.docx',
        fileType: 'docx',
        fileSize: 5000,
        storagePath: '/storage/report.docx'
      };

      const result = await storeAsset(input);

      // Verify memory index has filename as title
      const index = getMemoryIndexByURI(result.uri);
      expect(index?.title).toBe('report.docx');
    });

    it('should handle asset with both agent and team scope', async () => {
      const input = {
        userId: 'user-1',
        agentId: 'agent-1',
        teamId: 'team-1',
        filename: 'scoped-asset.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        storagePath: '/storage/scoped-asset.pdf'
      };

      const result = await storeAsset(input);

      expect(result.uri).toMatch(/^mem:\/\/user-1\/agent-1\/team-1\/assets\/[0-9a-f-]+$/);
    });
  });
});