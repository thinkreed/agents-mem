/**
 * @file src/lance/documents_vec.ts
 * @description Documents vector table operations
 */

import { getTable } from './connection';
import { Scope } from '../core/types';
import { ScopeFilter } from '../core/scope';

/**
 * Document vector record
 */
export interface DocumentVectorRecord {
  id: string;
  content: string;
  vector: Float32Array;
  title: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global?: boolean;
  topic?: string;
  entity?: string;
  category?: string;
  importance?: number;
  created_at?: number;
}

/**
 * Add document vector
 */
export async function addDocumentVector(record: DocumentVectorRecord): Promise<void> {
  const table = await getTable('documents_vec');
  
  const data = {
    id: record.id,
    content: record.content,
    vector: Array.from(record.vector), // LanceDB expects array, not Float32Array
    title: record.title,
    user_id: record.user_id,
    agent_id: record.agent_id ?? null,
    team_id: record.team_id ?? null,
    is_global: record.is_global ?? false,
    topic: record.topic ?? null,
    entity: record.entity ?? null,
    category: record.category ?? null,
    importance: record.importance ?? 0.5,
    created_at: record.created_at ?? Math.floor(Date.now() / 1000)
  };
  
  await table.add([data]);
}

/**
 * Get document vector by ID
 */
export async function getDocumentVector(id: string): Promise<DocumentVectorRecord | undefined> {
  const table = await getTable('documents_vec');
  
  const results = await table.query().where(`id = '${id}'`).limit(1).toArray();
  
  if (results.length === 0) return undefined;
  
  const row = results[0];
  return {
    ...row,
    vector: new Float32Array(row.vector),
    created_at: Number(row.created_at)
  } as DocumentVectorRecord;
}

/**
 * Delete document vector
 */
export async function deleteDocumentVector(id: string): Promise<void> {
  const table = await getTable('documents_vec');
  
  await table.delete(`id = '${id}'`);
}

/**
 * Clear all document vectors in the table
 */
export async function clearDocumentVectors(): Promise<void> {
  const table = await getTable('documents_vec');
  
  // Delete all rows
  await table.delete('id IS NOT NULL');
}

/**
 * Get all document vector IDs
 */
export async function getAllDocumentVectorIds(): Promise<string[]> {
  const table = await getTable('documents_vec');
  
  const results = await table.query().toArray();
  return results.map((r: Record<string, unknown>) => r.id as string);
}

/**
 * Search document vectors by similarity
 */
export async function searchDocumentVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope
): Promise<DocumentVectorRecord[]> {
  const table = await getTable('documents_vec');
  
  // Use nearestTo for vector search (LanceDB 0.27+ API)
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  // Apply scope filter using ScopeFilter (single filter with AND)
  if (scope) {
    const filter = new ScopeFilter(scope);
    query = query.where(filter.toLanceFilter());
  }
  
  const results = await query.toArray();
  
  // Convert back to proper types
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector),
    created_at: Number(row.created_at)
  })) as DocumentVectorRecord[];
}

/**
 * Update document vector
 */
export async function updateDocumentVector(
  id: string,
  update: Partial<DocumentVectorRecord>
): Promise<void> {
  const table = await getTable('documents_vec');
  
  // LanceDB requires delete + add for updates
  const existing = await getDocumentVector(id);
  if (!existing) return;
  
  await deleteDocumentVector(id);
  
  const updated: DocumentVectorRecord = {
    ...existing,
    ...update
  };
  
  await addDocumentVector(updated);
}

/**
 * Count document vectors
 */
export async function countDocumentVectors(): Promise<number> {
  const table = await getTable('documents_vec');
  
  const count = await table.countRows();
  return count;
}