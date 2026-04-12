/**
 * @file tests/sqlite/messages.test.ts
 * @description Messages table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMessage,
  getMessageById,
  getMessagesByConversation,
  updateMessage,
  deleteMessage,
  MessageRecord
} from '../../src/sqlite/messages';
import { createUser } from '../../src/sqlite/users';
import { createAgent } from '../../src/sqlite/agents';
import { createConversation } from '../../src/sqlite/conversations';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Messages Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'User' });
    createAgent({ id: 'agent-1', user_id: 'user-1', name: 'Agent' });
    createConversation({ id: 'conv-1', user_id: 'user-1', agent_id: 'agent-1' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('createMessage', () => {
    it('should create message', () => {
      const msg = createMessage({
        id: 'msg-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Hello'
      });
      
      expect(msg).toBeDefined();
      expect(msg.id).toBe('msg-1');
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
    });

    it('should create assistant message', () => {
      const msg = createMessage({
        id: 'msg-2',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Hi there!'
      });
      
      expect(msg.role).toBe('assistant');
    });

    it('should set timestamp', () => {
      const msg = createMessage({
        id: 'msg-3',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Time test'
      });
      
      expect(msg.timestamp).toBeDefined();
      expect(msg.timestamp).toBeGreaterThan(0);
    });
  });

  describe('getMessageById', () => {
    it('should get message by id', () => {
      createMessage({
        id: 'msg-4',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Get test'
      });
      
      const msg = getMessageById('msg-4');
      
      expect(msg).toBeDefined();
      expect(msg?.content).toBe('Get test');
    });
  });

  describe('getMessagesByConversation', () => {
    it('should get messages by conversation', () => {
      createMessage({
        id: 'msg-5',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Message A'
      });
      createMessage({
        id: 'msg-6',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Message B'
      });
      
      const msgs = getMessagesByConversation('conv-1');
      
      expect(msgs.length).toBe(2);
    });

    it('should return in chronological order', () => {
      createMessage({
        id: 'msg-7',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'First'
      });
      createMessage({
        id: 'msg-8',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'Second'
      });
      
      const msgs = getMessagesByConversation('conv-1');
      
      expect(msgs[0].id).toBe('msg-7');
    });
  });

  describe('updateMessage', () => {
    it('should update message', () => {
      createMessage({
        id: 'msg-9',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Original'
      });
      
      const updated = updateMessage('msg-9', {
        content: 'Updated',
        lance_id: 'lance-1'
      });
      
      expect(updated?.content).toBe('Updated');
      expect(updated?.lance_id).toBe('lance-1');
    });
  });

  describe('deleteMessage', () => {
    it('should delete message', () => {
      createMessage({
        id: 'msg-10',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'Delete'
      });
      
      const result = deleteMessage('msg-10');
      
      expect(result).toBe(true);
    });
  });
});