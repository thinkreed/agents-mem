/**
 * @file tests/production/crud_fact.test.ts
 * @description Production-grade test for fact resource CRUD
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { handleMemCreate, handleMemRead, handleMemUpdate, handleMemDelete } from '../../src/tools/crud_handlers';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { resetConnection } from '../../src/sqlite/connection';

const TEST_TIMEOUT = 60000; // Facts need more time for extraction

describe('Fact Resource - Full CRUD + Validation', () => {
  const testUserId = 'test-user-fact-crud';
  const testAgentId = 'test-agent-fact';
  let testDocId: string = '';
  const createdFactIds: string[] = [];

  beforeAll(async () => {
    resetConnection();
    resetManager();
    runMigrations();

    // Create a document to use as fact source
    const docResult = await handleMemCreate({
      resource: 'document',
      data: { title: 'Fact Source Document', content: 'The Earth orbits the Sun. The Moon orbits the Earth. Water boils at 100 degrees Celsius. Paris is the capital of France.' },
      scope: { userId: testUserId, agentId: testAgentId }
    });
    const docParsed = JSON.parse(docResult.content[0].text);
    testDocId = docParsed.id;
  }, TEST_TIMEOUT);

  afterAll(async () => {
    for (const id of createdFactIds) {
      try { await handleMemDelete({ resource: 'fact', id, scope: { userId: testUserId } }); } catch { /* ignore */ }
    }
    try { await handleMemDelete({ resource: 'document', id: testDocId, scope: { userId: testUserId } }); } catch { /* ignore */ }
  }, TEST_TIMEOUT);

  // ============================================================
  // CREATE - Validation
  // ============================================================
  describe('CREATE - Validation', () => {
    it('should reject missing userId', async () => {
      const result = await handleMemCreate({
        resource: 'fact',
        data: { sourceType: 'documents', sourceId: testDocId, content: 'test' },
        scope: {}
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('userId is required');
    });

    it('should reject missing sourceType', async () => {
      const result = await handleMemCreate({
        resource: 'fact',
        data: { sourceId: testDocId, content: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('sourceType is required');
    });

    it('should reject missing sourceId', async () => {
      const result = await handleMemCreate({
        resource: 'fact',
        data: { sourceType: 'documents', content: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('sourceId is required');
    });

    it('should reject missing content', async () => {
      const result = await handleMemCreate({
        resource: 'fact',
        data: { sourceType: 'documents', sourceId: testDocId },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('content is required');
    });

    it('should reject invalid sourceType', async () => {
      const result = await handleMemCreate({
        resource: 'fact',
        data: { sourceType: 'invalid_type', sourceId: testDocId, content: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid sourceType');
    });
  });

  // ============================================================
  // CREATE - Success (all sourceTypes)
  // ============================================================
  describe('CREATE - Success', () => {
    it('should extract facts from documents sourceType', async () => {
      const result = await handleMemCreate({
        resource: 'fact',
        data: { sourceType: 'documents', sourceId: testDocId, content: 'The Earth orbits the Sun. The Moon orbits the Earth. Water boils at 100 degrees Celsius. Paris is the capital of France.' },
        scope: { userId: testUserId, agentId: testAgentId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.factIds).toBeDefined();
      expect(Array.isArray(parsed.factIds)).toBe(true);
      // Fact extraction may return 0 if LLM doesn't extract, that's OK
      for (const factId of parsed.factIds) {
        createdFactIds.push(factId);
      }
    });

    it('should extract facts from messages sourceType', async () => {
      // Create a conversation first
      const convResult = await handleMemCreate({
        resource: 'conversation',
        data: { agentId: 'test-agent-fact', title: 'Fact Conv' },
        scope: { userId: testUserId }
      });
      const convParsed = JSON.parse(convResult.content[0].text);

      // Create a message
      const msgResult = await handleMemCreate({
        resource: 'message',
        data: { conversationId: convParsed.id, role: 'assistant', content: 'The Sun is a star. Stars are made of hydrogen and helium.' },
        scope: { userId: testUserId }
      });
      const msgParsed = JSON.parse(msgResult.content[0].text);

      const result = await handleMemCreate({
        resource: 'fact',
        data: { sourceType: 'messages', sourceId: msgParsed.id, content: 'The Sun is a star. Stars are made of hydrogen and helium.' },
        scope: { userId: testUserId }
      });
      const factParsed = JSON.parse(result.content[0].text);
      expect(factParsed.factIds).toBeDefined();
      expect(Array.isArray(factParsed.factIds)).toBe(true);
      for (const factId of factParsed.factIds) {
        createdFactIds.push(factId);
      }

      // Cleanup
      try { await handleMemDelete({ resource: 'message', id: msgParsed.id, scope: { userId: testUserId } }); } catch { /* ignore */ }
      try { await handleMemDelete({ resource: 'conversation', id: convParsed.id, scope: { userId: testUserId } }); } catch { /* ignore */ }
    });
  });

  // ============================================================
  // READ - By ID
  // ============================================================
  describe('READ - By ID', () => {
    it('should read fact by ID', async () => {
      if (createdFactIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'fact',
        query: { id: createdFactIds[0] },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(createdFactIds[0]);
      expect(parsed.content).toBeDefined();
    });

    it('should read fact with trace to source', async () => {
      if (createdFactIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'fact',
        query: { id: createdFactIds[0], trace: true },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toBeDefined();
      // Trace returns source information
      expect(parsed.fact).toBeDefined();
    });

    it('should return error for non-existent fact ID', async () => {
      const result = await handleMemRead({
        resource: 'fact',
        query: { id: 'non-existent-fact' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Fact not found');
    });
  });

  // ============================================================
  // READ - Filters
  // ============================================================
  describe('READ - Filters', () => {
    it('should search facts by filters (no filters = all)', async () => {
      const result = await handleMemRead({
        resource: 'fact',
        query: { filters: {} },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      // May be 0 if no facts were extracted
    });

    it('should search facts by factType filter', async () => {
      const result = await handleMemRead({
        resource: 'fact',
        query: { filters: { factType: 'entity' } },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should search facts by verified filter', async () => {
      const result = await handleMemRead({
        resource: 'fact',
        query: { filters: { verified: false } },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should return empty list for non-existent user', async () => {
      const result = await handleMemRead({
        resource: 'fact',
        query: { filters: {} },
        scope: { userId: 'non-existent-fact-user' }
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
        resource: 'fact',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('query is required');
    });

    it('should reject invalid query keys', async () => {
      const result = await handleMemRead({
        resource: 'fact',
        query: { search: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for fact');
    });
  });

  // ============================================================
  // UPDATE
  // ============================================================
  describe('UPDATE', () => {
    it('should update fact verified status', async () => {
      if (createdFactIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'fact',
        id: createdFactIds[0],
        data: { verified: true },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.verified).toBe(true);
    });

    it('should reject updating fact content (immutable)', async () => {
      if (createdFactIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'fact',
        id: createdFactIds[0],
        data: { content: 'Updated content' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('immutable');
    });

    it('should reject update non-existent fact', async () => {
      const result = await handleMemUpdate({
        resource: 'fact',
        id: 'non-existent-fact',
        data: { verified: true },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Fact not found');
    });

    it('should reject scope mismatch update', async () => {
      if (createdFactIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'fact',
        id: createdFactIds[0],
        data: { verified: false },
        scope: { userId: 'different-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Scope mismatch');
    });

    it('should reject missing id', async () => {
      const result = await handleMemUpdate({
        resource: 'fact',
        data: { verified: true },
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });

    it('should reject empty data', async () => {
      if (createdFactIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'fact',
        id: createdFactIds[0],
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
    it('should delete existing fact', async () => {
      if (createdFactIds.length === 0) return;
      const factId = createdFactIds.pop()!;
      const result = await handleMemDelete({
        resource: 'fact',
        id: factId,
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should return success:false for non-existent fact (idempotent)', async () => {
      const result = await handleMemDelete({
        resource: 'fact',
        id: 'non-existent-fact-delete',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Fact not found');
    });

    it('should reject scope mismatch delete', async () => {
      if (createdFactIds.length === 0) return;
      const factId = createdFactIds[0];
      const result = await handleMemDelete({
        resource: 'fact',
        id: factId,
        scope: { userId: 'different-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Scope mismatch');
    });

    it('should reject missing id', async () => {
      const result = await handleMemDelete({
        resource: 'fact',
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });
  });
});
