/**
 * @file src/sqlite/facts.ts
 * @description Facts table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';
import { Scope } from '../core/types';
import { DEFAULT_IMPORTANCE, DEFAULT_CONFIDENCE } from '../core/constants';

/**
 * Fact record type
 */
export interface FactRecord {
  id: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global: boolean;
  source_type: string;
  source_id: string;
  source_uri?: string;
  content: string;
  fact_type: string;
  entities: string;
  importance: number;
  confidence: number;
  verified: boolean;
  openviking_uri?: string;
  extraction_mode?: string;
  extracted_at?: number;
  created_at: number;
  updated_at: number;
}

/**
 * Fact creation input
 */
export interface FactInput {
  id?: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global?: boolean;
  source_type: string;
  source_id: string;
  source_uri?: string;
  content: string;
  fact_type: string;
  entities: string;
  importance?: number;
  confidence?: number;
  verified?: boolean;
  openviking_uri?: string;
  extraction_mode?: string;
}

/**
 * Fact update input
 */
export interface FactUpdate {
  content?: string;
  importance?: number;
  confidence?: number;
  verified?: boolean;
  openviking_uri?: string;
}

/**
 * Fact search filter
 */
export interface FactSearchFilter {
  fact_type?: string;
  verified?: boolean;
  confidence_min?: number;
}

/**
 * Create fact
 */
export function createFact(input: FactInput): FactRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  const importance = input.importance ?? DEFAULT_IMPORTANCE;
  const confidence = input.confidence ?? DEFAULT_CONFIDENCE;
  const verified = input.verified ?? false;
  const isGlobal = input.is_global ?? false;
  
  db.run(
    `INSERT INTO facts (
      id, user_id, agent_id, team_id, is_global, source_type, source_id, source_uri,
      content, fact_type, entities, importance, confidence, verified, openviking_uri,
      extraction_mode, extracted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.user_id, input.agent_id ?? null, input.team_id ?? null,
      isGlobal, input.source_type, input.source_id, input.source_uri ?? null,
      input.content, input.fact_type, input.entities,
      importance, confidence, verified, input.openviking_uri ?? null,
      input.extraction_mode ?? null, null, now, now
    ]
  );
  
  return {
    id,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    is_global: isGlobal,
    source_type: input.source_type,
    source_id: input.source_id,
    source_uri: input.source_uri,
    content: input.content,
    fact_type: input.fact_type,
    entities: input.entities,
    importance,
    confidence,
    verified,
    openviking_uri: input.openviking_uri,
    extraction_mode: input.extraction_mode,
    created_at: now,
    updated_at: now
  };
}

/**
 * Get fact by ID
 */
export function getFactById(id: string): FactRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<FactRecord>(
    'SELECT * FROM facts WHERE id = ?',
    [id]
  );
}

/**
 * Get facts by scope
 */
export function getFactsByScope(scope: Scope): FactRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM facts WHERE user_id = ?';
  const params: string[] = [scope.userId];
  
  if (scope.agentId) {
    sql += ' AND agent_id = ?';
    params.push(scope.agentId);
  }
  
  if (scope.teamId) {
    sql += ' AND team_id = ?';
    params.push(scope.teamId);
  }
  
  return db.query<FactRecord>(sql + ' ORDER BY importance DESC', params);
}

/**
 * Get facts by source
 */
export function getFactsBySource(sourceType: string, sourceId: string): FactRecord[] {
  const db = getConnection();
  
  return db.query<FactRecord>(
    'SELECT * FROM facts WHERE source_type = ? AND source_id = ?',
    [sourceType, sourceId]
  );
}

/**
 * Update fact
 */
export function updateFact(id: string, update: FactUpdate): FactRecord | undefined {
  const db = getConnection();
  const existing = getFactById(id);
  
  if (!existing) return undefined;
  
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `UPDATE facts SET
      content = ?, importance = ?, confidence = ?, verified = ?, openviking_uri = ?, updated_at = ?
    WHERE id = ?`,
    [
      update.content ?? existing.content,
      update.importance ?? existing.importance,
      update.confidence ?? existing.confidence,
      update.verified ?? existing.verified,
      update.openviking_uri ?? existing.openviking_uri,
      now, id
    ]
  );
  
  return getFactById(id);
}

/**
 * Delete fact
 */
export function deleteFact(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM facts WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * Search facts
 */
export function searchFacts(filter: FactSearchFilter): FactRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM facts WHERE 1=1';
  const params: unknown[] = [];
  
  if (filter.fact_type) {
    sql += ' AND fact_type = ?';
    params.push(filter.fact_type);
  }
  
  if (filter.verified !== undefined) {
    sql += ' AND verified = ?';
    params.push(filter.verified ? 1 : 0);
  }
  
  if (filter.confidence_min) {
    sql += ' AND confidence >= ?';
    params.push(filter.confidence_min);
  }
  
  return db.query<FactRecord>(sql + ' ORDER BY importance DESC', params);
}