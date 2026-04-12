/**
 * @file src/lance/assets_vec.ts
 * @description Assets vector table operations
 */

import { getTable } from './connection';
import { Scope } from '../core/types';

/**
 * Asset vector record
 */
export interface AssetVectorRecord {
  id: string;
  content: string;
  vector: Float32Array;
  title: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  asset_type?: string;
  storage_path?: string;
  created_at?: number;
}

/**
 * Add asset vector
 */
export async function addAssetVector(record: AssetVectorRecord): Promise<void> {
  const table = await getTable('assets_vec');
  
  const data = {
    id: record.id,
    content: record.content,
    vector: Array.from(record.vector), // LanceDB expects array, not Float32Array
    title: record.title,
    user_id: record.user_id,
    agent_id: record.agent_id ?? null,
    team_id: record.team_id ?? null,
    asset_type: record.asset_type ?? null,
    storage_path: record.storage_path ?? null,
    created_at: record.created_at ?? Math.floor(Date.now() / 1000)
  };
  
  await table.add([data]);
}

/**
 * Get asset vector by ID
 */
export async function getAssetVector(id: string): Promise<AssetVectorRecord | undefined> {
  const table = await getTable('assets_vec');
  
  const results = await table.query().where(`id = '${id}'`).limit(1).toArray();
  
  if (results.length === 0) return undefined;
  
  const row = results[0];
  return {
    ...row,
    vector: new Float32Array(row.vector),
    created_at: Number(row.created_at)
  } as AssetVectorRecord;
}

/**
 * Delete asset vector
 */
export async function deleteAssetVector(id: string): Promise<void> {
  const table = await getTable('assets_vec');
  
  await table.delete(`id = '${id}'`);
}

/**
 * Search asset vectors by similarity
 */
export async function searchAssetVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope
): Promise<AssetVectorRecord[]> {
  const table = await getTable('assets_vec');
  
  // Use nearestTo for vector search (LanceDB 0.27+ API)
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  if (scope) {
    query = query.where(`user_id = '${scope.userId}'`);
    if (scope.agentId) {
      query = query.where(`agent_id = '${scope.agentId}'`);
    }
    if (scope.teamId) {
      query = query.where(`team_id = '${scope.teamId}'`);
    }
  }
  
  const results = await query.toArray();
  
  // Convert back to proper types
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector),
    created_at: Number(row.created_at)
  })) as AssetVectorRecord[];
}

/**
 * Update asset vector
 */
export async function updateAssetVector(
  id: string,
  update: Partial<AssetVectorRecord>
): Promise<void> {
  const table = await getTable('assets_vec');
  
  // LanceDB requires delete + add for updates
  const existing = await getAssetVector(id);
  if (!existing) return;
  
  await deleteAssetVector(id);
  
  const updated: AssetVectorRecord = {
    ...existing,
    ...update
  };
  
  await addAssetVector(updated);
}

/**
 * Count asset vectors
 */
export async function countAssetVectors(): Promise<number> {
  const table = await getTable('assets_vec');
  
  const count = await table.countRows();
  return count;
}