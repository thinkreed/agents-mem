/**
 * @file tests/sqlite/conversations.test.ts
 * @description Conversations table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createConversation,
  getConversationById,
  getConversationsByScope,
  updateConversation,
  deleteConversation,
  ConversationRecord
} from '../../src/sqlite/conversations';
import { createUser } from '../../src/sqlite/users';
import { createAgent } from '../../src/sqlite/agents';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Conversations Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'User' });
    createAgent({ id: 'agent-1', user_id: 'user-1', name: 'Agent' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('createConversation', () => {
    it('should create conversation', () => {
      const conv = createConversation({
        id: 'conv-1',
        user_id: 'user-1',
        agent_id: 'agent-1'
      });
      
      expect(conv).toBeDefined();
      expect(conv.id).toBe('conv-1');
      expect(conv.user_id).toBe('user-1');
      expect(conv.agent_id).toBe('agent-1');
    });

    it('should create with title', () => {
      const conv = createConversation({
        id: 'conv-2',
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'Test Conversation'
      });
      
      expect(conv.title).toBe('Test Conversation');
    });
  });

  describe('getConversationById', () => {
    it('should get conversation by id', () => {
      createConversation({
        id: 'conv-3',
        user_id: 'user-1',
        agent_id: 'agent-1'
      });
      
      const conv = getConversationById('conv-3');
      
      expect(conv).toBeDefined();
    });
  });

  describe('getConversationsByScope', () => {
    it('should get conversations by user', () => {
      createConversation({
        id: 'conv-4',
        user_id: 'user-1',
        agent_id: 'agent-1'
      });
      
      const convs = getConversationsByScope({ userId: 'user-1' });
      
      expect(convs.length).toBe(1);
    });

    it('should get conversations by user with agent scope', () => {
      createConversation({
        id: 'conv-agent',
        user_id: 'user-1',
        agent_id: 'agent-1'
      });
      
      createConversation({
        id: 'conv-no-agent',
        user_id: 'user-1',
        agent_id: 'agent-2'
      });
      
      const convs = getConversationsByScope({ userId: 'user-1', agentId: 'agent-1' });
      
      expect(convs.length).toBe(1);
      expect(convs[0].agent_id).toBe('agent-1');
    });

    it('should get conversations by user with team scope', () => {
      createConversation({
        id: 'conv-team',
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-1'
      });
      
      createConversation({
        id: 'conv-no-team',
        user_id: 'user-1',
        agent_id: 'agent-2'
      });
      
      const convs = getConversationsByScope({ userId: 'user-1', teamId: 'team-1' });
      
      expect(convs.length).toBe(1);
      expect(convs[0].team_id).toBe('team-1');
    });
  });

  describe('updateConversation', () => {
    it('should update conversation', () => {
      createConversation({
        id: 'conv-5',
        user_id: 'user-1',
        agent_id: 'agent-1'
      });
      
      const updated = updateConversation('conv-5', {
        title: 'Updated Title',
        message_count: 5
      });
      
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.message_count).toBe(5);
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation', () => {
      createConversation({
        id: 'conv-6',
        user_id: 'user-1',
        agent_id: 'agent-1'
      });
      
      const result = deleteConversation('conv-6');
      
      expect(result).toBe(true);
    });
  });
});