/**
 * @file src/lance/facts_vec.ts
 * @description Facts vector table operations
 */

import { getTable } from './connection';
import { Scope } from '../core/types';
import { ScopeFilter } from '../core/scope';

/**
 * Fact vector record
 */
export interface FactVectorRecord {
  id: string;
  content: string;
  vector: Float32Array;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global?: boolean;
  fact_type: string;
  importance?: number;
  confidence?: number;
  source_type: string;
  source_id: string;
}

/**
 * Add fact vector
 */
export async function addFactVector(record: FactVectorRecord): Promise<void> {
  const table = await getTable('facts_vec');
  
  const data = {
    id: record.id,
    content: record.content,
    vector: Array.from(record.vector), // LanceDB expects array
    user_id: record.user_id,
    agent_id: record.agent_id ?? null,
    team_id: record.team_id ?? null,
    is_global: record.is_global ?? false,
    fact_type: record.fact_type,
    importance: record.importance ?? 0.5,
    confidence: record.confidence ?? 0.8,
    source_type: record.source_type,
    source_id: record.source_id
  };
  
  await table.add([data]);
}

/**
 * Get fact vector by ID
 */
export async function getFactVector(id: string): Promise<FactVectorRecord | undefined> {
  const table = await getTable('facts_vec');
  
  const results = await table.query().where(`id = '${id}'`).limit(1).toArray();
  
  if (results.length === 0) return undefined;
  
  const row = results[0];
  return {
    ...row,
    vector: new Float32Array(row.vector)
  } as FactVectorRecord;
}

/**
 * Delete fact vector
 */
export async function deleteFactVector(id: string): Promise<void> {
  const table = await getTable('facts_vec');
  
  await table.delete(`id = '${id}'`);
}

/**
 * Search fact vectors
 */
export async function searchFactVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope
): Promise<FactVectorRecord[]> {
  const table = await getTable('facts_vec');
  
  // Use nearestTo for vector search (LanceDB 0.27+ API)
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  // Apply scope filter using ScopeFilter
  if (scope) {
    const filter = new ScopeFilter(scope);
    query = query.where(filter.toLanceFilter());
  }
  
  const results = await query.toArray();
  
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector)
  })) as FactVectorRecord[];
}

/**
 * Count fact vectors
 */
export async function countFactVectors(): Promise<number> {
  const table = await getTable('facts_vec');
  
  return await table.countRows();
}