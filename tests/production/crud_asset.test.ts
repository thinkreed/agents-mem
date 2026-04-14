/**
 * @file tests/production/crud_asset.test.ts
 * @description Production-grade test for asset resource CRUD
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { handleMemCreate, handleMemRead, handleMemUpdate, handleMemDelete } from '../../src/tools/crud_handlers';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { resetConnection } from '../../src/sqlite/connection';

const TEST_TIMEOUT = 30000;

describe('Asset Resource - Full CRUD + Validation', () => {
  const testUserId = 'test-user-asset-crud';
  const testAgentId = 'test-agent-asset';
  const createdIds: string[] = [];

  beforeAll(async () => {
    resetConnection();
    resetManager();
    runMigrations();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    for (const id of createdIds) {
      try { await handleMemDelete({ resource: 'asset', id, scope: { userId: testUserId } }); } catch { /* ignore */ }
    }
  }, TEST_TIMEOUT);

  // ============================================================
  // CREATE - Validation
  // ============================================================
  describe('CREATE - Validation', () => {
    it('should reject missing userId', async () => {
      const result = await handleMemCreate({
        resource: 'asset',
        data: { filename: 'test.txt', fileType: 'text', fileSize: 100, storagePath: '/path' },
        scope: {}
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('userId is required');
    });

    it('should reject missing filename', async () => {
      const result = await handleMemCreate({
        resource: 'asset',
        data: { fileType: 'text', fileSize: 100, storagePath: '/path' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('filename is required');
    });

    it('should reject missing fileType', async () => {
      const result = await handleMemCreate({
        resource: 'asset',
        data: { filename: 'test.txt', fileSize: 100, storagePath: '/path' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('fileType is required');
    });

    it('should reject missing fileSize', async () => {
      const result = await handleMemCreate({
        resource: 'asset',
        data: { filename: 'test.txt', fileType: 'text', storagePath: '/path' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('fileSize is required');
    });

    it('should reject missing storagePath', async () => {
      const result = await handleMemCreate({
        resource: 'asset',
        data: { filename: 'test.txt', fileType: 'text', fileSize: 100 },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('storagePath is required');
    });
  });

  // ============================================================
  // CREATE - Success
  // ============================================================
  describe('CREATE - Success', () => {
    it('should create asset with all required fields', async () => {
      const result = await handleMemCreate({
        resource: 'asset',
        data: { filename: 'test.pdf', fileType: 'pdf', fileSize: 1024, storagePath: '/assets/test.pdf' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.uri).toContain('mem://');
      createdIds.push(parsed.id);
    });

    it('should create asset with agent scope', async () => {
      const result = await handleMemCreate({
        resource: 'asset',
        data: { filename: 'agent-asset.png', fileType: 'image', fileSize: 2048, storagePath: '/assets/agent.png' },
        scope: { userId: testUserId, agentId: testAgentId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdIds.push(parsed.id);
    });

    it('should create asset with large file size', async () => {
      const result = await handleMemCreate({
        resource: 'asset',
        data: { filename: 'large.zip', fileType: 'archive', fileSize: 1073741824, storagePath: '/assets/large.zip' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdIds.push(parsed.id);
    });

    it('should create asset with different file types', async () => {
      const fileTypes = ['pdf', 'image', 'video', 'audio', 'archive', 'document'];
      for (const ft of fileTypes) {
        const result = await handleMemCreate({
          resource: 'asset',
          data: { filename: `test.${ft}`, fileType: ft, fileSize: 100, storagePath: `/assets/test.${ft}` },
          scope: { userId: testUserId }
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.id).toBeDefined();
        createdIds.push(parsed.id);
      }
    });
  });

  // ============================================================
  // READ - By ID
  // ============================================================
  describe('READ - By ID', () => {
    it('should read asset by ID', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'asset',
        query: { id: createdIds[0] },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(createdIds[0]);
      expect(parsed.filename).toBeDefined();
      expect(parsed.file_type).toBeDefined();
    });

    it('should return error for non-existent asset ID', async () => {
      const result = await handleMemRead({
        resource: 'asset',
        query: { id: 'non-existent-asset' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Asset not found');
    });
  });

  // ============================================================
  // READ - List
  // ============================================================
  describe('READ - List', () => {
    it('should list assets for user', async () => {
      const result = await handleMemRead({
        resource: 'asset',
        query: { list: true },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty list for non-existent user', async () => {
      const result = await handleMemRead({
        resource: 'asset',
        query: { list: true },
        scope: { userId: 'non-existent-asset-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(0);
    });
  });

  // ============================================================
  // READ - Invalid Query
  // ============================================================
  describe('READ - Invalid Query', () => {
    it('should reject missing query', async () => {
      const result = await handleMemRead({
        resource: 'asset',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('query is required');
    });

    it('should reject invalid query keys', async () => {
      const result = await handleMemRead({
        resource: 'asset',
        query: { search: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for asset');
    });
  });

  // ============================================================
  // UPDATE
  // ============================================================
  describe('UPDATE', () => {
    it('should reject update non-existent asset', async () => {
      const result = await handleMemUpdate({
        resource: 'asset',
        id: 'non-existent-asset',
        data: { filename: 'updated.txt' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Asset not found');
    });

    it('should reject scope mismatch update', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'asset',
        id: createdIds[0],
        data: { filename: 'updated.txt' },
        scope: { userId: 'different-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Scope mismatch');
    });

    it('should reject missing id', async () => {
      const result = await handleMemUpdate({
        resource: 'asset',
        data: { filename: 'updated.txt' },
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });

    it('should reject empty data', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'asset',
        id: createdIds[0],
        data: {},
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('data is required');
    });
  });

  // ============================================================
  // DELETE
  // ============================================================
  describe('DELETE', () => {
    it('should delete existing asset', async () => {
      if (createdIds.length === 0) return;
      const assetId = createdIds.pop()!;
      const result = await handleMemDelete({
        resource: 'asset',
        id: assetId,
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should return success:false for non-existent asset (idempotent)', async () => {
      const result = await handleMemDelete({
        resource: 'asset',
        id: 'non-existent-asset-delete',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Asset not found');
    });

    it('should reject scope mismatch delete', async () => {
      if (createdIds.length === 0) return;
      const assetId = createdIds[0];
      const result = await handleMemDelete({
        resource: 'asset',
        id: assetId,
        scope: { userId: 'different-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Scope mismatch');
    });

    it('should reject missing id', async () => {
      const result = await handleMemDelete({
        resource: 'asset',
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });
  });
});
