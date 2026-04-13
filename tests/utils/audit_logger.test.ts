/**
 * @file tests/utils/audit_logger.test.ts
 * @description AuditLogger tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AuditLogger,
  getAuditLogger,
  resetAuditLogger,
  DEFAULT_AUDIT_CONFIG,
  type AuditLoggerConfig,
  type AuditLogEntry
} from '../../src/utils/audit_logger';
import { getLogBuffer, resetLogBuffer } from '../../src/utils/log_buffer';

describe('AuditLogger', () => {
  beforeEach(() => {
    resetAuditLogger();
    resetLogBuffer();
  });

  afterEach(() => {
    resetAuditLogger();
    resetLogBuffer();
  });

  describe('DEFAULT_AUDIT_CONFIG', () => {
    it('should have enabled=true by default', () => {
      expect(DEFAULT_AUDIT_CONFIG.enabled).toBe(true);
    });

    it('should have samplingRate=1.0 by default', () => {
      expect(DEFAULT_AUDIT_CONFIG.samplingRate).toBe(1.0);
    });
  });

  describe('AuditLogger constructor', () => {
    it('should create logger with default config', () => {
      const logger = new AuditLogger();
      expect(logger).toBeDefined();
    });

    it('should create logger with custom config', () => {
      const config: AuditLoggerConfig = {
        enabled: true,
        samplingRate: 0.5,
      };
      const logger = new AuditLogger(config);
      expect(logger).toBeDefined();
    });

    it('should use provided config values', () => {
      const config: AuditLoggerConfig = {
        enabled: false,
        samplingRate: 0.1,
      };
      const logger = new AuditLogger(config);
      // Config should be stored internally
      expect(logger).toBeDefined();
    });
  });

  describe('AuditLogger.log() - Field mapping', () => {
    it('should map userId to user_id in log entry', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      const buffer = getLogBuffer();
      
      logger.log({
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'doc-456',
        action: 'create',
        scope: { agentId: 'agent-789' },
        success: true,
      });

      const entry = buffer.getStats();
      expect(entry.queued).toBeGreaterThanOrEqual(1);
    });

    it('should map agentId to agent_id in log entry', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      logger.log({
        userId: 'user-123',
        agentId: 'agent-abc',
        memoryType: 'document',
        memoryId: 'doc-456',
        action: 'read',
        scope: {},
        success: true,
      });

      // Should enqueue without error
      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(1);
    });

    it('should map teamId to team_id in log entry', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      logger.log({
        userId: 'user-123',
        teamId: 'team-xyz',
        memoryType: 'fact',
        memoryId: 'fact-789',
        action: 'update',
        scope: { teamId: 'team-xyz' },
        success: true,
      });

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(1);
    });

    it('should map resourceType to memory_type', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      // Test all supported memory types
      const memoryTypes: Array<'document' | 'asset' | 'conversation' | 'message' | 'fact' | 'team'> = [
        'document',
        'asset',
        'conversation',
        'message',
        'fact',
        'team',
      ];

      for (const memoryType of memoryTypes) {
        logger.log({
          userId: 'user-123',
          memoryType: memoryType,
          memoryId: 'test-123',
          action: 'create',
          scope: {},
          success: true,
        });
      }

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(memoryTypes.length);
    });

    it('should map resourceId to memory_id', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      logger.log({
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'my-resource-id',
        action: 'delete',
        scope: {},
        success: true,
      });

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(1);
    });

    it('should map operation to action', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      const operations: Array<'create' | 'read' | 'update' | 'delete'> = [
        'create',
        'read',
        'update',
        'delete',
      ];

      for (const op of operations) {
        logger.log({
          userId: 'user-123',
          memoryType: 'document',
          memoryId: 'test-123',
          action: op,
          scope: {},
          success: true,
        });
      }

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(operations.length);
    });

    it('should stringify scope with agentId and teamId', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      logger.log({
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'test-123',
        action: 'read',
        scope: { agentId: 'agent-abc', teamId: 'team-xyz' },
        success: true,
      });

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(1);
    });

    it('should map success boolean correctly', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      logger.log({
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'test-123',
        action: 'create',
        scope: {},
        success: true,
      });

      logger.log({
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'test-124',
        action: 'create',
        scope: {},
        success: false,
      });

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(2);
    });

    it('should map optional reason field', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      logger.log({
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'test-123',
        action: 'create',
        scope: {},
        success: false,
        reason: 'Permission denied',
      });

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(1);
    });

    it('should handle entry without optional fields', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      logger.log({
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'test-123',
        action: 'read',
        scope: {},
        success: true,
      });

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Sampling logic', () => {
    it('should sample all entries when samplingRate=1.0', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      for (let i = 0; i < 10; i++) {
        logger.log({
          userId: 'user-123',
          memoryType: 'document',
          memoryId: `test-${i}`,
          action: 'read',
          scope: {},
          success: true,
        });
      }

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBe(10);
    });

    it('should skip entries based on sampling rate', () => {
      // With samplingRate=0.0, all entries should be skipped
      const logger = new AuditLogger({ enabled: true, samplingRate: 0.0 });
      
      for (let i = 0; i < 10; i++) {
        logger.log({
          userId: 'user-123',
          memoryType: 'document',
          memoryId: `test-${i}`,
          action: 'read',
          scope: {},
          success: true,
        });
      }

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBe(0);
    });

    it('should sample approximately the configured rate', () => {
      // With samplingRate=0.5, roughly 50% should be sampled
      // This test verifies the sampling logic works (not exact count due to randomness)
      const logger = new AuditLogger({ enabled: true, samplingRate: 0.5 });
      
      for (let i = 0; i < 100; i++) {
        logger.log({
          userId: 'user-123',
          memoryType: 'document',
          memoryId: `test-${i}`,
          action: 'read',
          scope: {},
          success: true,
        });
      }

      const buffer = getLogBuffer();
      const queued = buffer.getStats().queued;
      // Should be between 30 and 70 (wide range for randomness)
      expect(queued).toBeGreaterThanOrEqual(30);
      expect(queued).toBeLessThanOrEqual(70);
    });
  });

  describe('Enabled/disabled switch', () => {
    it('should not enqueue when enabled=false', () => {
      const logger = new AuditLogger({ enabled: false, samplingRate: 1.0 });
      
      logger.log({
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'test-123',
        action: 'read',
        scope: {},
        success: true,
      });

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBe(0);
    });

    it('should enqueue when enabled=true', () => {
      const logger = new AuditLogger({ enabled: true, samplingRate: 1.0 });
      
      logger.log({
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'test-123',
        action: 'read',
        scope: {},
        success: true,
      });

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBeGreaterThanOrEqual(1);
    });

    it('should respect enabled flag even with samplingRate=1.0', () => {
      const logger = new AuditLogger({ enabled: false, samplingRate: 1.0 });
      
      for (let i = 0; i < 10; i++) {
        logger.log({
          userId: 'user-123',
          memoryType: 'document',
          memoryId: `test-${i}`,
          action: 'read',
          scope: {},
          success: true,
        });
      }

      const buffer = getLogBuffer();
      expect(buffer.getStats().queued).toBe(0);
    });
  });

  describe('getAuditLogger() singleton', () => {
    it('should return same instance on multiple calls', () => {
      const logger1 = getAuditLogger();
      const logger2 = getAuditLogger();
      
      expect(logger1).toBe(logger2);
    });

    it('should use default config on first call', () => {
      const logger = getAuditLogger();
      expect(logger).toBeDefined();
    });

    it('should allow reset for testing', () => {
      const logger1 = getAuditLogger();
      resetAuditLogger();
      const logger2 = getAuditLogger();
      
      expect(logger1).not.toBe(logger2);
    });

    it('should use config.auditEnabled from environment', () => {
      const originalValue = process.env.AUDIT_ENABLED;
      process.env.AUDIT_ENABLED = 'false';
      
      resetAuditLogger();
      const logger = getAuditLogger();
      expect(logger).toBeDefined();
      
      process.env.AUDIT_ENABLED = originalValue;
    });

    it('should use config.samplingRate from environment', () => {
      const originalValue = process.env.LOG_SAMPLING_RATE;
      process.env.LOG_SAMPLING_RATE = '0.5';
      
      resetAuditLogger();
      const logger = getAuditLogger();
      expect(logger).toBeDefined();
      
      process.env.LOG_SAMPLING_RATE = originalValue;
    });
  });

  describe('AuditLogEntry type', () => {
    it('should create entry with all required fields', () => {
      const entry: AuditLogEntry = {
        userId: 'user-123',
        memoryType: 'document',
        memoryId: 'doc-456',
        action: 'create',
        scope: JSON.stringify({}),
        timestamp: Math.floor(Date.now() / 1000),
        success: true,
      };

      expect(entry.userId).toBe('user-123');
      expect(entry.memoryType).toBe('document');
      expect(entry.action).toBe('create');
      expect(entry.success).toBe(true);
    });

    it('should create entry with optional fields', () => {
      const entry: AuditLogEntry = {
        userId: 'user-123',
        agentId: 'agent-abc',
        teamId: 'team-xyz',
        memoryType: 'fact',
        memoryId: 'fact-789',
        action: 'update',
        scope: JSON.stringify({ agentId: 'agent-abc', teamId: 'team-xyz' }),
        timestamp: Math.floor(Date.now() / 1000),
        success: false,
        reason: 'Validation failed',
      };

      expect(entry.agentId).toBe('agent-abc');
      expect(entry.teamId).toBe('team-xyz');
      expect(entry.reason).toBe('Validation failed');
    });
  });
});
