/**
 * @file src/sqlite/tiered_content.ts
 * @description Tiered content table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';
import { Scope } from '../core/types';

/**
 * Tiered content record type
 */
export interface TieredContentRecord {
  id: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  source_type: string;
  source_id: string;
  abstract: string;
  overview?: string;
  original_uri?: string;
  importance: number;
  openviking_uri_l0?: string;
  openviking_uri_l1?: string;
  l0_generated_at?: number;
  l1_generated_at?: number;
  generation_mode?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Tiered content creation input
 */
export interface TieredContentInput {
  id?: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  source_type: string;
  source_id: string;
  abstract: string;
  overview?: string;
  original_uri?: string;
  importance?: number;
  openviking_uri_l0?: string;
  openviking_uri_l1?: string;
  generation_mode?: string;
}

/**
 * Tiered content update input
 */
export interface TieredContentUpdate {
  abstract?: string;
  overview?: string;
  openviking_uri_l0?: string;
  openviking_uri_l1?: string;
  l0_generated_at?: number;
  l1_generated_at?: number;
  importance?: number;
}

/**
 * Create tiered content
 */
export function createTieredContent(input: TieredContentInput): TieredContentRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  const importance = input.importance ?? 0.5;
  
  db.run(
    `INSERT INTO tiered_content (
      id, user_id, agent_id, team_id, source_type, source_id, abstract, overview,
      original_uri, importance, openviking_uri_l0, openviking_uri_l1, l0_generated_at, l1_generated_at,
      generation_mode, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.user_id, input.agent_id ?? null, input.team_id ?? null,
      input.source_type, input.source_id, input.abstract, input.overview ?? null,
      input.original_uri ?? null, importance,
      input.openviking_uri_l0 ?? null, input.openviking_uri_l1 ?? null, null, null,
      input.generation_mode ?? null, now, now
    ]
  );
  
  return {
    id,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    source_type: input.source_type,
    source_id: input.source_id,
    abstract: input.abstract,
    overview: input.overview,
    original_uri: input.original_uri,
    importance,
    openviking_uri_l0: input.openviking_uri_l0,
    openviking_uri_l1: input.openviking_uri_l1,
    generation_mode: input.generation_mode,
    created_at: now,
    updated_at: now
  };
}

/**
 * Get tiered content by ID
 */
export function getTieredContentById(id: string): TieredContentRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<TieredContentRecord>(
    'SELECT * FROM tiered_content WHERE id = ?',
    [id]
  );
}

/**
 * Get tiered content by source
 */
export function getTieredContentBySource(sourceType: string, sourceId: string): TieredContentRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<TieredContentRecord>(
    'SELECT * FROM tiered_content WHERE source_type = ? AND source_id = ?',
    [sourceType, sourceId]
  );
}

/**
 * Get tiered content by scope
 */
export function getTieredContentByScope(scope: Scope): TieredContentRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM tiered_content WHERE user_id = ?';
  const params: string[] = [scope.userId];
  
  if (scope.agentId) {
    sql += ' AND agent_id = ?';
    params.push(scope.agentId);
  }
  
  if (scope.teamId) {
    sql += ' AND team_id = ?';
    params.push(scope.teamId);
  }
  
  return db.query<TieredContentRecord>(sql, params);
}

/**
 * Update tiered content
 */
export function updateTieredContent(id: string, update: TieredContentUpdate): TieredContentRecord | undefined {
  const db = getConnection();
  const existing = getTieredContentById(id);
  
  if (!existing) return undefined;
  
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `UPDATE tiered_content SET
      abstract = ?, overview = ?, openviking_uri_l0 = ?, openviking_uri_l1 = ?,
      l0_generated_at = ?, l1_generated_at = ?, importance = ?, updated_at = ?
    WHERE id = ?`,
    [
      update.abstract ?? existing.abstract,
      update.overview ?? existing.overview,
      update.openviking_uri_l0 ?? existing.openviking_uri_l0,
      update.openviking_uri_l1 ?? existing.openviking_uri_l1,
      update.l0_generated_at ?? existing.l0_generated_at,
      update.l1_generated_at ?? existing.l1_generated_at,
      update.importance ?? existing.importance,
      now, id
    ]
  );
  
  return getTieredContentById(id);
}

/**
 * Delete tiered content
 */
export function deleteTieredContent(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM tiered_content WHERE id = ?', [id]);
  
  return result.changes > 0;
}