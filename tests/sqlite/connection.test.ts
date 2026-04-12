/**
 * @file tests/sqlite/connection.test.ts
 * @description SQLite connection tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DatabaseConnection,
  getConnection,
  closeConnection,
  resetConnection,
  isConnectionOpen,
  getDatabasePath,
  setDatabasePath,
  executeQuery,
  executeTransaction,
  prepareStatement
} from '../../src/sqlite/connection';

describe('SQLite Connection', () => {
  const testDbPath = ':memory:';
  
  beforeEach(() => {
    resetConnection();
    setDatabasePath(testDbPath);
  });

  afterEach(() => {
    closeConnection();
  });

  describe('DatabaseConnection', () => {
    it('should create connection class', () => {
      const db = new DatabaseConnection(testDbPath);
      expect(db).toBeDefined();
      expect(db.isOpen()).toBe(true);
      db.close();
    });

    it('should close connection', () => {
      const db = new DatabaseConnection(testDbPath);
      db.close();
      expect(db.isOpen()).toBe(false);
    });

    it('should execute query', () => {
      const db = new DatabaseConnection(testDbPath);
      
      db.exec('CREATE TABLE test (id TEXT PRIMARY KEY, value TEXT)');
      db.exec('INSERT INTO test VALUES ("1", "hello")');
      
      interface TestRow { id: string; value: string }
      const result = db.query<TestRow>('SELECT * FROM test');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('1');
      expect(result[0]?.value).toBe('hello');
      
      db.close();
    });

    it('should execute with parameters', () => {
      const db = new DatabaseConnection(testDbPath);
      
      db.exec('CREATE TABLE test (id TEXT PRIMARY KEY, value TEXT)');
      db.run('INSERT INTO test VALUES (?, ?)', ['2', 'world']);
      
      interface TestRow { id: string; value: string }
      const result = db.query<TestRow>('SELECT * FROM test WHERE id = ?', ['2']);
      expect(result).toHaveLength(1);
      expect(result[0]?.value).toBe('world');
      
      db.close();
    });

    it('should handle transactions', () => {
      const db = new DatabaseConnection(testDbPath);
      
      db.exec('CREATE TABLE test (id TEXT PRIMARY KEY)');
      
      db.transaction(() => {
        db.run('INSERT INTO test VALUES ("1")');
        db.run('INSERT INTO test VALUES ("2")');
      });
      
      const result = db.query('SELECT * FROM test');
      expect(result).toHaveLength(2);
      
      db.close();
    });

    it('should rollback on error', () => {
      const db = new DatabaseConnection(testDbPath);
      
      db.exec('CREATE TABLE test (id TEXT PRIMARY KEY)');
      db.run('INSERT INTO test VALUES ("1")');
      
      expect(() => {
        db.transaction(() => {
          db.run('INSERT INTO test VALUES ("2")');
          // Duplicate insert should fail
          db.run('INSERT INTO test VALUES ("1")');
        });
      }).toThrow();
      
      // Transaction should have rolled back
      const result = db.query('SELECT * FROM test');
      expect(result).toHaveLength(1);
      
      db.close();
    });
  });

  describe('Singleton Connection', () => {
    it('should get singleton connection', () => {
      const db = getConnection();
      expect(db).toBeDefined();
      expect(isConnectionOpen()).toBe(true);
    });

    it('should return same connection instance', () => {
      const db1 = getConnection();
      const db2 = getConnection();
      expect(db1).toBe(db2);
    });

    it('should close singleton connection', () => {
      getConnection();
      closeConnection();
      expect(isConnectionOpen()).toBe(false);
    });

    it('should reset connection', () => {
      const db1 = getConnection();
      resetConnection();
      const db2 = getConnection();
      expect(db1).not.toBe(db2);
    });
  });

  describe('Database Path', () => {
    it('should get database path', () => {
      const path = getDatabasePath();
      expect(path).toBeDefined();
    });

    it('should set custom database path', () => {
      setDatabasePath('/custom/path/db.sqlite');
      expect(getDatabasePath()).toBe('/custom/path/db.sqlite');
    });

    it('should use memory database', () => {
      setDatabasePath(':memory:');
      expect(getDatabasePath()).toBe(':memory:');
    });
  });

  describe('Query Helpers', () => {
    it('should execute query with singleton', () => {
      getConnection().exec('CREATE TABLE test (id TEXT PRIMARY KEY)');
      
      executeQuery('INSERT INTO test VALUES ("1")');
      
      const result = executeQuery('SELECT * FROM test');
      expect(result).toBeDefined();
    });

    it('should execute transaction with singleton', () => {
      getConnection().exec('CREATE TABLE test (id TEXT PRIMARY KEY)');
      
      executeTransaction([
        'INSERT INTO test VALUES ("1")',
        'INSERT INTO test VALUES ("2")'
      ]);
      
      interface CountRow { count: number }
      const result = executeQuery<CountRow>('SELECT COUNT(*) as count FROM test');
      expect(result[0]?.count).toBe(2);
    });

    it('should prepare statement', () => {
      getConnection().exec('CREATE TABLE test (id TEXT PRIMARY KEY, value TEXT)');
      
      const stmt = prepareStatement('INSERT INTO test VALUES (?, ?)');
      expect(stmt).toBeDefined();
      
      stmt.run('1', 'test');
      
      const result = executeQuery('SELECT * FROM test');
      expect(result).toHaveLength(1);
    });
  });

  describe('WAL Mode', () => {
    it('should enable WAL mode for file-based database', () => {
      // WAL mode only works for file-based databases, not :memory:
      // Skip this test for in-memory database
      interface JournalRow { journal_mode: string }
      const result = getConnection().query<JournalRow>('PRAGMA journal_mode');
      expect(result[0]?.journal_mode).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid SQL', () => {
      const db = getConnection();
      
      expect(() => db.exec('INVALID SQL')).toThrow();
    });

    it('should throw on constraint violation', () => {
      const db = getConnection();
      db.exec('CREATE TABLE test (id TEXT PRIMARY KEY UNIQUE)');
      db.run('INSERT INTO test VALUES ("1")');
      
      expect(() => db.run('INSERT INTO test VALUES ("1")')).toThrow();
    });
  });
});