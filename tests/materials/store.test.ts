/**
 * @file tests/materials/store.test.ts
 * @description Material store operations tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storeDocument, storeAsset } from '../../src/materials/store';

// Mock dependencies
vi.mock('../../src/sqlite/documents', () => ({
  createDocument: vi.fn((input) => ({
    id: input.id,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    doc_type: input.doc_type,
    title: input.title,
    content: input.content,
    metadata: input.metadata,
    content_length: input.content?.length || 0,
    created_at: Date.now(),
    updated_at: Date.now()
  })),
  getDocumentById: vi.fn()
}));

vi.mock('../../src/sqlite/assets', () => ({
  createAsset: vi.fn((input) => ({
    id: input.id,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    filename: input.filename,
    file_type: input.file_type,
    file_size: input.file_size,
    storage_path: input.storage_path,
    created_at: Date.now(),
    updated_at: Date.now()
  })),
  getAssetById: vi.fn()
}));

vi.mock('../../src/sqlite/memory_index', () => ({
  createMemoryIndex: vi.fn((input) => ({
    uri: input.uri,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    target_type: input.target_type,
    target_id: input.target_id,
    title: input.title,
    created_at: Date.now()
  }))
}));

vi.mock('../../src/materials/uri_resolver', () => ({
  buildMaterialURI: vi.fn((config) => 
    `mem://${config.userId}/${config.agentId || '_'}/${config.teamId || '_'}/${config.type}/${config.id}`
  )
}));

vi.mock('../../src/utils/uuid', () => ({
  generateUUID: vi.fn(() => 'mock-uuid-1234-5678-90ab')
}));

// Import mocked modules to access mock functions
import { createDocument } from '../../src/sqlite/documents';
import { createAsset } from '../../src/sqlite/assets';
import { createMemoryIndex } from '../../src/sqlite/memory_index';
import { buildMaterialURI } from '../../src/materials/uri_resolver';
import { generateUUID } from '../../src/utils/uuid';

describe('Material Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
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

      // Verify createDocument was called
      expect(createDocument).toHaveBeenCalledTimes(1);
      expect(createDocument).toHaveBeenCalledWith({
        id: 'mock-uuid-1234-5678-90ab',
        user_id: 'user-1',
        agent_id: undefined,
        team_id: undefined,
        doc_type: 'article',
        title: 'Test Document',
        content: 'This is test content',
        metadata: undefined
      });

      // Verify createMemoryIndex was called
      expect(createMemoryIndex).toHaveBeenCalledTimes(1);
      expect(createMemoryIndex).toHaveBeenCalledWith({
        uri: 'mem://user-1/_/_/documents/mock-uuid-1234-5678-90ab',
        user_id: 'user-1',
        agent_id: undefined,
        team_id: undefined,
        target_type: 'documents',
        target_id: 'mock-uuid-1234-5678-90ab',
        title: 'Test Document'
      });
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
      expect(result.id).toBe('mock-uuid-1234-5678-90ab');
      expect(result.uri).toBe('mem://user-1/_/_/documents/mock-uuid-1234-5678-90ab');
    });

    it('should generate UUID for document', async () => {
      const input = {
        userId: 'user-1',
        docType: 'article',
        title: 'Test',
        content: 'Content'
      };

      await storeDocument(input);

      expect(generateUUID).toHaveBeenCalledTimes(1);
    });

    it('should build URI with correct parameters', async () => {
      const input = {
        userId: 'user-1',
        docType: 'article',
        title: 'Test',
        content: 'Content'
      };

      await storeDocument(input);

      expect(buildMaterialURI).toHaveBeenCalledTimes(1);
      expect(buildMaterialURI).toHaveBeenCalledWith({
        userId: 'user-1',
        agentId: undefined,
        teamId: undefined,
        type: 'documents',
        id: 'mock-uuid-1234-5678-90ab'
      });
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

      expect(createDocument).toHaveBeenCalledWith({
        id: 'mock-uuid-1234-5678-90ab',
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: undefined,
        doc_type: 'article',
        title: 'Agent Document',
        content: 'Content for agent',
        metadata: undefined
      });

      expect(result.uri).toBe('mem://user-1/agent-1/_/documents/mock-uuid-1234-5678-90ab');
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

      expect(createDocument).toHaveBeenCalledWith({
        id: 'mock-uuid-1234-5678-90ab',
        user_id: 'user-1',
        agent_id: undefined,
        team_id: 'team-1',
        doc_type: 'article',
        title: 'Team Document',
        content: 'Content for team',
        metadata: undefined
      });

      expect(result.uri).toBe('mem://user-1/_/team-1/documents/mock-uuid-1234-5678-90ab');
    });

    it('should handle document with metadata', async () => {
      const input = {
        userId: 'user-1',
        docType: 'article',
        title: 'Document with Metadata',
        content: 'Content',
        metadata: { author: 'test', version: 1 }
      };

      await storeDocument(input);

      expect(createDocument).toHaveBeenCalledWith({
        id: 'mock-uuid-1234-5678-90ab',
        user_id: 'user-1',
        agent_id: undefined,
        team_id: undefined,
        doc_type: 'article',
        title: 'Document with Metadata',
        content: 'Content',
        metadata: '{"author":"test","version":1}'
      });
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

      expect(result.uri).toBe('mem://user-1/agent-1/team-1/documents/mock-uuid-1234-5678-90ab');
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

      // Verify createAsset was called
      expect(createAsset).toHaveBeenCalledTimes(1);
      expect(createAsset).toHaveBeenCalledWith({
        id: 'mock-uuid-1234-5678-90ab',
        user_id: 'user-1',
        agent_id: undefined,
        team_id: undefined,
        filename: 'test.pdf',
        file_type: 'pdf',
        file_size: 1024,
        storage_path: '/storage/test.pdf'
      });

      // Verify createMemoryIndex was called
      expect(createMemoryIndex).toHaveBeenCalledTimes(1);
      expect(createMemoryIndex).toHaveBeenCalledWith({
        uri: 'mem://user-1/_/_/assets/mock-uuid-1234-5678-90ab',
        user_id: 'user-1',
        agent_id: undefined,
        team_id: undefined,
        target_type: 'assets',
        target_id: 'mock-uuid-1234-5678-90ab',
        title: 'test.pdf'
      });
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
      expect(result.id).toBe('mock-uuid-1234-5678-90ab');
      expect(result.uri).toBe('mem://user-1/_/_/assets/mock-uuid-1234-5678-90ab');
    });

    it('should generate UUID for asset', async () => {
      const input = {
        userId: 'user-1',
        filename: 'test.png',
        fileType: 'png',
        fileSize: 2048,
        storagePath: '/storage/test.png'
      };

      await storeAsset(input);

      expect(generateUUID).toHaveBeenCalledTimes(1);
    });

    it('should build URI with correct parameters for asset', async () => {
      const input = {
        userId: 'user-1',
        filename: 'test.jpg',
        fileType: 'jpg',
        fileSize: 4096,
        storagePath: '/storage/test.jpg'
      };

      await storeAsset(input);

      expect(buildMaterialURI).toHaveBeenCalledTimes(1);
      expect(buildMaterialURI).toHaveBeenCalledWith({
        userId: 'user-1',
        agentId: undefined,
        teamId: undefined,
        type: 'assets',
        id: 'mock-uuid-1234-5678-90ab'
      });
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

      expect(createAsset).toHaveBeenCalledWith({
        id: 'mock-uuid-1234-5678-90ab',
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: undefined,
        filename: 'agent-asset.pdf',
        file_type: 'pdf',
        file_size: 1024,
        storage_path: '/storage/agent-asset.pdf'
      });

      expect(result.uri).toBe('mem://user-1/agent-1/_/assets/mock-uuid-1234-5678-90ab');
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

      expect(createAsset).toHaveBeenCalledWith({
        id: 'mock-uuid-1234-5678-90ab',
        user_id: 'user-1',
        agent_id: undefined,
        team_id: 'team-1',
        filename: 'team-asset.png',
        file_type: 'png',
        file_size: 2048,
        storage_path: '/storage/team-asset.png'
      });

      expect(result.uri).toBe('mem://user-1/_/team-1/assets/mock-uuid-1234-5678-90ab');
    });

    it('should use filename as title in memory index', async () => {
      const input = {
        userId: 'user-1',
        filename: 'report.docx',
        fileType: 'docx',
        fileSize: 5000,
        storagePath: '/storage/report.docx'
      };

      await storeAsset(input);

      expect(createMemoryIndex).toHaveBeenCalledWith({
        uri: expect.any(String),
        user_id: 'user-1',
        agent_id: undefined,
        team_id: undefined,
        target_type: 'assets',
        target_id: 'mock-uuid-1234-5678-90ab',
        title: 'report.docx'
      });
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

      expect(result.uri).toBe('mem://user-1/agent-1/team-1/assets/mock-uuid-1234-5678-90ab');
    });
  });

  });