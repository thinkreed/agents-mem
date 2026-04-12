/**
 * @file src/lance/tiered_vec.ts
 * @description Tiered vector table operations
 */

import { getTable } from './connection';
import { Scope } from '../core/types';
import { ScopeFilter } from '../core/scope';

/**
 * Tiered vector record
 */
export interface TieredVectorRecord {
  id: string;
  content: string;
  vector: Float32Array;
  tier: number;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  source_type: string;
  source_id: string;
  original_uri?: string;
}

/**
 * Add tiered vector
 */
export async function addTieredVector(record: TieredVectorRecord): Promise<void> {
  const table = await getTable('tiered_vec');
  
  const data = {
    id: record.id,
    content: record.content,
    vector: Array.from(record.vector), // LanceDB expects array
    tier: record.tier,
    user_id: record.user_id,
    agent_id: record.agent_id ?? null,
    team_id: record.team_id ?? null,
    source_type: record.source_type,
    source_id: record.source_id,
    original_uri: record.original_uri ?? null
  };
  
  await table.add([data]);
}

/**
 * Get tiered vector by ID
 */
export async function getTieredVector(id: string): Promise<TieredVectorRecord | undefined> {
  const table = await getTable('tiered_vec');
  
  const results = await table.query().where(`id = '${id}'`).limit(1).toArray();
  
  if (results.length === 0) return undefined;
  
  const row = results[0];
  return {
    ...row,
    vector: new Float32Array(row.vector)
  } as TieredVectorRecord;
}

/**
 * Delete tiered vector
 */
export async function deleteTieredVector(id: string): Promise<void> {
  const table = await getTable('tiered_vec');
  
  await table.delete(`id = '${id}'`);
}

/**
 * Search tiered vectors
 */
export async function searchTieredVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope,
  tier?: number
): Promise<TieredVectorRecord[]> {
  const table = await getTable('tiered_vec');
  
  // Use nearestTo for vector search (LanceDB 0.27+ API)
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  // Apply scope filter using ScopeFilter
  if (scope) {
    const filter = new ScopeFilter(scope);
    query = query.where(filter.toLanceFilter());
  }

  if (tier !== undefined) {
    query = query.where(`tier == ${tier}`);
  }
  
  const results = await query.toArray();
  
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector)
  })) as TieredVectorRecord[];
}

/**
 * Get vectors by tier
 */
export async function getTieredVectorsByTier(tier: number, scope?: Scope): Promise<TieredVectorRecord[]> {
  const table = await getTable('tiered_vec');
  
  let query = table.query().where(`tier == ${tier}`);
  
  // Apply scope filter using ScopeFilter
  if (scope) {
    const filter = new ScopeFilter(scope);
    query = query.where(filter.toLanceFilter());
  }
  
  const results = await query.toArray();
  
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector)
  })) as TieredVectorRecord[];
}

/**
 * Count tiered vectors
 */
export async function countTieredVectors(): Promise<number> {
  const table = await getTable('tiered_vec');
  
  return await table.countRows();
}