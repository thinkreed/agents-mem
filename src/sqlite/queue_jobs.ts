/**
 * @file src/sqlite/queue_jobs.ts
 * @description Queue jobs table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';

/**
 * Queue job record from database
 */
export interface QueueJobRecord {
  id: string;
  type: string;
  status: string;
  payload: string;
  retries: number;
  result_data?: string;
  error?: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Queue job input for creation
 */
export interface CreateQueueJobInput {
  id?: string;
  type: string;
  payload: string;
  retries?: number;
  result_data?: string;
  error?: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
}

/**
 * Job status update
 */
export interface UpdateJobStatusInput {
  status: string;
  retries?: number;
  result_data?: string;
  error?: string;
}

/**
 * Create a new queue job
 */
export function createQueueJob(input: CreateQueueJobInput): QueueJobRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `INSERT INTO queue_jobs (
      id, type, status, payload, retries, result_data, error,
      user_id, agent_id, team_id, created_at, updated_at
    ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.payload,
      input.retries ?? 0,
      input.result_data ?? null,
      input.error ?? null,
      input.user_id,
      input.agent_id ?? null,
      input.team_id ?? null,
      now,
      now
    ]
  );
  
  return {
    id,
    type: input.type,
    status: 'pending',
    payload: input.payload,
    retries: input.retries ?? 0,
    result_data: input.result_data,
    error: input.error,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    created_at: now,
    updated_at: now
  };
}

/**
 * Get job by ID
 */
export function getJobById(id: string): QueueJobRecord | null {
  const db = getConnection();
  
  const result = db.queryOne<QueueJobRecord>(
    'SELECT * FROM queue_jobs WHERE id = ?',
    [id]
  );
  
  return result ?? null;
}

/**
 * Get all pending jobs
 */
export function getPendingJobs(): QueueJobRecord[] {
  const db = getConnection();
  
  return db.query<QueueJobRecord>(
    "SELECT * FROM queue_jobs WHERE status = 'pending' ORDER BY created_at ASC"
  );
}

/**
 * Get jobs by status
 */
export function getJobsByStatus(status: string): QueueJobRecord[] {
  const db = getConnection();
  
  return db.query<QueueJobRecord>(
    'SELECT * FROM queue_jobs WHERE status = ? ORDER BY created_at ASC',
    [status]
  );
}

/**
 * Update job status
 */
export function updateJobStatus(
  id: string,
  status: string,
  retries?: number,
  resultData?: string,
  error?: string
): boolean {
  const db = getConnection();
  const now = Math.floor(Date.now() / 1000);
  
  const result = db.run(
    `UPDATE queue_jobs 
     SET status = ?, retries = COALESCE(?, retries), 
         result_data = ?, error = ?, updated_at = ?
     WHERE id = ?`,
    [
      status,
      retries ?? null,
      resultData ?? null,
      error ?? null,
      now,
      id
    ]
  );
  
  return result.changes > 0;
}

/**
 * Delete job by ID
 */
export function deleteJob(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM queue_jobs WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * Clear old completed jobs before timestamp
 */
export function clearOldCompletedJobs(beforeTimestamp: number): number {
  const db = getConnection();
  
  const result = db.run(
    "DELETE FROM queue_jobs WHERE status = 'completed' AND updated_at < ?",
    [beforeTimestamp]
  );
  
  return result.changes;
}

/**
 * Get jobs by user ID
 */
export function getJobsByUserId(userId: string): QueueJobRecord[] {
  const db = getConnection();
  
  return db.query<QueueJobRecord>(
    'SELECT * FROM queue_jobs WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
}

/**
 * Get jobs by type
 */
export function getJobsByType(type: string): QueueJobRecord[] {
  const db = getConnection();
  
  return db.query<QueueJobRecord>(
    'SELECT * FROM queue_jobs WHERE type = ? ORDER BY created_at DESC',
    [type]
  );
}

// ============================================================================
// Aliases for existing queue consumer (embedding_queue.ts)
// ============================================================================

/**
 * Alias for createQueueJob - for backward compatibility
 */
export function createJob(input: CreateQueueJobInput): QueueJobRecord {
  return createQueueJob(input);
}

/**
 * Alias for getJobById - for backward compatibility
 */
export function getJob(id: string): QueueJobRecord | null {
  return getJobById(id);
}

/**
 * Update job (alias for updateJobStatus)
 */
export function updateJob(
  id: string,
  status: string,
  retries?: number,
  resultData?: string,
  error?: string
): boolean {
  return updateJobStatus(id, status, retries, resultData, error);
}