/**
 * @file tests/lance/connection.test.ts
 * @description LanceDB connection tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Schema, Field, Utf8, Float64, FixedSizeList, Float32, Int32 } from 'apache-arrow';
import {
  LanceDBConnection,
  getConnection,
  closeConnection,
  resetConnection,
  isConnectionOpen,
  getDatabasePath,
  setDatabasePath,
  getTable,
  createTable,
  createTableByName,
  dropTable,
  listTables
} from '../../src/lance/connection';

describe('LanceDB Connection', () => {
  // Use temp directory for LanceDB (it doesn't support :memory:)
  const tempDir = path.join(os.tmpdir(), 'agents-mem-lance-test');
  
  beforeEach(async () => {
    resetConnection();
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
  });

  afterEach(async () => {
    await closeConnection();
    // Cleanup temp directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('LanceDBConnection', () => {
    it('should create connection class', async () => {
      const db = new LanceDBConnection(tempDir);
      await db.connect();
      
      expect(db).toBeDefined();
      expect(db.isOpen()).toBe(true);
      
      await db.close();
    });

    it('should close connection', async () => {
      const db = new LanceDBConnection(tempDir);
      await db.connect();
      await db.close();
      
      expect(db.isOpen()).toBe(false);
    });

    it('should create table with Arrow schema', async () => {
      const db = new LanceDBConnection(tempDir);
      await db.connect();
      
      const tableName = 'test_table';
      const schema = new Schema([
        new Field('id', new Utf8()),
        new Field('value', new Float64())
      ]);
      
      const table = await db.createTable(tableName, schema);
      expect(table).toBeDefined();
      
      await db.close();
    });

    it('should create table with vector field', async () => {
      const db = new LanceDBConnection(tempDir);
      await db.connect();
      
      const schema = new Schema([
        new Field('id', new Utf8()),
        new Field('vector', new FixedSizeList(768, new Field('item', new Float32())))
      ]);
      
      const table = await db.createTable('vector_table', schema);
      expect(table).toBeDefined();
      
      await db.close();
    });

    it('should open existing table', async () => {
      const db = new LanceDBConnection(tempDir);
      await db.connect();
      
      const schema = new Schema([new Field('id', new Utf8())]);
      await db.createTable('existing_table', schema);
      
      const table = await db.getTable('existing_table');
      expect(table).toBeDefined();
      
      await db.close();
    });

    it('should list tables', async () => {
      const db = new LanceDBConnection(tempDir);
      await db.connect();
      
      const schema = new Schema([new Field('id', new Utf8())]);
      await db.createTable('table_a', schema);
      await db.createTable('table_b', schema);
      
      const tables = await db.listTables();
      
      expect(tables.length).toBe(2);
      expect(tables).toContain('table_a');
      expect(tables).toContain('table_b');
      
      await db.close();
    });
    
    it('should create predefined table by name', async () => {
      const db = new LanceDBConnection(tempDir);
      await db.connect();
      
      // documents is a predefined table schema
      const table = await db.createTableByName('documents');
      expect(table).toBeDefined();
      
      await db.close();
    });
  });

  describe('Singleton Connection', () => {
    it('should get singleton connection', async () => {
      const db = await getConnection();
      
      expect(db).toBeDefined();
      expect(await isConnectionOpen()).toBe(true);
    });

    it('should return same connection instance', async () => {
      const db1 = await getConnection();
      const db2 = await getConnection();
      
      expect(db1).toBe(db2);
    });

    it('should close singleton connection', async () => {
      await getConnection();
      await closeConnection();
      
      expect(await isConnectionOpen()).toBe(false);
    });

    it('should reset connection', async () => {
      const db1 = await getConnection();
      resetConnection();
      const db2 = await getConnection();
      
      expect(db1).not.toBe(db2);
    });
  });

  describe('Database Path', () => {
    it('should get database path', () => {
      const dbPath = getDatabasePath();
      expect(dbPath).toBeDefined();
    });

    it('should set custom database path', () => {
      setDatabasePath('/custom/lance/path');
      expect(getDatabasePath()).toBe('/custom/lance/path');
    });
  });

  describe('Table Operations', () => {
    it('should create table via singleton', async () => {
      await getConnection();
      
      const schema = new Schema([
        new Field('id', new Utf8()),
        new Field('vector', new FixedSizeList(768, new Field('item', new Float32())))
      ]);
      
      const table = await createTable('singleton_table', schema);
      expect(table).toBeDefined();
    });

    it('should create predefined table via singleton', async () => {
      await getConnection();
      
      const table = await createTableByName('messages');
      expect(table).toBeDefined();
    });

    it('should get table via singleton', async () => {
      await getConnection();
      
      const schema = new Schema([new Field('id', new Utf8())]);
      await createTable('get_test', schema);
      
      const table = await getTable('get_test');
      expect(table).toBeDefined();
    });

    it('should list tables via singleton', async () => {
      await getConnection();
      
      const schema = new Schema([new Field('id', new Utf8())]);
      await createTable('list_a', schema);
      
      const tables = await listTables();
      expect(tables.length).toBeGreaterThan(0);
    });

    it('should drop table', async () => {
      await getConnection();
      
      const schema = new Schema([new Field('id', new Utf8())]);
      await createTable('drop_test', schema);
      
      await dropTable('drop_test');
      
      const tables = await listTables();
      expect(tables).not.toContain('drop_test');
    });
  });
});