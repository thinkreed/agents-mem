/**
 * @file src/sqlite/messages.ts
 * @description Messages table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';

/**
 * Message record type
 */
export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: string;
  content?: string;
  tool_calls?: string;
  tool_results?: string;
  reasoning?: string;
  openviking_uri?: string;
  tiered_id?: string;
  tokens_input?: number;
  tokens_output?: number;
  timestamp: number;
  source_document_id?: string;
}

/**
 * Message creation input
 */
export interface MessageInput {
  id?: string;
  conversation_id: string;
  role: string;
  content?: string;
  tool_calls?: string;
  tool_results?: string;
  reasoning?: string;
  openviking_uri?: string;
  tiered_id?: string;
  tokens_input?: number;
  tokens_output?: number;
  source_document_id?: string;
}

/**
 * Message update input
 */
export interface MessageUpdate {
  content?: string;
  openviking_uri?: string;
  tiered_id?: string;
}

/**
 * Create message
 */
export function createMessage(input: MessageInput): MessageRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `INSERT INTO messages (
      id, conversation_id, role, content, tool_calls, tool_results, reasoning,
      openviking_uri, tiered_id, tokens_input, tokens_output, timestamp, source_document_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.conversation_id, input.role, input.content ?? null,
      input.tool_calls ?? null, input.tool_results ?? null, input.reasoning ?? null,
      input.openviking_uri ?? null, input.tiered_id ?? null,
      input.tokens_input ?? null, input.tokens_output ?? null, now,
      input.source_document_id ?? null
    ]
  );
  
  return {
    id,
    conversation_id: input.conversation_id,
    role: input.role,
    content: input.content,
    tool_calls: input.tool_calls,
    tool_results: input.tool_results,
    reasoning: input.reasoning,
    openviking_uri: input.openviking_uri,
    tiered_id: input.tiered_id,
    tokens_input: input.tokens_input,
    tokens_output: input.tokens_output,
    timestamp: now,
    source_document_id: input.source_document_id
  };
}

/**
 * Get message by ID
 */
export function getMessageById(id: string): MessageRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<MessageRecord>(
    'SELECT * FROM messages WHERE id = ?',
    [id]
  );
}

/**
 * Get messages by conversation
 */
export function getMessagesByConversation(conversationId: string): MessageRecord[] {
  const db = getConnection();
  
  return db.query<MessageRecord>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
    [conversationId]
  );
}

/**
 * Update message
 */
export function updateMessage(id: string, update: MessageUpdate): MessageRecord | undefined {
  const db = getConnection();
  const existing = getMessageById(id);
  
  if (!existing) return undefined;
  
  db.run(
    `UPDATE messages SET content = ?, openviking_uri = ?, tiered_id = ? WHERE id = ?`,
    [
      update.content ?? existing.content,
      update.openviking_uri ?? existing.openviking_uri,
      update.tiered_id ?? existing.tiered_id,
      id
    ]
  );
  
  return getMessageById(id);
}

/**
 * Delete message
 */
export function deleteMessage(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM messages WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * Delete all messages for a conversation
 */
export function deleteMessagesByConversation(conversationId: string): number {
  const db = getConnection();
  
  const result = db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
  
  return result.changes;
}

/**
 * List messages by conversation (alias for getMessagesByConversation)
 */
export function listMessagesByConversation(conversationId: string): MessageRecord[] {
  return getMessagesByConversation(conversationId);
}