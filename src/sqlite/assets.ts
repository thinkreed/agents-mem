/**
 * @file src/sqlite/assets.ts
 * @description Assets table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';
import { Scope } from '../core/types';

/**
 * Asset record type
 */
export interface AssetRecord {
  id: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global: boolean;
  filename: string;
  file_type: string;
  file_size: number;
  source_url?: string;
  source_path?: string;
  storage_path: string;
  extracted_text?: string;
  title?: string;
  description?: string;
  metadata?: string;
  lance_id?: string;
  text_extracted: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * Asset creation input
 */
export interface AssetInput {
  id?: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global?: boolean;
  filename: string;
  file_type: string;
  file_size: number;
  source_url?: string;
  source_path?: string;
  storage_path: string;
  extracted_text?: string;
  title?: string;
  description?: string;
  metadata?: string;
  lance_id?: string;
}

/**
 * Asset update input
 */
export interface AssetUpdate {
  title?: string;
  description?: string;
  metadata?: string;
  lance_id?: string;
  extracted_text?: string;
  text_extracted?: boolean;
}

/**
 * Asset search filter
 */
export interface AssetSearchFilter {
  file_type?: string;
}

/**
 * Create asset
 */
export function createAsset(input: AssetInput): AssetRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  const isGlobal = input.is_global ?? false;
  const textExtracted = input.extracted_text ? true : false;
  
  db.run(
    `INSERT INTO assets (
      id, user_id, agent_id, team_id, is_global, filename, file_type, file_size,
      source_url, source_path, storage_path, extracted_text, title, description,
      metadata, lance_id, text_extracted, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.user_id, input.agent_id ?? null, input.team_id ?? null,
      isGlobal, input.filename, input.file_type, input.file_size,
      input.source_url ?? null, input.source_path ?? null, input.storage_path,
      input.extracted_text ?? null, input.title ?? null, input.description ?? null,
      input.metadata ?? null, input.lance_id ?? null, textExtracted, now, now
    ]
  );
  
  return {
    id,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    is_global: isGlobal,
    filename: input.filename,
    file_type: input.file_type,
    file_size: input.file_size,
    source_url: input.source_url,
    source_path: input.source_path,
    storage_path: input.storage_path,
    extracted_text: input.extracted_text,
    title: input.title,
    description: input.description,
    metadata: input.metadata,
    lance_id: input.lance_id,
    text_extracted: textExtracted,
    created_at: now,
    updated_at: now
  };
}

/**
 * Get asset by ID
 */
export function getAssetById(id: string): AssetRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<AssetRecord>(
    'SELECT * FROM assets WHERE id = ?',
    [id]
  );
}

/**
 * Get assets by scope
 */
export function getAssetsByScope(scope: Scope): AssetRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM assets WHERE user_id = ?';
  const params: string[] = [scope.userId];
  
  if (scope.agentId) {
    sql += ' AND agent_id = ?';
    params.push(scope.agentId);
  }
  
  if (scope.teamId) {
    sql += ' AND team_id = ?';
    params.push(scope.teamId);
  }
  
  return db.query<AssetRecord>(sql, params);
}

/**
 * Update asset
 */
export function updateAsset(id: string, update: AssetUpdate): AssetRecord | undefined {
  const db = getConnection();
  const existing = getAssetById(id);
  
  if (!existing) return undefined;
  
  const now = Math.floor(Date.now() / 1000);
  const textExtracted = update.text_extracted ?? (update.extracted_text ? true : existing.text_extracted);
  
  db.run(
    `UPDATE assets SET
      title = ?, description = ?, metadata = ?, lance_id = ?,
      extracted_text = ?, text_extracted = ?, updated_at = ?
    WHERE id = ?`,
    [
      update.title ?? existing.title,
      update.description ?? existing.description,
      update.metadata ?? existing.metadata,
      update.lance_id ?? existing.lance_id,
      update.extracted_text ?? existing.extracted_text,
      textExtracted, now, id
    ]
  );
  
  return getAssetById(id);
}

/**
 * Delete asset
 */
export function deleteAsset(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM assets WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * Search assets
 */
export function searchAssets(filter: AssetSearchFilter): AssetRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM assets WHERE 1=1';
  const params: unknown[] = [];
  
  if (filter.file_type) {
    sql += ' AND file_type = ?';
    params.push(filter.file_type);
  }
  
  return db.query<AssetRecord>(sql, params);
}