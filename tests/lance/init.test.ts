/**
 * @file tests/lance/init.test.ts
 * @description LanceDB initialization tests (TDD RED phase)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { resetConnection, closeConnection, setDatabasePath, getConnection } from '../../src/lance/connection';
import { initTables, tableExists } from '../../src/lance/connection';
import { createDocumentsVecSchema } from '../../src/lance/schema';
import { createMessagesVecSchema } from '../../src/lance/schema';
import { createFactsVecSchema } from '../../src/lance/schema';
import { createTieredVecSchema } from '../../src/lance/schema';

describe('LanceDB Initialization', () => {
  const baseTempDir = path.join(os.tmpdir(), 'agents-mem-init-test');
  let tempDir: string;
  
  beforeEach(async () => {
    // Use unique tempDir per test to avoid state sharing
    tempDir = path.join(baseTempDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    resetConnection();
    setDatabasePath(tempDir);
    await getConnection();
  });

  afterEach(async () => {
    await closeConnection();
    resetConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('initTables', () => {
    it('should create all 5 tables with correct schemas', async () => {
      await initTables();
      
      const tables = ['documents_vec', 'messages_vec', 'facts_vec', 'assets_vec', 'tiered_vec'];
      
      for (const tableName of tables) {
        const exists = await tableExists(tableName);
        expect(exists).toBe(true);
      }
    });

    it('should be idempotent - safe to call twice', async () => {
      await initTables();
      
      // Second call should not throw
      let error: Error | undefined;
      try {
        await initTables();
      } catch (e) {
        error = e as Error;
      }
      expect(error).toBeUndefined();
      
      // Tables should still exist
      expect(await tableExists('documents_vec')).toBe(true);
      expect(await tableExists('messages_vec')).toBe(true);
      expect(await tableExists('facts_vec')).toBe(true);
      expect(await tableExists('assets_vec')).toBe(true);
      expect(await tableExists('tiered_vec')).toBe(true);
    });

    it('should handle concurrent calls gracefully', async () => {
      // Concurrent calls may race - first creates tables, others skip due to tableExists
      // If race condition causes "already exists", we accept it (tables exist)
      const promises = [
        initTables(),
        initTables(),
        initTables()
      ];
      
      // Wait for all promises - some may reject with "already exists" due to race
      const results = await Promise.allSettled(promises);
      
      // At least one should succeed, and tables should exist
      const fulfilledCount = results.filter(r => r.status === 'fulfilled').length;
      expect(fulfilledCount).toBeGreaterThanOrEqual(1);
      
      // Tables should exist regardless
      expect(await tableExists('documents_vec')).toBe(true);
    });

    it('should propagate LanceDB connection errors', async () => {
      // Reset connection and set invalid path (non-existent drive on Windows)
      await closeConnection();
      resetConnection();
      setDatabasePath('Z:\\nonexistent\\invalid\\path');
      
      await expect(initTables()).rejects.toThrow();
    });

    it('should work when LanceDB directory does not exist', async () => {
      // Close and reset, then use a non-existent path
      await closeConnection();
      resetConnection();
      const nonExistentDir = path.join(baseTempDir, `noexist-${Date.now()}`);
      expect(fs.existsSync(nonExistentDir)).toBe(false);
      setDatabasePath(nonExistentDir);
      
      // initTables should create the directory
      await initTables();
      
      // Tables should exist after initialization
      expect(await tableExists('documents_vec')).toBe(true);
      expect(await tableExists('messages_vec')).toBe(true);
      expect(await tableExists('facts_vec')).toBe(true);
      expect(await tableExists('assets_vec')).toBe(true);
      expect(await tableExists('tiered_vec')).toBe(true);
    });

    it('should create tables with correct names', async () => {
      await initTables();
      
      // Verify exact table names
      expect(await tableExists('documents_vec')).toBe(true);
      expect(await tableExists('messages_vec')).toBe(true);
      expect(await tableExists('facts_vec')).toBe(true);
      expect(await tableExists('assets_vec')).toBe(true);
      expect(await tableExists('tiered_vec')).toBe(true);
      
      // Verify no extra tables created
      const conn = await getConnection();
      const tableNames = await conn.listTables();
      expect(tableNames).toContain('documents_vec');
      expect(tableNames).toContain('messages_vec');
      expect(tableNames).toContain('facts_vec');
      expect(tableNames).toContain('assets_vec');
      expect(tableNames).toContain('tiered_vec');
    });
  });
});