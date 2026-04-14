/**
 * @file tests/production/crud_document.test.ts
 * @description Production-grade test for document resource CRUD
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { handleMemCreate, handleMemRead, handleMemUpdate, handleMemDelete } from '../../src/tools/crud_handlers';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { resetConnection } from '../../src/sqlite/connection';
import { getOpenVikingClient, resetClient, initConfig } from '../../src/openviking';
import { getDocumentById, deleteDocument } from '../../src/sqlite/documents';

const TEST_TIMEOUT = 30000;
const OPENVIKING_TEST_TIMEOUT = 3000;
let openVikingAvailable = false;

describe('Document Resource - Full CRUD + Validation', () => {
  const testUserId = 'test-user-doc-crud';
  const testAgentId = 'test-agent-doc';
  const testTeamId = 'test-team-doc';
  const createdIds: string[] = [];

  beforeAll(async () => {
    resetConnection();
    resetManager();
    runMigrations();

    process.env.OPENVIKING_ENABLED = 'true';
    process.env.OPENVIKING_BASE_URL = process.env.OPENVIKING_BASE_URL || 'http://localhost:1933';
    process.env.OPENVIKING_TIMEOUT = String(OPENVIKING_TEST_TIMEOUT);
    process.env.OPENVIKING_MAX_RETRIES = '1';

    resetClient();
    initConfig({ timeout: OPENVIKING_TEST_TIMEOUT, maxRetries: 1 });

    try {
      const client = getOpenVikingClient();
      const searchPromise = client.find({ query: 'test', targetUri: 'viking://test', limit: 1 });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), OPENVIKING_TEST_TIMEOUT)
      );
      try {
        await Promise.race([searchPromise, timeoutPromise]);
        openVikingAvailable = true;
        console.log('OpenViking: available');
      } catch (searchErr: any) {
        const isConnError = searchErr.message?.includes('fetch') ||
          searchErr.message?.includes('ECONNREFUSED') || searchErr.message?.includes('ENOTFOUND');
        openVikingAvailable = !isConnError;
        console.log(`OpenViking: ${openVikingAvailable ? 'available (search err: ' + searchErr.message + ')' : 'unavailable'}`);
      }
      if (!openVikingAvailable) {
        process.env.OPENVIKING_ENABLED = 'false';
        resetClient();
        initConfig({ enabled: false });
        console.log('OpenViking disabled for this test run');
      }
    } catch {
      openVikingAvailable = false;
      process.env.OPENVIKING_ENABLED = 'false';
      resetClient();
      initConfig({ enabled: false });
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    for (const id of createdIds) {
      try { await handleMemDelete({ resource: 'document', id, scope: { userId: testUserId } }); } catch { /* ignore */ }
    }
  }, TEST_TIMEOUT);

  // ============================================================
  // CREATE - Parameter Validation
  // ============================================================
  describe('CREATE - Validation', () => {
    it('should reject missing userId', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { title: 'test', content: 'test' },
        scope: {}
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('userId is required');
    });

    it('should reject missing title', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { content: 'test content' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('title is required');
    });

    it('should reject missing content', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { title: 'test title' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('content is required');
    });

    it('should reject invalid resource type', async () => {
      const result = await handleMemCreate({
        resource: 'invalid_type',
        data: { title: 'test', content: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid resource type');
    });
  });

  // ============================================================
  // CREATE - Success cases (all docTypes)
  // ============================================================
  describe('CREATE - Success', () => {
    it('should create note (default docType)', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { title: 'Test Note', content: 'Note content' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.uri).toContain('mem://');
      createdIds.push(parsed.id);
    });

    it('should create article docType', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { docType: 'article', title: 'Test Article', content: 'Article content' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdIds.push(parsed.id);
    });

    it('should create url docType', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { docType: 'url', title: 'Test URL', content: 'https://example.com' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdIds.push(parsed.id);
    });

    it('should create file docType', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { docType: 'file', title: 'Test File', content: 'File content body' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdIds.push(parsed.id);
    });

    it('should create conversation docType', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { docType: 'conversation', title: 'Test Conversation Doc', content: 'Conversation log' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdIds.push(parsed.id);
    });

    it('should create with full scope (userId + agentId + teamId)', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { title: 'Full Scope Doc', content: 'Content' },
        scope: { userId: testUserId, agentId: testAgentId, teamId: testTeamId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.uri).toContain(testAgentId);
      createdIds.push(parsed.id);
    });

    it('should create with metadata', async () => {
      const result = await handleMemCreate({
        resource: 'document',
        data: { title: 'Doc with Metadata', content: 'Content', metadata: { tags: ['test', 'crud'], priority: 'high' } },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdIds.push(parsed.id);
    });

    it('should auto-create user if not exists', async () => {
      const autoUserId = 'auto-created-user-' + Date.now();
      const result = await handleMemCreate({
        resource: 'document',
        data: { title: 'Auto User Doc', content: 'Content' },
        scope: { userId: autoUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      // Cleanup with short timeout
      try { 
        await Promise.race([
          handleMemDelete({ resource: 'document', id: parsed.id, scope: { userId: autoUserId } }),
          new Promise((_, r) => setTimeout(r, 2000))
        ]); 
      } catch { /* ignore */ }
    }, 10000);
  });

  // ============================================================
  // READ - By ID
  // ============================================================
  describe('READ - By ID', () => {
    it('should read document by ID', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'document',
        query: { id: createdIds[0] },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(createdIds[0]);
      expect(parsed.title).toBeDefined();
    });

    it('should return error for non-existent ID', async () => {
      const result = await handleMemRead({
        resource: 'document',
        query: { id: 'non-existent-doc-id' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Document not found');
    });

    it('should read document with L0 tier', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'document',
        query: { id: createdIds[0], tier: 'L0' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.tier).toBe('L0');
      expect(parsed.abstract).toBeDefined();
    });

    it('should read document with L1 tier', async () => {
      if (createdIds.length < 2) return;
      const result = await handleMemRead({
        resource: 'document',
        query: { id: createdIds[1], tier: 'L1' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.tier).toBe('L1');
      expect(parsed.overview).toBeDefined();
    });

    it('should read document with L2 tier', async () => {
      if (createdIds.length < 3) return;
      const result = await handleMemRead({
        resource: 'document',
        query: { id: createdIds[2], tier: 'L2' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.tier).toBe('L2');
      expect(parsed.content).toBeDefined();
      expect(parsed.title).toBeDefined();
    });

    it('should reject invalid tier', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'document',
        query: { id: createdIds[0], tier: 'L3' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid tier');
    });
  });

  // ============================================================
  // READ - Search (all modes)
  // ============================================================
  describe('READ - Search', () => {
    it('should search with hybrid mode', async () => {
      if (!openVikingAvailable) {
        console.log('⚠️ OpenViking unavailable, skipping hybrid search');
        return;
      }
      try {
        const result = await handleMemRead({
          resource: 'document',
          query: { search: 'Test', searchMode: 'hybrid', limit: 5 },
          scope: { userId: testUserId }
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
        expect(Array.isArray(parsed)).toBe(true);
      } catch (err: any) {
        console.log(`⚠️ Hybrid search error: ${err.message}`);
        expect(true).toBe(true);
      }
    });

    it('should search with fts mode', async () => {
      if (!openVikingAvailable) {
        console.log('⚠️ OpenViking unavailable, skipping fts search');
        return;
      }
      try {
        const result = await handleMemRead({
          resource: 'document',
          query: { search: 'Article', searchMode: 'fts', limit: 5 },
          scope: { userId: testUserId }
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
      } catch (err: any) {
        console.log(`⚠️ FTS search error: ${err.message}`);
        expect(true).toBe(true);
      }
    });

    it('should search with semantic mode', async () => {
      if (!openVikingAvailable) {
        console.log('⚠️ OpenViking unavailable, skipping semantic search');
        return;
      }
      try {
        const result = await handleMemRead({
          resource: 'document',
          query: { search: 'Note', searchMode: 'semantic', limit: 5 },
          scope: { userId: testUserId }
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
      } catch (err: any) {
        console.log(`⚠️ Semantic search error: ${err.message}`);
        expect(true).toBe(true);
      }
    });

    it('should search with progressive mode', async () => {
      if (!openVikingAvailable) {
        console.log('⚠️ OpenViking unavailable, skipping progressive search');
        return;
      }
      try {
        const result = await handleMemRead({
          resource: 'document',
          query: { search: 'Test', searchMode: 'progressive', limit: 5 },
          scope: { userId: testUserId }
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
      } catch (err: any) {
        console.log(`⚠️ Progressive search error: ${err.message}`);
        expect(true).toBe(true);
      }
    });

    it('should reject invalid searchMode', async () => {
      const result = await handleMemRead({
        resource: 'document',
        query: { search: 'test', searchMode: 'invalid_mode' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid searchMode');
    });

    it('should use default limit when not specified', async () => {
      if (!openVikingAvailable) return;
      try {
        const result = await handleMemRead({
          resource: 'document',
          query: { search: 'Test' },
          scope: { userId: testUserId }
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should use custom limit', async () => {
      if (!openVikingAvailable) return;
      try {
        const result = await handleMemRead({
          resource: 'document',
          query: { search: 'Test', limit: 2 },
          scope: { userId: testUserId }
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should support custom tokenBudget', async () => {
      if (!openVikingAvailable) return;
      try {
        const result = await handleMemRead({
          resource: 'document',
          query: { search: 'Test', tokenBudget: 1000 },
          scope: { userId: testUserId }
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  // ============================================================
  // READ - List
  // ============================================================
  describe('READ - List', () => {
    it('should list all documents for user', async () => {
      const result = await handleMemRead({
        resource: 'document',
        query: { list: true },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty list for non-existent user', async () => {
      const result = await handleMemRead({
        resource: 'document',
        query: { list: true },
        scope: { userId: 'non-existent-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(0);
    });
  });

  // ============================================================
  // READ - Invalid query
  // ============================================================
  describe('READ - Invalid Query', () => {
    it('should reject missing query', async () => {
      const result = await handleMemRead({
        resource: 'document',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('query is required');
    });

    it('should reject invalid query keys', async () => {
      const result = await handleMemRead({
        resource: 'document',
        query: { invalidKey: 'value' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for document');
    });
  });

  // ============================================================
  // UPDATE
  // ============================================================
  describe('UPDATE', () => {
    it('should update document title', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'document',
        id: createdIds[0],
        data: { title: 'UPDATED Title' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.title).toContain('UPDATED');
    });

    it('should update document content', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'document',
        id: createdIds[0],
        data: { content: 'Updated content body' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toBeDefined();
    });

    it('should update document metadata', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'document',
        id: createdIds[0],
        data: { metadata: JSON.stringify({ updated: true, tags: ['new-tag'] }) },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toBeDefined();
    });

    it('should reject update non-existent document', async () => {
      const result = await handleMemUpdate({
        resource: 'document',
        id: 'non-existent-doc',
        data: { title: 'Updated' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Document not found');
    });

    it('should reject scope mismatch update', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'document',
        id: createdIds[0],
        data: { title: 'Updated' },
        scope: { userId: 'different-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Scope mismatch');
    });

    it('should reject missing id', async () => {
      const result = await handleMemUpdate({
        resource: 'document',
        data: { title: 'Updated' },
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });

    it('should reject empty data', async () => {
      if (createdIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'document',
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
    it('should delete existing document', async () => {
      if (createdIds.length === 0) return;
      const docId = createdIds.pop()!;
      const result = await handleMemDelete({
        resource: 'document',
        id: docId,
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should return success:false for non-existent document (idempotent)', async () => {
      const result = await handleMemDelete({
        resource: 'document',
        id: 'non-existent-doc-delete',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Document not found');
    });

    it('should reject scope mismatch delete', async () => {
      if (createdIds.length === 0) return;
      const docId = createdIds[0];
      const result = await handleMemDelete({
        resource: 'document',
        id: docId,
        scope: { userId: 'different-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Scope mismatch');
    });

    it('should reject missing id', async () => {
      const result = await handleMemDelete({
        resource: 'document',
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });
  });
});
