/**
 * @file tests/sqlite/access_log.test.ts
 * @description Access log table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  logAccess,
  getAccessLogsByUser,
  getAccessLogsByMemory,
  getAccessLogsByTimeRange,
  getRecentAccessLogs,
  AccessLogRecord
} from '../../src/sqlite/access_log';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Access Log Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('logAccess', () => {
    it('should log successful access', () => {
      const log = logAccess({
        user_id: 'user-1',
        memory_type: 'documents',
        memory_id: 'doc-1',
        action: 'read',
        success: true
      });
      
      expect(log).toBeDefined();
      expect(log.user_id).toBe('user-1');
      expect(log.memory_type).toBe('documents');
      expect(log.action).toBe('read');
      expect(log.success).toBe(true);
    });

    it('should log failed access', () => {
      const log = logAccess({
        user_id: 'user-1',
        memory_type: 'facts',
        memory_id: 'fact-1',
        action: 'write',
        success: false,
        reason: 'Permission denied'
      });
      
      expect(log.success).toBe(false);
      expect(log.reason).toBe('Permission denied');
    });

    it('should set timestamp', () => {
      const log = logAccess({
        user_id: 'user-1',
        memory_type: 'documents',
        memory_id: 'doc-2',
        action: 'read',
        success: true
      });
      
      expect(log.timestamp).toBeDefined();
      expect(log.timestamp).toBeGreaterThan(0);
    });
  });

  describe('getAccessLogsByUser', () => {
    it('should get logs by user', () => {
      logAccess({
        user_id: 'user-1',
        memory_type: 'documents',
        memory_id: 'doc-3',
        action: 'read',
        success: true
      });
      logAccess({
        user_id: 'user-2',
        memory_type: 'documents',
        memory_id: 'doc-4',
        action: 'read',
        success: true
      });
      
      const logs = getAccessLogsByUser('user-1');
      
      expect(logs.length).toBe(1);
    });
  });

  describe('getAccessLogsByMemory', () => {
    it('should get logs by memory', () => {
      logAccess({
        user_id: 'user-1',
        memory_type: 'documents',
        memory_id: 'doc-5',
        action: 'read',
        success: true
      });
      logAccess({
        user_id: 'user-1',
        memory_type: 'documents',
        memory_id: 'doc-5',
        action: 'write',
        success: true
      });
      
      const logs = getAccessLogsByMemory('documents', 'doc-5');
      
      expect(logs.length).toBe(2);
    });
  });

  describe('getAccessLogsByTimeRange', () => {
    it('should get logs in time range', () => {
      const now = Math.floor(Date.now() / 1000);
      
      logAccess({
        user_id: 'user-1',
        memory_type: 'documents',
        memory_id: 'doc-6',
        action: 'read',
        success: true
      });
      
      const logs = getAccessLogsByTimeRange(now - 100, now + 100);
      
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('getRecentAccessLogs', () => {
    it('should get recent logs', () => {
      logAccess({
        user_id: 'user-1',
        memory_type: 'documents',
        memory_id: 'doc-7',
        action: 'read',
        success: true
      });
      logAccess({
        user_id: 'user-1',
        memory_type: 'documents',
        memory_id: 'doc-8',
        action: 'write',
        success: true
      });
      
      const logs = getRecentAccessLogs(10);
      
      expect(logs.length).toBe(2);
    });

    it('should limit results', () => {
      for (let i = 0; i < 20; i++) {
        logAccess({
          user_id: 'user-1',
          memory_type: 'documents',
          memory_id: `doc-${i}`,
          action: 'read',
          success: true
        });
      }
      
      const logs = getRecentAccessLogs(5);
      
      expect(logs.length).toBe(5);
    });
  });
});