/**
 * @file src/sqlite/memory_index.ts
 * @description Memory index table CRUD operations
 */

import { getConnection } from './connection';
import { Scope } from '../core/types';

/**
 * Memory index record type
 */
export interface MemoryIndexRecord {
  id: number;
  uri: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global: boolean;
  target_type: string;
  target_id: string;
  title: string;
  description?: string;
  topic?: string;
  entity?: string;
  category?: string;
  tags?: string;
  importance: number;
  path?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Memory index creation input
 */
export interface MemoryIndexInput {
  uri: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global?: boolean;
  target_type: string;
  target_id: string;
  title: string;
  description?: string;
  topic?: string;
  entity?: string;
  category?: string;
  tags?: string;
  importance?: number;
  path?: string;
}

/**
 * Memory index update input
 */
export interface MemoryIndexUpdate {
  title?: string;
  description?: string;
  topic?: string;
  entity?: string;
  category?: string;
  tags?: string;
  importance?: number;
}

/**
 * Search filter
 */
export interface MemoryIndexSearchFilter {
  topic?: string;
  entity?: string;
  category?: string;
  importance_min?: number;
}

/**
 * Create memory index
 */
export function createMemoryIndex(input: MemoryIndexInput): MemoryIndexRecord {
  const db = getConnection();
  const now = Math.floor(Date.now() / 1000);
  const importance = input.importance ?? 0.5;
  const isGlobal = input.is_global ?? false;
  
  db.run(
    `INSERT INTO memory_index (
      uri, user_id, agent_id, team_id, is_global, target_type, target_id,
      title, description, topic, entity, category, tags, importance, path,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uri, input.user_id, input.agent_id ?? null, input.team_id ?? null,
      isGlobal, input.target_type, input.target_id,
      input.title, input.description ?? null, input.topic ?? null,
      input.entity ?? null, input.category ?? null, input.tags ?? null,
      importance, input.path ?? null, now, now
    ]
  );
  
  return db.queryOne<MemoryIndexRecord>(
    'SELECT * FROM memory_index WHERE uri = ?',
    [input.uri]
  )!;
}

/**
 * Get memory index by URI
 */
export function getMemoryIndexByURI(uri: string): MemoryIndexRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<MemoryIndexRecord>(
    'SELECT * FROM memory_index WHERE uri = ?',
    [uri]
  );
}

/**
 * Get memory indexes by scope
 */
export function getMemoryIndexesByScope(scope: Scope): MemoryIndexRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM memory_index WHERE user_id = ?';
  const params: string[] = [scope.userId];
  
  if (scope.agentId) {
    sql += ' AND agent_id = ?';
    params.push(scope.agentId);
  }
  
  if (scope.teamId) {
    sql += ' AND team_id = ?';
    params.push(scope.teamId);
  }
  
  return db.query<MemoryIndexRecord>(sql, params);
}

/**
 * Get memory indexes by target
 */
export function getMemoryIndexesByTarget(targetType: string, targetId: string): MemoryIndexRecord[] {
  const db = getConnection();
  
  return db.query<MemoryIndexRecord>(
    'SELECT * FROM memory_index WHERE target_type = ? AND target_id = ?',
    [targetType, targetId]
  );
}

/**
 * Update memory index
 */
export function updateMemoryIndex(uri: string, update: MemoryIndexUpdate): MemoryIndexRecord | undefined {
  const db = getConnection();
  const existing = getMemoryIndexByURI(uri);
  
  if (!existing) return undefined;
  
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `UPDATE memory_index SET
      title = ?, description = ?, topic = ?, entity = ?, category = ?,
      tags = ?, importance = ?, updated_at = ?
    WHERE uri = ?`,
    [
      update.title ?? existing.title,
      update.description ?? existing.description,
      update.topic ?? existing.topic,
      update.entity ?? existing.entity,
      update.category ?? existing.category,
      update.tags ?? existing.tags,
      update.importance ?? existing.importance,
      now, uri
    ]
  );
  
  return getMemoryIndexByURI(uri);
}

/**
 * Delete memory index
 */
export function deleteMemoryIndex(uri: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM memory_index WHERE uri = ?', [uri]);
  
  return result.changes > 0;
}

/**
 * Delete memory index by target
 */
export function deleteMemoryIndexByTarget(targetType: string, targetId: string): number {
  const db = getConnection();
  
  const result = db.run(
    'DELETE FROM memory_index WHERE target_type = ? AND target_id = ?',
    [targetType, targetId]
  );
  
  return result.changes;
}

/**
 * Search memory index
 */
export function searchMemoryIndex(filter: MemoryIndexSearchFilter): MemoryIndexRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM memory_index WHERE 1=1';
  const params: unknown[] = [];
  
  if (filter.topic) {
    sql += ' AND topic = ?';
    params.push(filter.topic);
  }
  
  if (filter.entity) {
    sql += ' AND entity = ?';
    params.push(filter.entity);
  }
  
  if (filter.category) {
    sql += ' AND category = ?';
    params.push(filter.category);
  }
  
  if (filter.importance_min) {
    sql += ' AND importance >= ?';
    params.push(filter.importance_min);
  }
  
  sql += ' ORDER BY importance DESC';
  
  return db.query<MemoryIndexRecord>(sql, params);
}