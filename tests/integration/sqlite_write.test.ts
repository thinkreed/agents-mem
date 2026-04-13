/**
 * @file tests/integration/sqlite_write.test.ts
 * @description Real SQLite access_log writes integration tests
 * 
 * Requirements:
 * - Use temp file-based database (NOT :memory:)
 * - No mocking of SQLite operations
 * - Verify flush writes to memory_access_log table
 * - Verify field correctness
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlinkSync, existsSync } from 'fs';
import {
  getConnection,
  closeConnection,
  resetConnection,
  setDatabasePath,
} from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import {
  logAccess,
  getAccessLogsByUser,
  getAccessLogsByMemory,
  getAccessLogsByTimeRange,
  getRecentAccessLogs,
  type AccessLogRecord,
} from '../../src/sqlite/access_log';
import {
  LogBuffer,
  getLogBuffer,
  resetLogBuffer,
  DEFAULT_BUFFER_CONFIG,
} from '../../src/utils/log_buffer';
import { LogLevel } from '../../src/utils/logger';

describe('SQLite Write Integration Tests', () => {
  let tempDbPath: string;

  beforeEach(() => {
    // Reset all singletons
    resetConnection();
    resetManager();
    resetLogBuffer();

    // Create temp database path (file-based, NOT :memory:)
    tempDbPath = join(tmpdir(), `test-integration-${Date.now()}.sqlite`);
    setDatabasePath(tempDbPath);

    // Run migrations to create tables
    runMigrations();
  });

  afterEach(() => {
    // Close connection
    closeConnection();

    // Delete temp database file
    if (existsSync(tempDbPath)) {
      try {
        unlinkSync(tempDbPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Reset singletons
    resetConnection();
    resetManager();
    resetLogBuffer();
  });

  describe('T32: Real SQLite Writes', () => {
    it('should verify temp database file exists after migrations', () => {
      // Connection should be open
      const db = getConnection();
      expect(db.isOpen()).toBe(true);

      // Database file should exist on disk (not in-memory)
      expect(existsSync(tempDbPath)).toBe(true);
    });

    it('should write access log directly to memory_access_log table', () => {
      // Log access directly via SQLite
      const log = logAccess({
        user_id: 'user-integration-1',
        memory_type: 'documents',
        memory_id: 'doc-int-1',
        action: 'create',
        success: true,
      });

      // Verify record was created
      expect(log.id).toBeGreaterThan(0);
      expect(log.user_id).toBe('user-integration-1');
      expect(log.memory_type).toBe('documents');
      expect(log.memory_id).toBe('doc-int-1');
      expect(log.action).toBe('create');
      expect(Boolean(log.success)).toBe(true);
    });

    it('should verify field correctness in database', () => {
      // Create log with all optional fields
      const log = logAccess({
        user_id: 'user-integration-2',
        agent_id: 'agent-int-2',
        memory_type: 'facts',
        memory_id: 'fact-int-2',
        action: 'update',
        scope: JSON.stringify({ agentId: 'agent-int-2', teamId: 'team-int-2' }),
        success: false,
        reason: 'Validation failed',
      });

      // Query directly from database to verify
      const db = getConnection();
      const records = db.query<AccessLogRecord>(
        'SELECT * FROM memory_access_log WHERE id = ?',
        [log.id]
      );

      expect(records.length).toBe(1);
      const record = records[0];

      // Verify all fields match
      expect(record.id).toBe(log.id);
      expect(record.user_id).toBe('user-integration-2');
      expect(record.agent_id).toBe('agent-int-2');
      expect(record.memory_type).toBe('facts');
      expect(record.memory_id).toBe('fact-int-2');
      expect(record.action).toBe('update');
      expect(record.scope).toBe(JSON.stringify({ agentId: 'agent-int-2', teamId: 'team-int-2' }));
      expect(Boolean(record.success)).toBe(false);
      expect(record.reason).toBe('Validation failed');
      expect(record.timestamp).toBeGreaterThan(0);
    });

    it('should flush LogBuffer entries to memory_access_log table', async () => {
      // Create a LogBuffer with a custom flush handler that writes to SQLite
      const buffer = new LogBuffer({
        bufferSize: 100,
        flushIntervalMs: 5000,
        maxRetries: 3,
      });

      // Set up flush handler that writes audit entries to access_log
      buffer.setFlushHandler(async (entries) => {
        for (const entry of entries) {
          if (entry.metadata && 'userId' in entry.metadata) {
            const meta = entry.metadata as {
              userId: string;
              agentId?: string;
              teamId?: string;
              memoryType: string;
              memoryId: string;
              action: string;
              scope: string;
              timestamp: number;
              success: boolean;
              reason?: string;
            };

            logAccess({
              user_id: meta.userId,
              agent_id: meta.agentId,
              memory_type: meta.memoryType,
              memory_id: meta.memoryId,
              action: meta.action,
              scope: meta.scope,
              success: meta.success,
              reason: meta.reason,
            });
          }
        }
        return entries.length;
      });

      // Enqueue audit entries
      for (let i = 0; i < 10; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `AUDIT: create documents/doc-${i}`,
          timestamp: Date.now(),
          metadata: {
            userId: 'user-integration-3',
            memoryType: 'documents',
            memoryId: `doc-int-${i}`,
            action: 'create',
            scope: JSON.stringify({}),
            timestamp: Math.floor(Date.now() / 1000),
            success: true,
          },
        });
      }

      // Verify entries are queued
      const statsBeforeFlush = buffer.getStats();
      expect(statsBeforeFlush.pending).toBe(10);

      // Flush to SQLite
      const result = await buffer.flush();

      expect(result.flushed).toBe(10);
      expect(result.failed).toBe(0);

      // Verify records exist in database
      const logs = getAccessLogsByUser('user-integration-3');
      expect(logs.length).toBe(10);

      // Verify each log entry
      for (const log of logs) {
        expect(log.user_id).toBe('user-integration-3');
        expect(log.memory_type).toBe('documents');
        expect(log.action).toBe('create');
        expect(Boolean(log.success)).toBe(true);
      }
    });

    it('should handle large batch flush correctly', async () => {
      const buffer = new LogBuffer({
        bufferSize: 1000,
        maxRetries: 3,
      });

      buffer.setFlushHandler(async (entries) => {
        for (const entry of entries) {
          if (entry.metadata && 'userId' in entry.metadata) {
            const meta = entry.metadata as {
              userId: string;
              memoryType: string;
              memoryId: string;
              action: string;
              scope: string;
              timestamp: number;
              success: boolean;
            };
            logAccess({
              user_id: meta.userId,
              memory_type: meta.memoryType,
              memory_id: meta.memoryId,
              action: meta.action,
              scope: meta.scope,
              success: meta.success,
            });
          }
        }
        return entries.length;
      });

      // Enqueue 100 entries
      for (let i = 0; i < 100; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `AUDIT: batch ${i}`,
          timestamp: Date.now(),
          metadata: {
            userId: 'user-batch-test',
            memoryType: 'documents',
            memoryId: `batch-${i}`,
            action: 'read',
            scope: JSON.stringify({}),
            timestamp: Math.floor(Date.now() / 1000),
            success: true,
          },
        });
      }

      const result = await buffer.flush();

      expect(result.flushed).toBe(100);

      // Verify all 100 records in database
      const logs = getAccessLogsByUser('user-batch-test');
      expect(logs.length).toBe(100);
    });

    it('should verify timestamp is Unix seconds (not milliseconds)', () => {
      const log = logAccess({
        user_id: 'user-timestamp-test',
        memory_type: 'documents',
        memory_id: 'doc-ts',
        action: 'read',
        success: true,
      });

      // Timestamp should be Unix seconds (reasonable range)
      const now = Math.floor(Date.now() / 1000);
      expect(log.timestamp).toBeLessThanOrEqual(now);
      expect(log.timestamp).toBeGreaterThanOrEqual(now - 10); // Within 10 seconds
    });
  });

  describe('Get Operations', () => {
    it('should get logs by user correctly', () => {
      // Create logs for multiple users
      logAccess({
        user_id: 'user-multi-1',
        memory_type: 'documents',
        memory_id: 'doc-1',
        action: 'create',
        success: true,
      });
      logAccess({
        user_id: 'user-multi-2',
        memory_type: 'documents',
        memory_id: 'doc-2',
        action: 'read',
        success: true,
      });
      logAccess({
        user_id: 'user-multi-1',
        memory_type: 'facts',
        memory_id: 'fact-1',
        action: 'update',
        success: false,
        reason: 'Test failure',
      });

      // Get logs for user-multi-1
      const logs = getAccessLogsByUser('user-multi-1');
      expect(logs.length).toBe(2);

      // Verify user filtering
      for (const log of logs) {
        expect(log.user_id).toBe('user-multi-1');
      }

      // Get logs for user-multi-2
      const logs2 = getAccessLogsByUser('user-multi-2');
      expect(logs2.length).toBe(1);
      expect(logs2[0].memory_type).toBe('documents');
    });

    it('should get logs by memory correctly', () => {
      // Create multiple operations on same memory
      logAccess({
        user_id: 'user-memory-test',
        memory_type: 'documents',
        memory_id: 'same-doc',
        action: 'create',
        success: true,
      });
      logAccess({
        user_id: 'user-memory-test',
        memory_type: 'documents',
        memory_id: 'same-doc',
        action: 'read',
        success: true,
      });
      logAccess({
        user_id: 'user-memory-test',
        memory_type: 'documents',
        memory_id: 'same-doc',
        action: 'update',
        success: true,
      });

      const logs = getAccessLogsByMemory('documents', 'same-doc');
      expect(logs.length).toBe(3);

      // Verify all operations
      const actions = logs.map(l => l.action);
      expect(actions).toContain('create');
      expect(actions).toContain('read');
      expect(actions).toContain('update');
    });

    it('should get logs by time range correctly', () => {
      const startTime = Math.floor(Date.now() / 1000);

      // Create logs
      logAccess({
        user_id: 'user-time-test',
        memory_type: 'documents',
        memory_id: 'doc-time-1',
        action: 'create',
        success: true,
      });

      const endTime = Math.floor(Date.now() / 1000) + 1;

      const logs = getAccessLogsByTimeRange(startTime - 10, endTime);
      expect(logs.length).toBeGreaterThan(0);

      // Verify time range filtering
      for (const log of logs) {
        expect(log.timestamp).toBeGreaterThanOrEqual(startTime - 10);
        expect(log.timestamp).toBeLessThanOrEqual(endTime);
      }
    });

    it('should get recent logs with limit', () => {
      // Create 50 logs
      for (let i = 0; i < 50; i++) {
        logAccess({
          user_id: 'user-recent-test',
          memory_type: 'documents',
          memory_id: `doc-recent-${i}`,
          action: 'create',
          success: true,
        });
      }

      // Get recent 10
      const logs = getRecentAccessLogs(10);
      expect(logs.length).toBe(10);

      // Get recent 20
      const logs20 = getRecentAccessLogs(20);
      expect(logs20.length).toBe(20);

      // Default limit (100)
      const logsDefault = getRecentAccessLogs();
      expect(logsDefault.length).toBeGreaterThan(0);
    });
  });

  describe('Database Integrity', () => {
    it('should maintain data integrity after multiple writes', () => {
      const userId = 'user-integrity-test';

      // Write 100 logs
      for (let i = 0; i < 100; i++) {
        logAccess({
          user_id: userId,
          memory_type: 'documents',
          memory_id: `doc-integrity-${i}`,
          action: 'create',
          success: i % 10 !== 0, // 10 failures
          reason: i % 10 === 0 ? 'Simulated failure' : undefined,
        });
      }

      // Verify total count
      const logs = getAccessLogsByUser(userId);
      expect(logs.length).toBe(100);

      // Verify success/failure count
      const successCount = logs.filter(l => Boolean(l.success)).length;
      const failureCount = logs.filter(l => !Boolean(l.success)).length;
      expect(successCount).toBe(90);
      expect(failureCount).toBe(10);

      // Verify all failure reasons
      const failureLogs = logs.filter(l => !l.success);
      for (const log of failureLogs) {
        expect(log.reason).toBe('Simulated failure');
      }
    });

    it('should handle concurrent writes correctly', async () => {
      const userId = 'user-concurrent-test';

      // Simulate concurrent writes (4 threads as per T34)
      const promises = [];
      for (let thread = 0; thread < 4; thread++) {
        promises.push(
          new Promise<void>((resolve) => {
            for (let i = 0; i < 25; i++) {
              logAccess({
                user_id: userId,
                memory_type: 'documents',
                memory_id: `doc-concurrent-${thread}-${i}`,
                action: 'create',
                success: true,
              });
            }
            resolve();
          })
        );
      }

      await Promise.all(promises);

      // Verify all 100 (4 * 25) records exist
      const logs = getAccessLogsByUser(userId);
      expect(logs.length).toBe(100);
    });
  });
});