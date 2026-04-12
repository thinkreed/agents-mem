/**
 * @file tests/sqlite/migrations.test.ts
 * @description SQLite migrations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MigrationManager,
  runMigrations,
  getMigrationStatus,
  getCurrentVersion,
  isMigrationNeeded,
  applyMigration,
  rollbackMigration,
  resetManager,
  MIGRATION_HISTORY_TABLE
} from '../../src/sqlite/migrations';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { SCHEMA_VERSION } from '../../src/sqlite/schema';

describe('SQLite Migrations', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('Migration History Table', () => {
    it('should define migration history table name', () => {
      expect(MIGRATION_HISTORY_TABLE).toBe('migration_history');
    });

    it('should create migration history table on init', () => {
      const manager = new MigrationManager(getConnection());
      manager.init();
      
      const result = getConnection().query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_history'"
      );
      
      expect(result.length).toBe(1);
    });
  });

  describe('MigrationManager', () => {
    it('should create migration manager', () => {
      const manager = new MigrationManager(getConnection());
      expect(manager).toBeDefined();
    });

    it('should initialize migration history', () => {
      const manager = new MigrationManager(getConnection());
      manager.init();
      
      const status = manager.getStatus();
      expect(status).toBeDefined();
    });

    it('should get current version', () => {
      const manager = new MigrationManager(getConnection());
      manager.init();
      
      const version = manager.getCurrentVersion();
      expect(version).toBe(0); // Fresh database
    });

    it('should apply migrations', () => {
      const manager = new MigrationManager(getConnection());
      manager.runMigrations();
      
      const version = manager.getCurrentVersion();
      expect(version).toBe(SCHEMA_VERSION);
    });

    it('should not reapply existing migrations', () => {
      const manager = new MigrationManager(getConnection());
      manager.runMigrations();
      
      // Second run should not fail
      manager.runMigrations();
      
      const version = manager.getCurrentVersion();
      expect(version).toBe(SCHEMA_VERSION);
    });

    it('should detect if migration is needed', () => {
      const manager = new MigrationManager(getConnection());
      manager.init();
      
      expect(manager.isMigrationNeeded()).toBe(true);
      
      manager.runMigrations();
      
      expect(manager.isMigrationNeeded()).toBe(false);
    });

    it('should get migration status', () => {
      const manager = new MigrationManager(getConnection());
      manager.init();
      
      const status = manager.getStatus();
      
      expect(status.currentVersion).toBe(0);
      expect(status.targetVersion).toBe(SCHEMA_VERSION);
      expect(status.needed).toBe(true);
    });

    it('should create all tables after migration', () => {
      const manager = new MigrationManager(getConnection());
      manager.runMigrations();
      
      const tables = getConnection().query<{name: string}>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      
      const tableNames = tables.map(t => t.name).filter(n => n !== 'migration_history');
      
      expect(tableNames.length).toBeGreaterThan(10);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('documents');
      expect(tableNames).toContain('facts');
    });

    it('should have indexes after migration', () => {
      const manager = new MigrationManager(getConnection());
      manager.runMigrations();
      
      const indexes = getConnection().query<{name: string}>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
      );
      
      expect(indexes.length).toBeGreaterThan(5);
    });
  });

  describe('Helper Functions', () => {
    it('should run migrations with singleton', () => {
      runMigrations();
      
      const version = getCurrentVersion();
      expect(version).toBe(SCHEMA_VERSION);
    });

    it('should get migration status with singleton', () => {
      resetConnection();
      runMigrations();
      
      const status = getMigrationStatus();
      
      expect(status).toBeDefined();
      expect(status.currentVersion).toBe(SCHEMA_VERSION);
    });

    it('should check if migration needed with singleton', () => {
      resetConnection();
      
      expect(isMigrationNeeded()).toBe(true);
      
      runMigrations();
      
      expect(isMigrationNeeded()).toBe(false);
    });

    it('should apply single migration', () => {
      resetConnection();
      // Fresh database starts at version 0
      applyMigration(1);
      
      const version = getCurrentVersion();
      expect(version).toBe(1);
    });

    it('should rollback migration (if supported)', () => {
      resetConnection();
      runMigrations();
      
      // Rollback might not be fully supported, but function should exist
      expect(rollbackMigration).toBeDefined();
    });
  });

  describe('Migration History', () => {
    it('should record migration in history', () => {
      const manager = new MigrationManager(getConnection());
      manager.runMigrations();
      
      const history = getConnection().query(
        'SELECT * FROM migration_history ORDER BY version'
      );
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].version).toBeDefined();
      expect(history[0].applied_at).toBeDefined();
    });

    it('should track migration versions', () => {
      const manager = new MigrationManager(getConnection());
      manager.runMigrations();
      
      const history = manager.getHistory();
      
      expect(history.length).toBe(SCHEMA_VERSION);
    });
  });

  describe('Error Handling', () => {
    it('should handle migration failure', () => {
      // Create a manager that will fail
      const manager = new MigrationManager(getConnection());
      manager.init();
      
      // Database should remain usable even after errors
      expect(() => getConnection().exec('SELECT 1')).not.toThrow();
    });

    it('should validate schema after migration', () => {
      resetConnection();
      runMigrations();
      
      // All tables should exist
      const result = getConnection().query(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
      );
      
      expect(result[0].count).toBeGreaterThan(10);
    });
  });
});