/**
 * @file tests/sqlite/agents.test.ts
 * @description Agents table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createAgent,
  getAgentById,
  getAgentsByUserId,
  updateAgent,
  deleteAgent,
  listAgents,
  AgentRecord
} from '../../src/sqlite/agents';
import { createUser } from '../../src/sqlite/users';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Agents Table', () => {
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

  describe('createAgent', () => {
    it('should create agent with required fields', () => {
      const agent = createAgent({
        id: 'agent-1',
        user_id: 'user-1',
        name: 'Test Agent'
      });
      
      expect(agent).toBeDefined();
      expect(agent.id).toBe('agent-1');
      expect(agent.user_id).toBe('user-1');
      expect(agent.name).toBe('Test Agent');
    });

    it('should create agent with all fields', () => {
      const agent = createAgent({
        id: 'agent-2',
        user_id: 'user-1',
        name: 'Full Agent',
        role: 'assistant',
        capabilities: '["code", "research"]'
      });
      
      expect(agent.role).toBe('assistant');
      expect(agent.capabilities).toBe('["code", "research"]');
    });

    it('should set timestamp', () => {
      const agent = createAgent({
        id: 'agent-3',
        user_id: 'user-1',
        name: 'Timestamp Agent'
      });
      
      expect(agent.created_at).toBeDefined();
      expect(agent.created_at).toBeGreaterThan(0);
    });
  });

  describe('getAgentById', () => {
    it('should get agent by id', () => {
      createAgent({ id: 'agent-4', user_id: 'user-1', name: 'Get Agent' });
      
      const agent = getAgentById('agent-4');
      
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Get Agent');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = getAgentById('non-existent');
      
      expect(agent).toBeNull();
    });
  });

  describe('getAgentsByUserId', () => {
    it('should get agents by user id', () => {
      createAgent({ id: 'agent-5', user_id: 'user-1', name: 'Agent A' });
      createAgent({ id: 'agent-6', user_id: 'user-1', name: 'Agent B' });
      
      const agents = getAgentsByUserId('user-1');
      
      expect(agents.length).toBe(2);
    });

    it('should return empty array for user without agents', () => {
      createUser({ id: 'user-2', name: 'No Agents User' });
      
      const agents = getAgentsByUserId('user-2');
      
      expect(agents).toEqual([]);
    });
  });

  describe('updateAgent', () => {
    it('should update agent name', () => {
      createAgent({ id: 'agent-7', user_id: 'user-1', name: 'Original' });
      
      const updated = updateAgent('agent-7', { name: 'Updated' });
      
      expect(updated?.name).toBe('Updated');
    });

    it('should update agent role', () => {
      createAgent({ id: 'agent-8', user_id: 'user-1', name: 'Role Agent', role: 'assistant' });
      
      const updated = updateAgent('agent-8', { role: 'planner' });
      
      expect(updated?.role).toBe('planner');
    });

    it('should return undefined for non-existent agent', () => {
      const updated = updateAgent('non-existent', { name: 'Updated' });
      
      expect(updated).toBeUndefined();
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent', () => {
      createAgent({ id: 'agent-9', user_id: 'user-1', name: 'Delete Agent' });
      
      const result = deleteAgent('agent-9');
      
      expect(result).toBe(true);
      expect(getAgentById('agent-9')).toBeNull();
    });

    it('should return false for non-existent agent', () => {
      const result = deleteAgent('non-existent');
      
      expect(result).toBe(false);
    });
  });

  describe('listAgents', () => {
    it('should list all agents', () => {
      createAgent({ id: 'agent-10', user_id: 'user-1', name: 'Agent A' });
      createAgent({ id: 'agent-11', user_id: 'user-1', name: 'Agent B' });
      
      const agents = listAgents();
      
      expect(agents.length).toBe(2);
    });
  });
});