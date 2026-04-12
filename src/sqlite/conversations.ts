/**
 * @file src/sqlite/conversations.ts
 * @description Conversations table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';
import { Scope } from '../core/types';

/**
 * Conversation record type
 */
export interface ConversationRecord {
  id: string;
  user_id: string;
  agent_id: string;
  team_id?: string;
  title?: string;
  source: string;
  message_count: number;
  token_count_input: number;
  token_count_output: number;
  started_at: number;
  ended_at?: number;
  last_message_at?: number;
}

/**
 * Conversation creation input
 */
export interface ConversationInput {
  id?: string;
  user_id: string;
  agent_id: string;
  team_id?: string;
  title?: string;
  source?: string;
}

/**
 * Conversation update input
 */
export interface ConversationUpdate {
  title?: string;
  message_count?: number;
  token_count_input?: number;
  token_count_output?: number;
  ended_at?: number;
  last_message_at?: number;
}

/**
 * Create conversation
 */
export function createConversation(input: ConversationInput): ConversationRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  const source = input.source ?? 'mcp';
  
  db.run(
    `INSERT INTO conversations (
      id, user_id, agent_id, team_id, title, source, message_count,
      token_count_input, token_count_output, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
    [id, input.user_id, input.agent_id, input.team_id ?? null, input.title ?? null, source, now]
  );
  
  return {
    id,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    title: input.title,
    source,
    message_count: 0,
    token_count_input: 0,
    token_count_output: 0,
    started_at: now
  };
}

/**
 * Get conversation by ID
 */
export function getConversationById(id: string): ConversationRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<ConversationRecord>(
    'SELECT * FROM conversations WHERE id = ?',
    [id]
  );
}

/**
 * Get conversations by scope
 */
export function getConversationsByScope(scope: Scope): ConversationRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM conversations WHERE user_id = ?';
  const params: string[] = [scope.userId];
  
  if (scope.agentId) {
    sql += ' AND agent_id = ?';
    params.push(scope.agentId);
  }
  
  if (scope.teamId) {
    sql += ' AND team_id = ?';
    params.push(scope.teamId);
  }
  
  return db.query<ConversationRecord>(sql + ' ORDER BY started_at DESC', params);
}

/**
 * Update conversation
 */
export function updateConversation(id: string, update: ConversationUpdate): ConversationRecord | undefined {
  const db = getConnection();
  const existing = getConversationById(id);
  
  if (!existing) return undefined;
  
  db.run(
    `UPDATE conversations SET
      title = ?, message_count = ?, token_count_input = ?, token_count_output = ?,
      ended_at = ?, last_message_at = ?
    WHERE id = ?`,
    [
      update.title ?? existing.title,
      update.message_count ?? existing.message_count,
      update.token_count_input ?? existing.token_count_input,
      update.token_count_output ?? existing.token_count_output,
      update.ended_at ?? existing.ended_at,
      update.last_message_at ?? existing.last_message_at,
      id
    ]
  );
  
  return getConversationById(id);
}

/**
 * Delete conversation
 */
export function deleteConversation(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM conversations WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * List conversations by user (alias for getConversationsByScope)
 */
export function listConversations(userId: string, agentId?: string, teamId?: string): ConversationRecord[] {
  return getConversationsByScope({ userId, agentId, teamId });
}