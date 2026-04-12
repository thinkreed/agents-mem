/**
 * @file src/sqlite/extraction_status.ts
 * @description Extraction status table CRUD operations
 */

import { getConnection } from './connection';

/**
 * Extraction status record type
 */
export interface ExtractionStatusRecord {
  id: number;
  target_type: string;
  target_id: string;
  status: string;
  extraction_mode?: string;
  facts_count: number;
  entities_count: number;
  started_at?: number;
  completed_at?: number;
  error_message?: string;
}

/**
 * Extraction status creation input
 */
export interface ExtractionStatusInput {
  target_type: string;
  target_id: string;
  extraction_mode?: string;
}

/**
 * Extraction status update input
 */
export interface ExtractionStatusUpdate {
  status?: string;
  facts_count?: number;
  entities_count?: number;
  started_at?: number;
  completed_at?: number;
  error_message?: string;
}

/**
 * Create extraction status
 */
export function createExtractionStatus(input: ExtractionStatusInput): ExtractionStatusRecord {
  const db = getConnection();
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `INSERT INTO extraction_status (
      target_type, target_id, status, extraction_mode, facts_count, entities_count, started_at
    ) VALUES (?, ?, 'pending', ?, 0, 0, ?)`,
    [input.target_type, input.target_id, input.extraction_mode ?? null, now]
  );
  
  return db.queryOne<ExtractionStatusRecord>(
    'SELECT * FROM extraction_status WHERE target_type = ? AND target_id = ?',
    [input.target_type, input.target_id]
  )!;
}

/**
 * Get extraction status by ID
 */
export function getExtractionStatus(id: number): ExtractionStatusRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<ExtractionStatusRecord>(
    'SELECT * FROM extraction_status WHERE id = ?',
    [id]
  );
}

/**
 * Get extraction status by target
 */
export function getExtractionStatusByTarget(targetType: string, targetId: string): ExtractionStatusRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<ExtractionStatusRecord>(
    'SELECT * FROM extraction_status WHERE target_type = ? AND target_id = ?',
    [targetType, targetId]
  );
}

/**
 * Update extraction status
 */
export function updateExtractionStatus(id: number, update: ExtractionStatusUpdate): ExtractionStatusRecord | undefined {
  const db = getConnection();
  const existing = getExtractionStatus(id);
  
  if (!existing) return undefined;
  
  db.run(
    `UPDATE extraction_status SET
      status = ?, facts_count = ?, entities_count = ?, started_at = ?, completed_at = ?, error_message = ?
    WHERE id = ?`,
    [
      update.status ?? existing.status,
      update.facts_count ?? existing.facts_count,
      update.entities_count ?? existing.entities_count,
      update.started_at ?? existing.started_at,
      update.completed_at ?? existing.completed_at,
      update.error_message ?? existing.error_message,
      id
    ]
  );
  
  return getExtractionStatus(id);
}

/**
 * Delete extraction status
 */
export function deleteExtractionStatus(id: number): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM extraction_status WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * Get pending extractions
 */
export function getPendingExtractions(): ExtractionStatusRecord[] {
  const db = getConnection();
  
  return db.query<ExtractionStatusRecord>(
    "SELECT * FROM extraction_status WHERE status = 'pending' ORDER BY id"
  );
}