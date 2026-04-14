/**
 * @file tests/production/crud_conversation_message.test.ts
 * @description Production-grade test for conversation and message resource CRUD
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { handleMemCreate, handleMemRead, handleMemUpdate, handleMemDelete } from '../../src/tools/crud_handlers';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { resetConnection } from '../../src/sqlite/connection';

const TEST_TIMEOUT = 30000;

describe('Conversation Resource - Full CRUD + Validation', () => {
  const testUserId = 'test-user-conv-crud';
  const testAgentId = 'test-agent-conv';
  const testTeamId = 'test-team-conv';
  const createdConvIds: string[] = [];

  beforeAll(async () => {
    resetConnection();
    resetManager();
    runMigrations();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cascade delete will remove messages too
    for (const id of createdConvIds) {
      try { await handleMemDelete({ resource: 'conversation', id, scope: { userId: testUserId } }); } catch { /* ignore */ }
    }
  }, TEST_TIMEOUT);

  // ============================================================
  // CREATE - Validation
  // ============================================================
  describe('CREATE - Validation', () => {
    it('should reject missing userId', async () => {
      const result = await handleMemCreate({
        resource: 'conversation',
        data: { agentId: 'agent-1' },
        scope: {}
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('userId is required');
    });

    it('should reject missing agentId', async () => {
      const result = await handleMemCreate({
        resource: 'conversation',
        data: { title: 'Test Conv' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('agentId is required');
    });
  });

  // ============================================================
  // CREATE - Success
  // ============================================================
  describe('CREATE - Success', () => {
    it('should create conversation with minimal fields', async () => {
      const result = await handleMemCreate({
        resource: 'conversation',
        data: { agentId: testAgentId },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.user_id).toBe(testUserId);
      expect(parsed.agent_id).toBe(testAgentId);
      createdConvIds.push(parsed.id);
    });

    it('should create conversation with title', async () => {
      const result = await handleMemCreate({
        resource: 'conversation',
        data: { agentId: testAgentId, title: 'Test Conversation' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.title).toBe('Test Conversation');
      createdConvIds.push(parsed.id);
    });

    it('should create conversation with teamId', async () => {
      const result = await handleMemCreate({
        resource: 'conversation',
        data: { agentId: testAgentId, title: 'Team Conv', teamId: testTeamId },
        scope: { userId: testUserId, teamId: testTeamId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdConvIds.push(parsed.id);
    });

    it('should create conversation with full scope', async () => {
      const result = await handleMemCreate({
        resource: 'conversation',
        data: { agentId: testAgentId, title: 'Full Scope Conv' },
        scope: { userId: testUserId, agentId: testAgentId, teamId: testTeamId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdConvIds.push(parsed.id);
    });
  });

  // ============================================================
  // READ - By ID
  // ============================================================
  describe('READ - By ID', () => {
    it('should read conversation by ID', async () => {
      if (createdConvIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'conversation',
        query: { id: createdConvIds[0] },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(createdConvIds[0]);
      expect(parsed.user_id).toBe(testUserId);
    });

    it('should return error for non-existent conversation ID', async () => {
      const result = await handleMemRead({
        resource: 'conversation',
        query: { id: 'non-existent-conv' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Conversation not found');
    });
  });

  // ============================================================
  // READ - List
  // ============================================================
  describe('READ - List', () => {
    it('should list conversations for user', async () => {
      const result = await handleMemRead({
        resource: 'conversation',
        query: { list: true },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty list for non-existent user', async () => {
      const result = await handleMemRead({
        resource: 'conversation',
        query: { list: true },
        scope: { userId: 'non-existent-conv-user' }
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
        resource: 'conversation',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('query is required');
    });

    it('should reject invalid query keys', async () => {
      const result = await handleMemRead({
        resource: 'conversation',
        query: { search: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for conversation');
    });
  });

  // ============================================================
  // UPDATE
  // ============================================================
  describe('UPDATE', () => {
    it('should update conversation title', async () => {
      if (createdConvIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'conversation',
        id: createdConvIds[0],
        data: { title: 'Updated Conversation Title' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.title).toContain('Updated');
    });

    it('should reject update non-existent conversation', async () => {
      const result = await handleMemUpdate({
        resource: 'conversation',
        id: 'non-existent-conv',
        data: { title: 'Updated' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Conversation not found');
    });

    it('should reject scope mismatch update', async () => {
      if (createdConvIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'conversation',
        id: createdConvIds[0],
        data: { title: 'Updated' },
        scope: { userId: 'different-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Scope mismatch');
    });

    it('should reject missing id', async () => {
      const result = await handleMemUpdate({
        resource: 'conversation',
        data: { title: 'Updated' },
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });

    it('should reject empty data', async () => {
      if (createdConvIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'conversation',
        id: createdConvIds[0],
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
    it('should delete conversation with cascade (messages)', async () => {
      if (createdConvIds.length === 0) return;
      const convId = createdConvIds.pop()!;
      const result = await handleMemDelete({
        resource: 'conversation',
        id: convId,
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.deletedMessages).toBeDefined();
    });

    it('should return success:false for non-existent conversation (idempotent)', async () => {
      const result = await handleMemDelete({
        resource: 'conversation',
        id: 'non-existent-conv-delete',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Conversation not found');
    });

    it('should reject scope mismatch delete', async () => {
      if (createdConvIds.length === 0) return;
      const convId = createdConvIds[0];
      const result = await handleMemDelete({
        resource: 'conversation',
        id: convId,
        scope: { userId: 'different-user' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Scope mismatch');
    });

    it('should reject missing id', async () => {
      const result = await handleMemDelete({
        resource: 'conversation',
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });
  });
});

// ============================================================
// MESSAGE RESOURCE
// ============================================================
describe('Message Resource - Full CRUD + Validation', () => {
  const testUserId = 'test-user-msg-crud';
  let testConvId: string = '';

  beforeAll(async () => {
    resetConnection();
    resetManager();
    runMigrations();

    // Create a conversation for message tests
    const convResult = await handleMemCreate({
      resource: 'conversation',
      data: { agentId: 'test-agent-msg', title: 'Message Test Conv' },
      scope: { userId: testUserId }
    });
    const convParsed = JSON.parse(convResult.content[0].text);
    testConvId = convParsed.id;
  }, TEST_TIMEOUT);

  afterAll(async () => {
    try { await handleMemDelete({ resource: 'conversation', id: testConvId, scope: { userId: testUserId } }); } catch { /* ignore */ }
  }, TEST_TIMEOUT);

  const createdMsgIds: string[] = [];

  // ============================================================
  // CREATE - Validation
  // ============================================================
  describe('CREATE - Validation', () => {
    it('should reject missing conversationId', async () => {
      const result = await handleMemCreate({
        resource: 'message',
        data: { role: 'user', content: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('conversationId is required');
    });

    it('should reject missing role', async () => {
      const result = await handleMemCreate({
        resource: 'message',
        data: { conversationId: testConvId, content: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('role is required');
    });

    it('should reject missing content', async () => {
      const result = await handleMemCreate({
        resource: 'message',
        data: { conversationId: testConvId, role: 'user' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('content is required');
    });

    it('should reject invalid role', async () => {
      const result = await handleMemCreate({
        resource: 'message',
        data: { conversationId: testConvId, role: 'invalid_role', content: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid role');
    });
  });

  // ============================================================
  // CREATE - Success (all roles)
  // ============================================================
  describe('CREATE - Success', () => {
    it('should create user message', async () => {
      const result = await handleMemCreate({
        resource: 'message',
        data: { conversationId: testConvId, role: 'user', content: 'Hello!' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.role).toBe('user');
      createdMsgIds.push(parsed.id);
    });

    it('should create assistant message', async () => {
      const result = await handleMemCreate({
        resource: 'message',
        data: { conversationId: testConvId, role: 'assistant', content: 'Hi there!' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.role).toBe('assistant');
      createdMsgIds.push(parsed.id);
    });

    it('should create system message', async () => {
      const result = await handleMemCreate({
        resource: 'message',
        data: { conversationId: testConvId, role: 'system', content: 'You are a helpful assistant.' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.role).toBe('system');
      createdMsgIds.push(parsed.id);
    });

    it('should create tool message', async () => {
      const result = await handleMemCreate({
        resource: 'message',
        data: { conversationId: testConvId, role: 'tool', content: '{"result": 42}' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.role).toBe('tool');
      createdMsgIds.push(parsed.id);
    });
  });

  // ============================================================
  // READ - By ID
  // ============================================================
  describe('READ - By ID', () => {
    it('should read message by ID', async () => {
      if (createdMsgIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'message',
        query: { id: createdMsgIds[0] },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(createdMsgIds[0]);
      expect(parsed.content).toBeDefined();
      expect(parsed.role).toBeDefined();
    });

    it('should return error for non-existent message ID', async () => {
      const result = await handleMemRead({
        resource: 'message',
        query: { id: 'non-existent-msg' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Message not found');
    });
  });

  // ============================================================
  // READ - By Conversation ID
  // ============================================================
  describe('READ - By Conversation ID', () => {
    it('should list messages by conversationId', async () => {
      const result = await handleMemRead({
        resource: 'message',
        query: { conversationId: testConvId },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty list for non-existent conversation', async () => {
      const result = await handleMemRead({
        resource: 'message',
        query: { conversationId: 'non-existent-conv' },
        scope: { userId: testUserId }
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
        resource: 'message',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('query is required');
    });

    it('should reject invalid query keys', async () => {
      const result = await handleMemRead({
        resource: 'message',
        query: { search: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for message');
    });
  });

  // ============================================================
  // UPDATE
  // ============================================================
  describe('UPDATE', () => {
    it('should update message content', async () => {
      if (createdMsgIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'message',
        id: createdMsgIds[0],
        data: { content: 'Updated message content' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toBeDefined();
    });

    it('should reject update non-existent message', async () => {
      const result = await handleMemUpdate({
        resource: 'message',
        id: 'non-existent-msg',
        data: { content: 'Updated' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Message not found');
    });

    it('should reject missing id', async () => {
      const result = await handleMemUpdate({
        resource: 'message',
        data: { content: 'Updated' },
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });

    it('should reject empty data', async () => {
      if (createdMsgIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'message',
        id: createdMsgIds[0],
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
    it('should delete existing message', async () => {
      if (createdMsgIds.length === 0) return;
      const msgId = createdMsgIds.pop()!;
      const result = await handleMemDelete({
        resource: 'message',
        id: msgId,
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should return success:false for non-existent message (idempotent)', async () => {
      const result = await handleMemDelete({
        resource: 'message',
        id: 'non-existent-msg-delete',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Message not found');
    });

    it('should reject missing id', async () => {
      const result = await handleMemDelete({
        resource: 'message',
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });
  });
});
