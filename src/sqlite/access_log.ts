/**
 * @file src/sqlite/access_log.ts
 * @description Access log table operations
 */

import { getConnection } from './connection';

/**
 * Access log record type
 */
export interface AccessLogRecord {
  id: number;
  user_id: string;
  agent_id?: string;
  memory_type: string;
  memory_id: string;
  action: string;
  scope?: string;
  timestamp: number;
  success: boolean;
  reason?: string;
}

/**
 * Access log input
 */
export interface AccessLogInput {
  user_id: string;
  agent_id?: string;
  memory_type: string;
  memory_id: string;
  action: string;
  scope?: string;
  success: boolean;
  reason?: string;
}

/**
 * Log access
 */
export function logAccess(input: AccessLogInput): AccessLogRecord {
  const db = getConnection();
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `INSERT INTO memory_access_log (
      user_id, agent_id, memory_type, memory_id, action, scope, timestamp, success, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.user_id, input.agent_id ?? null, input.memory_type, input.memory_id,
      input.action, input.scope ?? null, now, input.success ? 1 : 0, input.reason ?? null
    ]
  );
  
  return {
    id: db.queryOne<{ id: number }>(
      'SELECT MAX(id) as id FROM memory_access_log'
    )!.id,
    user_id: input.user_id,
    agent_id: input.agent_id,
    memory_type: input.memory_type,
    memory_id: input.memory_id,
    action: input.action,
    scope: input.scope,
    timestamp: now,
    success: input.success,
    reason: input.reason
  };
}

/**
 * Get access logs by user
 */
export function getAccessLogsByUser(userId: string): AccessLogRecord[] {
  const db = getConnection();
  
  return db.query<AccessLogRecord>(
    'SELECT * FROM memory_access_log WHERE user_id = ? ORDER BY timestamp DESC',
    [userId]
  );
}

/**
 * Get access logs by memory
 */
export function getAccessLogsByMemory(memoryType: string, memoryId: string): AccessLogRecord[] {
  const db = getConnection();
  
  return db.query<AccessLogRecord>(
    'SELECT * FROM memory_access_log WHERE memory_type = ? AND memory_id = ? ORDER BY timestamp DESC',
    [memoryType, memoryId]
  );
}

/**
 * Get access logs by time range
 */
export function getAccessLogsByTimeRange(startTime: number, endTime: number): AccessLogRecord[] {
  const db = getConnection();
  
  return db.query<AccessLogRecord>(
    'SELECT * FROM memory_access_log WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
    [startTime, endTime]
  );
}

/**
 * Get recent access logs
 */
export function getRecentAccessLogs(limit: number = 100): AccessLogRecord[] {
  const db = getConnection();
  
  return db.query<AccessLogRecord>(
    'SELECT * FROM memory_access_log ORDER BY timestamp DESC LIMIT ?',
    [limit]
  );
}