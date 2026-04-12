/**
 * @file src/sqlite/entity_nodes.ts
 * @description Entity nodes table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';
import { Scope } from '../core/types';

/**
 * Entity node record type
 */
export interface EntityNodeRecord {
  id: string;
  parent_id?: string;
  depth: number;
  path?: string;
  child_count: number;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global: boolean;
  entity_name: string;
  aggregated_content?: string;
  threshold?: number;
  lance_id?: string;
  linked_fact_ids?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Entity node creation input
 */
export interface EntityNodeInput {
  id?: string;
  parent_id?: string;
  depth: number;
  path?: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global?: boolean;
  entity_name: string;
  aggregated_content?: string;
  threshold?: number;
  lance_id?: string;
  linked_fact_ids?: string;
}

/**
 * Entity node update input
 */
export interface EntityNodeUpdate {
  aggregated_content?: string;
  child_count?: number;
  threshold?: number;
  lance_id?: string;
  linked_fact_ids?: string;
}

/**
 * Create entity node
 */
export function createEntityNode(input: EntityNodeInput): EntityNodeRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  const isGlobal = input.is_global ?? false;
  
  db.run(
    `INSERT INTO entity_nodes (
      id, parent_id, depth, path, child_count, user_id, agent_id, team_id,
      is_global, entity_name, aggregated_content, threshold, lance_id, linked_fact_ids,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.parent_id ?? null, input.depth, input.path ?? null,
      input.user_id, input.agent_id ?? null, input.team_id ?? null,
      isGlobal, input.entity_name, input.aggregated_content ?? null,
      input.threshold ?? null, input.lance_id ?? null, input.linked_fact_ids ?? null,
      now, now
    ]
  );
  
  return {
    id,
    parent_id: input.parent_id,
    depth: input.depth,
    path: input.path,
    child_count: 0,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    is_global: isGlobal,
    entity_name: input.entity_name,
    aggregated_content: input.aggregated_content,
    threshold: input.threshold,
    lance_id: input.lance_id,
    linked_fact_ids: input.linked_fact_ids,
    created_at: now,
    updated_at: now
  };
}

/**
 * Get entity node by ID
 */
export function getEntityNodeById(id: string): EntityNodeRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<EntityNodeRecord>(
    'SELECT * FROM entity_nodes WHERE id = ?',
    [id]
  );
}

/**
 * Get child nodes by parent
 */
export function getEntityNodesByParent(parentId: string): EntityNodeRecord[] {
  const db = getConnection();
  
  return db.query<EntityNodeRecord>(
    'SELECT * FROM entity_nodes WHERE parent_id = ? ORDER BY entity_name',
    [parentId]
  );
}

/**
 * Get entity nodes by scope
 */
export function getEntityNodesByScope(scope: Scope): EntityNodeRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM entity_nodes WHERE user_id = ?';
  const params: string[] = [scope.userId];
  
  if (scope.agentId) {
    sql += ' AND agent_id = ?';
    params.push(scope.agentId);
  }
  
  if (scope.teamId) {
    sql += ' AND team_id = ?';
    params.push(scope.teamId);
  }
  
  return db.query<EntityNodeRecord>(sql + ' ORDER BY depth, entity_name', params);
}

/**
 * Get root nodes (depth = 0)
 */
export function getRootNodes(userId: string): EntityNodeRecord[] {
  const db = getConnection();
  
  return db.query<EntityNodeRecord>(
    'SELECT * FROM entity_nodes WHERE user_id = ? AND depth = 0 ORDER BY entity_name',
    [userId]
  );
}

/**
 * Update entity node
 */
export function updateEntityNode(id: string, update: EntityNodeUpdate): EntityNodeRecord | undefined {
  const db = getConnection();
  const existing = getEntityNodeById(id);
  
  if (!existing) return undefined;
  
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `UPDATE entity_nodes SET
      aggregated_content = ?, child_count = ?, threshold = ?, lance_id = ?, linked_fact_ids = ?, updated_at = ?
    WHERE id = ?`,
    [
      update.aggregated_content ?? existing.aggregated_content,
      update.child_count ?? existing.child_count,
      update.threshold ?? existing.threshold,
      update.lance_id ?? existing.lance_id,
      update.linked_fact_ids ?? existing.linked_fact_ids,
      now, id
    ]
  );
  
  return getEntityNodeById(id);
}

/**
 * Delete entity node
 */
export function deleteEntityNode(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM entity_nodes WHERE id = ?', [id]);
  
  return result.changes > 0;
}