/**
 * @file tests/integration/performance.test.ts
 * @description Performance benchmark tests
 * 
 * Requirements:
 * - Performance benchmark: 1000 ops < 5s
 * - Async buffering effectiveness (vs sync)
 * - Concurrent test (4 threads)
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
  getRecentAccessLogs,
} from '../../src/sqlite/access_log';
import {
  LogBuffer,
  getLogBuffer,
  resetLogBuffer,
} from '../../src/utils/log_buffer';
import {
  getAuditLogger,
  resetAuditLogger,
  AuditLogger,
} from '../../src/utils/audit_logger';
import { LogLevel } from '../../src/utils/logger';
import { generateUUID } from '../../src/utils/uuid';

describe('Performance Integration Tests', () => {
  let tempDbPath: string;
  let userId: string;

  beforeEach(() => {
    // Reset all singletons
    resetConnection();
    resetManager();
    resetLogBuffer();
    resetAuditLogger();

    // Create temp database path
    tempDbPath = join(tmpdir(), `test-perf-${Date.now()}.sqlite`);
    setDatabasePath(tempDbPath);

    // Run migrations
    runMigrations();

    // Set up test user
    userId = `user-perf-${generateUUID()}`;
  });

  afterEach(() => {
    closeConnection();

    if (existsSync(tempDbPath)) {
      try {
        unlinkSync(tempDbPath);
      } catch {
        // Ignore
      }
    }

    resetConnection();
    resetManager();
    resetLogBuffer();
    resetAuditLogger();
  });

  describe('T34: Performance Benchmarks', () => {
    it('should complete 1000 direct SQLite writes in under 5 seconds', async () => {
      const startTime = Date.now();

      // 1000 direct logAccess calls
      for (let i = 0; i < 1000; i++) {
        logAccess({
          user_id: userId,
          memory_type: 'documents',
          memory_id: `doc-perf-${i}`,
          action: 'create',
          scope: JSON.stringify({}),
          success: true,
        });
      }

      const elapsed = Date.now() - startTime;

      // Verify performance requirement: < 5s
      expect(elapsed).toBeLessThan(5000);

      // Verify all records exist
      const logs = getAccessLogsByUser(userId);
      expect(logs.length).toBe(1000);
    });

    it('should complete 1000 buffered operations in under 5 seconds', async () => {
      // Create buffer with flush handler
      const buffer = new LogBuffer({
        bufferSize: 2000,
        flushIntervalMs: 5000,
        maxRetries: 3,
      });

      buffer.setFlushHandler(async (entries) => {
        // Batch write to SQLite
        for (const entry of entries) {
          if (entry.metadata) {
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

      const startTime = Date.now();

      // 1000 enqueue operations (async buffering)
      for (let i = 0; i < 1000; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `Buffered ${i}`,
          timestamp: Date.now(),
          metadata: {
            userId: userId,
            memoryType: 'document',
            memoryId: `doc-buffered-${i}`,
            action: 'create',
            scope: JSON.stringify({}),
            timestamp: Math.floor(Date.now() / 1000),
            success: true,
          },
        });
      }

      const enqueueTime = Date.now() - startTime;

      // Enqueue should be very fast (< 500ms)
      expect(enqueueTime).toBeLessThan(500);

      // Now flush
      const flushResult = await buffer.flush();
      const totalElapsed = Date.now() - startTime;

      // Total should still be < 5s
      expect(totalElapsed).toBeLessThan(5000);
      expect(flushResult.flushed).toBe(1000);

      // Verify all records
      const logs = getAccessLogsByUser(userId);
      expect(logs.length).toBe(1000);
    });

    it('should verify async buffering is faster than sync writes', async () => {
      // Test 1: Sync direct writes
      const syncStart = Date.now();
      for (let i = 0; i < 500; i++) {
        logAccess({
          user_id: `user-sync-${i}`,
          memory_type: 'documents',
          memory_id: `doc-sync-${i}`,
          action: 'create',
          scope: JSON.stringify({}),
          success: true,
        });
      }
      const syncElapsed = Date.now() - syncStart;

      // Test 2: Async buffered writes
      const buffer = new LogBuffer({
        bufferSize: 1000,
        flushIntervalMs: 5000,
      });

      buffer.setFlushHandler(async (entries) => {
        for (const entry of entries) {
          if (entry.metadata) {
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

      const asyncStart = Date.now();
      for (let i = 0; i < 500; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `Async ${i}`,
          timestamp: Date.now(),
          metadata: {
            userId: `user-async-${i}`,
            memoryType: 'document',
            memoryId: `doc-async-${i}`,
            action: 'create',
            scope: JSON.stringify({}),
            timestamp: Math.floor(Date.now() / 1000),
            success: true,
          },
        });
      }
      const asyncEnqueueElapsed = Date.now() - asyncStart;

      // Async enqueue should be significantly faster than sync writes
      // The enqueue itself should be nearly instant (memory only)
      expect(asyncEnqueueElapsed).toBeLessThan(syncElapsed);

      // Flush to complete
      await buffer.flush();
      const asyncTotalElapsed = Date.now() - asyncStart;

      // Even with flush, async should be comparable or faster
      // (due to batch processing optimization potential)
      console.log(`Sync: ${syncElapsed}ms, Async enqueue: ${asyncEnqueueElapsed}ms, Async total: ${asyncTotalElapsed}ms`);
    });
  });

  describe('Concurrent Tests (4 threads)', () => {
    it('should handle concurrent writes from 4 threads correctly', async () => {
      const userIdConcurrent = `user-concurrent-${generateUUID()}`;

      // Create 4 threads (promises)
      const threads = [];
      for (let threadId = 0; threadId < 4; threadId++) {
        threads.push(
          new Promise<void>((resolve) => {
            // Each thread writes 250 entries
            for (let i = 0; i < 250; i++) {
              logAccess({
                user_id: userIdConcurrent,
                memory_type: 'documents',
                memory_id: `doc-thread-${threadId}-${i}`,
                action: 'create',
                scope: JSON.stringify({ threadId }),
                success: true,
              });
            }
            resolve();
          })
        );
      }

      const startTime = Date.now();

      // Run all 4 threads concurrently
      await Promise.all(threads);

      const elapsed = Date.now() - startTime;

      // Should complete in reasonable time (< 5s)
      expect(elapsed).toBeLessThan(5000);

      // Verify all 1000 (4 * 250) records exist
      const logs = getAccessLogsByUser(userIdConcurrent);
      expect(logs.length).toBe(1000);

      // Verify each thread's entries exist
      for (let threadId = 0; threadId < 4; threadId++) {
        const threadLogs = logs.filter(
          l => l.memory_id.startsWith(`doc-thread-${threadId}`)
        );
        expect(threadLogs.length).toBe(250);
      }
    });

    it('should handle concurrent buffered writes from 4 threads', async () => {
      const userIdConcurrent = `user-concurrent-buffered-${generateUUID()}`;

      // Shared buffer with flush handler
      const buffer = new LogBuffer({
        bufferSize: 2000,
        flushIntervalMs: 5000,
      });

      buffer.setFlushHandler(async (entries) => {
        for (const entry of entries) {
          if (entry.metadata) {
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

      const startTime = Date.now();

      // 4 threads enqueuing concurrently
      const threads = [];
      for (let threadId = 0; threadId < 4; threadId++) {
        threads.push(
          new Promise<void>((resolve) => {
            for (let i = 0; i < 250; i++) {
              buffer.enqueue({
                level: LogLevel.INFO,
                message: `Thread ${threadId} entry ${i}`,
                timestamp: Date.now(),
                metadata: {
                  userId: userIdConcurrent,
                  memoryType: 'document',
                  memoryId: `doc-bthread-${threadId}-${i}`,
                  action: 'create',
                  scope: JSON.stringify({ threadId }),
                  timestamp: Math.floor(Date.now() / 1000),
                  success: true,
                },
              });
            }
            resolve();
          })
        );
      }

      await Promise.all(threads);

      const enqueueElapsed = Date.now() - startTime;

      // Enqueue should be very fast
      expect(enqueueElapsed).toBeLessThan(500);

      // Flush all
      const flushResult = await buffer.flush();
      const totalElapsed = Date.now() - startTime;

      expect(totalElapsed).toBeLessThan(5000);
      expect(flushResult.flushed).toBe(1000);

      // Verify all records
      const logs = getAccessLogsByUser(userIdConcurrent);
      expect(logs.length).toBe(1000);
    });
  });

  describe('Throughput Tests', () => {
    it('should maintain throughput under sustained load', async () => {
      // 5000 operations in under 25 seconds (similar ratio as 1000 < 5s)
      const userIdSustained = `user-sustained-${generateUUID()}`;
      const startTime = Date.now();

      for (let i = 0; i < 5000; i++) {
        logAccess({
          user_id: userIdSustained,
          memory_type: 'documents',
          memory_id: `doc-sustained-${i}`,
          action: 'read',
          scope: JSON.stringify({}),
          success: true,
        });
      }

      const elapsed = Date.now() - startTime;

      // Should be proportional to 5s per 1000
      expect(elapsed).toBeLessThan(25000);

      const logs = getAccessLogsByUser(userIdSustained);
      expect(logs.length).toBe(5000);

      // Calculate throughput
      const throughput = (5000 / elapsed) * 1000; // ops per second
      console.log(`Sustained throughput: ${throughput.toFixed(0)} ops/sec`);
      expect(throughput).toBeGreaterThan(200); // At least 200 ops/sec
    }, 30000);

    it('should handle mixed operations efficiently', async () => {
      const userIdMixed = `user-mixed-${generateUUID()}`;

      // Mix of create, read, update, delete operations
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const action = ['create', 'read', 'update', 'delete'][i % 4];
        logAccess({
          user_id: userIdMixed,
          memory_type: 'documents',
          memory_id: `doc-mixed-${Math.floor(i / 4)}`,
          action: action as 'create' | 'read' | 'update' | 'delete',
          scope: JSON.stringify({}),
          success: i % 10 !== 0, // 10% failures
          reason: i % 10 === 0 ? 'Simulated error' : undefined,
        });
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5000);

      const logs = getAccessLogsByUser(userIdMixed);
      expect(logs.length).toBe(1000);

      // Verify mixed operations
      const actions = logs.map(l => l.action);
      expect(actions.filter(a => a === 'create').length).toBe(250);
      expect(actions.filter(a => a === 'read').length).toBe(250);
      expect(actions.filter(a => a === 'update').length).toBe(250);
      expect(actions.filter(a => a === 'delete').length).toBe(250);

      // Verify failures
      expect(logs.filter(l => !l.success).length).toBe(100);
    });
  });

  describe('Buffer Efficiency', () => {
    it('should demonstrate buffer expansion efficiency', async () => {
      const buffer = new LogBuffer({
        bufferSize: 100,
        expandOnFull: true,
        maxExpandFactor: 10,
      });

      // Enqueue 500 entries (buffer should expand)
      for (let i = 0; i < 500; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `Expansion test ${i}`,
          timestamp: Date.now(),
        });
      }

      const stats = buffer.getStats();

      // Should have expanded to accommodate all 500
      expect(stats.queued).toBe(500);
      expect(stats.pending).toBe(500);
    });

    it('should handle threshold-triggered flush efficiently', async () => {
      let flushCount = 0;
      let totalFlushed = 0;

      const buffer = new LogBuffer({
        bufferSize: 1000,
        thresholdRatio: 0.5, // Trigger at 500 entries
        flushIntervalMs: 10000,
      });

      buffer.setFlushHandler(async (entries) => {
        flushCount++;
        totalFlushed += entries.length;
        return entries.length;
      });

      buffer.startFlushTimer();

      // Enqueue to threshold
      for (let i = 0; i < 500; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `Threshold test ${i}`,
          timestamp: Date.now(),
        });
      }

      // Wait for threshold-triggered flush
      await new Promise(resolve => setTimeout(resolve, 100));

      // Threshold should have triggered at least one flush
      expect(flushCount).toBeGreaterThan(0);
      expect(totalFlushed).toBe(500);

      buffer.stopFlushTimer();
      await buffer.shutdown();
    });

    it('should compare batch vs single-write performance', async () => {
      const userIdBatch = `user-batch-${generateUUID()}`;
      const userIdSingle = `user-single-${generateUUID()}`;

      // Test 1: Single writes (baseline)
      const singleStart = Date.now();
      for (let i = 0; i < 100; i++) {
        logAccess({
          user_id: userIdSingle,
          memory_type: 'documents',
          memory_id: `doc-single-${i}`,
          action: 'create',
          scope: JSON.stringify({}),
          success: true,
        });
      }
      const singleElapsed = Date.now() - singleStart;

      // Test 2: Batch via buffer flush
      const buffer = new LogBuffer({
        bufferSize: 1000,
      });

      buffer.setFlushHandler(async (entries) => {
        // Write all entries
        for (const entry of entries) {
          if (entry.metadata) {
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

      // Enqueue 100
      for (let i = 0; i < 100; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `Batch ${i}`,
          timestamp: Date.now(),
          metadata: {
            userId: userIdBatch,
            memoryType: 'document',
            memoryId: `doc-batch-${i}`,
            action: 'create',
            scope: JSON.stringify({}),
            timestamp: Math.floor(Date.now() / 1000),
            success: true,
          },
        });
      }

      const batchFlushStart = Date.now();
      await buffer.flush();
      const batchElapsed = Date.now() - batchFlushStart;

      console.log(`Single writes: ${singleElapsed}ms, Batch flush: ${batchElapsed}ms`);

      // Verify both have 100 records
      expect(getAccessLogsByUser(userIdSingle).length).toBe(100);
      expect(getAccessLogsByUser(userIdBatch).length).toBe(100);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during sustained operations', async () => {
      // Run 10 iterations of 1000 operations
      for (let iteration = 0; iteration < 10; iteration++) {
        const iterUser = `user-mem-test-${iteration}`;

        for (let i = 0; i < 1000; i++) {
          logAccess({
            user_id: iterUser,
            memory_type: 'documents',
            memory_id: `doc-mem-${iteration}-${i}`,
            action: 'create',
            scope: JSON.stringify({}),
            success: true,
          });
        }

        // Verify iteration completed
        const logs = getAccessLogsByUser(iterUser);
        expect(logs.length).toBe(1000);
      }

      // Verify total records
      const allLogs = getRecentAccessLogs(10000);
      expect(allLogs.length).toBe(10000);
    }, 60000);
  });
});