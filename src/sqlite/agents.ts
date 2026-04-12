/**
 * @file src/sqlite/agents.ts
 * @description Agents table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';

/**
 * Agent record type
 */
export interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  role?: string;
  capabilities?: string;
  created_at: number;
}

/**
 * Agent creation input
 */
export interface AgentInput {
  id?: string;
  user_id: string;
  name: string;
  role?: string;
  capabilities?: string;
}

/**
 * Agent update input
 */
export interface AgentUpdate {
  name?: string;
  role?: string;
  capabilities?: string;
}

/**
 * Create agent
 */
export function createAgent(input: AgentInput): AgentRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `INSERT INTO agents (id, user_id, name, role, capabilities, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.user_id, input.name, input.role ?? null, input.capabilities ?? null, now]
  );
  
  return {
    id,
    user_id: input.user_id,
    name: input.name,
    role: input.role,
    capabilities: input.capabilities,
    created_at: now
  };
}

/**
 * Get agent by ID
 */
export function getAgentById(id: string): AgentRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<AgentRecord>(
    'SELECT * FROM agents WHERE id = ?',
    [id]
  );
}

/**
 * Get agents by user ID
 */
export function getAgentsByUserId(userId: string): AgentRecord[] {
  const db = getConnection();
  
  return db.query<AgentRecord>(
    'SELECT * FROM agents WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
}

/**
 * Update agent
 */
export function updateAgent(id: string, update: AgentUpdate): AgentRecord | undefined {
  const db = getConnection();
  const existing = getAgentById(id);
  
  if (!existing) return undefined;
  
  const name = update.name ?? existing.name;
  const role = update.role ?? existing.role;
  const capabilities = update.capabilities ?? existing.capabilities;
  
  db.run(
    `UPDATE agents SET name = ?, role = ?, capabilities = ? WHERE id = ?`,
    [name, role, capabilities, id]
  );
  
  return {
    ...existing,
    name,
    role,
    capabilities
  };
}

/**
 * Delete agent
 */
export function deleteAgent(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM agents WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * List all agents
 */
export function listAgents(): AgentRecord[] {
  const db = getConnection();
  
  return db.query<AgentRecord>('SELECT * FROM agents ORDER BY created_at DESC');
}