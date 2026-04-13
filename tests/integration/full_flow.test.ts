/**
 * @file tests/integration/full_flow.test.ts
 * @description Full CRUD flow integration tests with audit logging
 * 
 * Requirements:
 * - Full flow test: Create → Read → Update → Delete
 * - Verify audit logs for each step
 * - Test sampling rate effect
 * - Test shutdown flush
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
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentsByScope,
  type DocumentRecord,
} from '../../src/sqlite/documents';
import {
  getAccessLogsByUser,
  getAccessLogsByMemory,
  logAccess,
} from '../../src/sqlite/access_log';
import {
  getLogBuffer,
  resetLogBuffer,
  LogBuffer,
} from '../../src/utils/log_buffer';
import {
  getAuditLogger,
  resetAuditLogger,
  AuditLogger,
  type AuditLogInput,
} from '../../src/utils/audit_logger';
import {
  registerShutdownHandlers,
  flushWithTimeout,
} from '../../src/utils/shutdown';
import { LogLevel } from '../../src/utils/logger';
import { generateUUID } from '../../src/utils/uuid';

describe('Full CRUD Flow Integration Tests', () => {
  let tempDbPath: string;
  let userId: string;

  beforeEach(() => {
    // Reset all singletons
    resetConnection();
    resetManager();
    resetLogBuffer();
    resetAuditLogger();

    // Create temp database path
    tempDbPath = join(tmpdir(), `test-fullflow-${Date.now()}.sqlite`);
    setDatabasePath(tempDbPath);

    // Run migrations
    runMigrations();

    // Set up test user ID
    userId = `user-fullflow-${generateUUID()}`;
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

  describe('T33: Full CRUD Flow', () => {
    it('should complete full Create → Read → Update → Delete flow', () => {
      const scope = { userId };

      // ========== CREATE ==========
      const docId = `doc-fullflow-${generateUUID()}`;
      const createdDoc = createDocument({
        id: docId,
        user_id: userId,
        doc_type: 'note',
        title: 'Full Flow Test Document',
        content: 'Initial content for full flow test',
      });

      expect(createdDoc.id).toBe(docId);
      expect(createdDoc.title).toBe('Full Flow Test Document');

      // Log create operation
      logAccess({
        user_id: userId,
        memory_type: 'documents',
        memory_id: docId,
        action: 'create',
        scope: JSON.stringify(scope),
        success: true,
      });

      // ========== READ ==========
      const readDoc = getDocumentById(docId);
      expect(readDoc).toBeDefined();
      expect(readDoc!.title).toBe('Full Flow Test Document');

      // Log read operation
      logAccess({
        user_id: userId,
        memory_type: 'documents',
        memory_id: docId,
        action: 'read',
        scope: JSON.stringify(scope),
        success: true,
      });

      // ========== UPDATE ==========
      const updatedDoc = updateDocument(docId, {
        title: 'Updated Full Flow Test Document',
        content: 'Updated content after modification',
      });

      expect(updatedDoc).toBeDefined();
      expect(updatedDoc!.title).toBe('Updated Full Flow Test Document');

      // Log update operation
      logAccess({
        user_id: userId,
        memory_type: 'documents',
        memory_id: docId,
        action: 'update',
        scope: JSON.stringify(scope),
        success: true,
      });

      // ========== DELETE ==========
      const deleted = deleteDocument(docId);
      expect(deleted).toBe(true);

      // Verify document no longer exists
      const deletedDoc = getDocumentById(docId);
      expect(deletedDoc).toBeNull();

      // Log delete operation
      logAccess({
        user_id: userId,
        memory_type: 'documents',
        memory_id: docId,
        action: 'delete',
        scope: JSON.stringify(scope),
        success: true,
      });

      // ========== AUDIT VERIFICATION ==========
      const logs = getAccessLogsByMemory('documents', docId);
      expect(logs.length).toBe(4); // create, read, update, delete

      const actions = logs.map(l => l.action);
      expect(actions).toContain('create');
      expect(actions).toContain('read');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');

      // All logs should be successful
      for (const log of logs) {
        expect(Boolean(log.success)).toBe(true);
        expect(log.user_id).toBe(userId);
      }
    });

    it('should log failed operations correctly', () => {
      const docId = `doc-nonexistent-${generateUUID()}`;

      // Try to read non-existent document
      const doc = getDocumentById(docId);
      expect(doc).toBeNull();

      // Log failed read
      logAccess({
        user_id: userId,
        memory_type: 'documents',
        memory_id: docId,
        action: 'read',
        scope: JSON.stringify({ userId }),
        success: false,
        reason: 'Document not found',
      });

      // Try to update non-existent document
      const updated = updateDocument(docId, { title: 'Should fail' });
      expect(updated).toBeUndefined();

      // Log failed update
      logAccess({
        user_id: userId,
        memory_type: 'documents',
        memory_id: docId,
        action: 'update',
        scope: JSON.stringify({ userId }),
        success: false,
        reason: 'Document not found',
      });

      // Try to delete non-existent document
      const deleted = deleteDocument(docId);
      expect(deleted).toBe(false);

      // Log failed delete
      logAccess({
        user_id: userId,
        memory_type: 'documents',
        memory_id: docId,
        action: 'delete',
        scope: JSON.stringify({ userId }),
        success: false,
        reason: 'Document not found',
      });

      // Verify all failures logged
      const logs = getAccessLogsByMemory('documents', docId);
      expect(logs.length).toBe(3);

      for (const log of logs) {
        expect(Boolean(log.success)).toBe(false);
        expect(log.reason).toBe('Document not found');
      }
    });

    it('should handle multiple CRUD operations with audit trail', () => {
      // Create 5 documents
      const docIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const docId = `doc-multi-${generateUUID()}`;
        createDocument({
          id: docId,
          user_id: userId,
          doc_type: 'note',
          title: `Multi Doc ${i}`,
          content: `Content ${i}`,
        });

        logAccess({
          user_id: userId,
          memory_type: 'documents',
          memory_id: docId,
          action: 'create',
          scope: JSON.stringify({ userId }),
          success: true,
        });

        docIds.push(docId);
      }

      // Read all 5
      for (const docId of docIds) {
        const doc = getDocumentById(docId);
        expect(doc).toBeDefined();

        logAccess({
          user_id: userId,
          memory_type: 'documents',
          memory_id: docId,
          action: 'read',
          scope: JSON.stringify({ userId }),
          success: true,
        });
      }

      // Update all 5
      for (const docId of docIds) {
        updateDocument(docId, { title: `Updated Multi Doc` });

        logAccess({
          user_id: userId,
          memory_type: 'documents',
          memory_id: docId,
          action: 'update',
          scope: JSON.stringify({ userId }),
          success: true,
        });
      }

      // Delete all 5
      for (const docId of docIds) {
        deleteDocument(docId);

        logAccess({
          user_id: userId,
          memory_type: 'documents',
          memory_id: docId,
          action: 'delete',
          scope: JSON.stringify({ userId }),
          success: true,
        });
      }

      // Verify total logs (5 * 4 = 20)
      const allLogs = getAccessLogsByUser(userId);
      expect(allLogs.length).toBe(20);

      // Verify operation counts
      const createLogs = allLogs.filter(l => l.action === 'create');
      const readLogs = allLogs.filter(l => l.action === 'read');
      const updateLogs = allLogs.filter(l => l.action === 'update');
      const deleteLogs = allLogs.filter(l => l.action === 'delete');

      expect(createLogs.length).toBe(5);
      expect(readLogs.length).toBe(5);
      expect(updateLogs.length).toBe(5);
      expect(deleteLogs.length).toBe(5);
    });
  });

  describe('Audit Logger Integration', () => {
    it('should audit via AuditLogger and write to SQLite', async () => {
      // Create AuditLogger with full sampling
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });

      // Get the singleton buffer and set flush handler
      const buffer = getLogBuffer();
      buffer.setFlushHandler(async (entries) => {
        for (const entry of entries) {
          if (entry.metadata) {
            const meta = entry.metadata as {
              userId: string;
              agentId?: string;
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

      // Log via AuditLogger
      const docId = `doc-audit-${generateUUID()}`;

      // Create document
      createDocument({
        id: docId,
        user_id: userId,
        doc_type: 'note',
        title: 'Audit Test Doc',
        content: 'Content',
      });

      logger.log({
        userId: userId,
        memoryType: 'document',
        memoryId: docId,
        action: 'create',
        scope: { agentId: undefined, teamId: undefined },
        success: true,
      });

      // Flush buffer
      await buffer.flush();

      // Verify in SQLite
      const logs = getAccessLogsByMemory('document', docId);
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('create');
      expect(Boolean(logs[0].success)).toBe(true);
    });

    it('should test sampling rate effect', async () => {
      // Create logger with 0.5 sampling rate
      const logger50 = new AuditLogger({ enabled: true, samplingRate: 0.5 });

      // Log 100 operations - expect ~50 in database
      for (let i = 0; i < 100; i++) {
        logger50.log({
          userId: userId,
          memoryType: 'document',
          memoryId: `doc-sampling-${i}`,
          action: 'create',
          scope: {},
          success: true,
        });
      }

      const buffer = getLogBuffer();
      const stats = buffer.getStats();

      // Should have roughly 50% (between 30-70 due to randomness)
      expect(stats.queued).toBeGreaterThanOrEqual(30);
      expect(stats.queued).toBeLessThanOrEqual(70);
    });

    it('should test sampling rate 0.0 (no logs)', async () => {
      const logger0 = new AuditLogger({ enabled: true, samplingRate: 0.0 });

      // Log 100 operations - expect 0 in queue
      for (let i = 0; i < 100; i++) {
        logger0.log({
          userId: userId,
          memoryType: 'document',
          memoryId: `doc-sampling-zero-${i}`,
          action: 'create',
          scope: {},
          success: true,
        });
      }

      const buffer = getLogBuffer();
      const stats = buffer.getStats();

      expect(stats.queued).toBe(0);
    });

    it('should test sampling rate 1.0 (all logs)', async () => {
      const logger100 = new AuditLogger({ enabled: true, samplingRate: 1.0 });

      // Log 100 operations - expect all 100 in queue
      for (let i = 0; i < 100; i++) {
        logger100.log({
          userId: userId,
          memoryType: 'document',
          memoryId: `doc-sampling-full-${i}`,
          action: 'create',
          scope: {},
          success: true,
        });
      }

      const buffer = getLogBuffer();
      const stats = buffer.getStats();

      expect(stats.queued).toBe(100);
    });
  });

  describe('Shutdown Flush', () => {
    it('should flush all pending entries on shutdown', async () => {
      // Create buffer with flush handler
      const buffer = new LogBuffer({
        bufferSize: 500,
        flushIntervalMs: 5000,
        shutdownTimeoutMs: 2000,
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

      // Enqueue 50 entries
      for (let i = 0; i < 50; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `Shutdown test ${i}`,
          timestamp: Date.now(),
          metadata: {
            userId: userId,
            memoryType: 'document',
            memoryId: `doc-shutdown-${i}`,
            action: 'create',
            scope: JSON.stringify({}),
            timestamp: Math.floor(Date.now() / 1000),
            success: true,
          },
        });
      }

      // Verify pending
      const statsBefore = buffer.getStats();
      expect(statsBefore.pending).toBe(50);

      // Trigger shutdown
      const result = await buffer.shutdown();

      expect(result.flushed).toBe(50);
      expect(result.dropped).toBe(0);
      expect(result.timeout).toBe(false);

      // Verify all in SQLite
      const logs = getAccessLogsByUser(userId);
      expect(logs.length).toBe(50);
    });

    it('should handle flushWithTimeout for shutdown', async () => {
      // Create buffer and add entries
      const buffer = getLogBuffer();

      // Set flush handler to write to SQLite
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

      // Add entries
      for (let i = 0; i < 30; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `Timeout test ${i}`,
          timestamp: Date.now(),
          metadata: {
            userId: userId,
            memoryType: 'document',
            memoryId: `doc-timeout-${i}`,
            action: 'create',
            scope: JSON.stringify({}),
            timestamp: Math.floor(Date.now() / 1000),
            success: true,
          },
        });
      }

      // Call flushWithTimeout
      const result = await flushWithTimeout(2000);

      expect(result.flushed).toBe(30);
      expect(result.dropped).toBe(0);
      expect(result.timeout).toBe(false);

      // Verify in SQLite
      const logs = getAccessLogsByUser(userId);
      expect(logs.length).toBe(30);
    });
  });

  describe('Scope Tracking', () => {
    it('should track agentId and teamId in scope', async () => {
      const buffer = new LogBuffer({
        bufferSize: 100,
        flushIntervalMs: 5000,
      });

      buffer.setFlushHandler(async (entries) => {
        for (const entry of entries) {
          if (entry.metadata) {
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
            };
            logAccess({
              user_id: meta.userId,
              agent_id: meta.agentId,
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

      // Log with full scope
      buffer.enqueue({
        level: LogLevel.INFO,
        message: 'Full scope test',
        timestamp: Date.now(),
        metadata: {
          userId: userId,
          agentId: 'agent-fullscope',
          teamId: 'team-fullscope',
          memoryType: 'document',
          memoryId: 'doc-scope',
          action: 'create',
          scope: JSON.stringify({ agentId: 'agent-fullscope', teamId: 'team-fullscope' }),
          timestamp: Math.floor(Date.now() / 1000),
          success: true,
        },
      });

      await buffer.flush();

      // Verify in SQLite
      const logs = getAccessLogsByMemory('document', 'doc-scope');
      expect(logs.length).toBe(1);
      expect(logs[0].agent_id).toBe('agent-fullscope');

      // Verify scope JSON
      const scopeObj = JSON.parse(logs[0].scope || '{}');
      expect(scopeObj.agentId).toBe('agent-fullscope');
      expect(scopeObj.teamId).toBe('team-fullscope');
    });
  });

  describe('Error Handling', () => {
    it('should log failed CRUD operations with reason', async () => {
      const buffer = new LogBuffer({
        bufferSize: 100,
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
              reason?: string;
            };
            logAccess({
              user_id: meta.userId,
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

      // Log failure
      buffer.enqueue({
        level: LogLevel.INFO,
        message: 'Failure test',
        timestamp: Date.now(),
        metadata: {
          userId: userId,
          memoryType: 'document',
          memoryId: 'doc-failure',
          action: 'delete',
          scope: JSON.stringify({}),
          timestamp: Math.floor(Date.now() / 1000),
          success: false,
          reason: 'Permission denied: user does not own this document',
        },
      });

      await buffer.flush();

      // Verify in SQLite
      const logs = getAccessLogsByMemory('document', 'doc-failure');
      expect(logs.length).toBe(1);
      expect(Boolean(logs[0].success)).toBe(false);
      expect(logs[0].reason).toBe('Permission denied: user does not own this document');
    });

    it('should handle empty flush gracefully', async () => {
      const buffer = new LogBuffer();

      const result = await buffer.flush();

      expect(result.flushed).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});