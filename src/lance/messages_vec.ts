/**
 * @file src/lance/messages_vec.ts
 * @description Messages vector table operations
 */

import { getTable } from './connection';
import { Scope } from '../core/types';

/**
 * Message vector record
 */
export interface MessageVectorRecord {
  id: string;
  content: string;
  vector: Float32Array;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  conversation_id: string;
  role: string;
  timestamp?: number;
}

/**
 * Add message vector
 */
export async function addMessageVector(record: MessageVectorRecord): Promise<void> {
  const table = await getTable('messages_vec');
  
  const data = {
    id: record.id,
    content: record.content,
    vector: Array.from(record.vector), // LanceDB expects array
    user_id: record.user_id,
    agent_id: record.agent_id ?? null,
    team_id: record.team_id ?? null,
    conversation_id: record.conversation_id,
    role: record.role,
    timestamp: record.timestamp ?? Math.floor(Date.now() / 1000)
  };
  
  await table.add([data]);
}

/**
 * Get message vector by ID
 */
export async function getMessageVector(id: string): Promise<MessageVectorRecord | undefined> {
  const table = await getTable('messages_vec');
  
  const results = await table.query().where(`id = '${id}'`).limit(1).toArray();
  
  if (results.length === 0) return undefined;
  
  const row = results[0];
  return {
    ...row,
    vector: new Float32Array(row.vector),
    timestamp: Number(row.timestamp)
  } as MessageVectorRecord;
}

/**
 * Delete message vector
 */
export async function deleteMessageVector(id: string): Promise<void> {
  const table = await getTable('messages_vec');
  
  await table.delete(`id = '${id}'`);
}

/**
 * Search message vectors
 */
export async function searchMessageVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope
): Promise<MessageVectorRecord[]> {
  const table = await getTable('messages_vec');
  
  // Use nearestTo for vector search (LanceDB 0.27+ API)
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  if (scope) {
    query = query.where(`user_id = '${scope.userId}'`);
  }
  
  const results = await query.toArray();
  
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector),
    timestamp: Number(row.timestamp)
  })) as MessageVectorRecord[];
}

/**
 * Count message vectors
 */
export async function countMessageVectors(): Promise<number> {
  const table = await getTable('messages_vec');
  
  return await table.countRows();
}