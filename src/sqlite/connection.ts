/**
 * @file src/sqlite/connection.ts
 * @description SQLite connection management using Bun built-in SQLite
 */

import 'reflect-metadata';
import { singleton } from 'tsyringe';
import { Database } from 'bun:sqlite';
import { getSQLitePath, ensureDir } from '../utils/file';
import { SQLITE_WAL_MODE } from '../core/constants';
import * as path from 'path';

/**
 * Default database path
 */
let databasePath: string = getSQLitePath();

/**
 * Statement cache
 */
interface StatementCache {
  get(key: string): unknown;
  set(key: string, stmt: unknown): void;
}

/**
 * DatabaseConnection class wrapper
 */
@singleton()
export class DatabaseConnection {
  private db: Database;
  private open: boolean = true;
  private stmtCache: Map<string, ReturnType<Database['prepare']>> = new Map();

  constructor() {
    // Use database path from env or default
    const dbPath = process.env.AGENTS_MEM_DB_PATH || databasePath;
    
    // Ensure directory exists for file-based databases
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (dir) {
        ensureDir(dir);
      }
    }

    this.db = new Database(dbPath);

    // Enable WAL mode if configured
    if (SQLITE_WAL_MODE && dbPath !== ':memory:') {
      this.db.run('PRAGMA journal_mode = WAL');
    }

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
  }
  
  /**
   * Check if connection is open
   */
  isOpen(): boolean {
    return this.open;
  }
  
  /**
   * Execute SQL without parameters (multi-statement support)
   */
  exec(sql: string): void {
    if (!this.open) throw new Error('Database is closed');
    this.db.exec(sql);
  }
  
/**
 * Run SQL with parameters
 */
  run(sql: string, params?: unknown[]): ReturnType<Database['run']> {
    if (!this.open) throw new Error('Database is closed');
    const stmt = this.prepareCached(sql);
    // Bun SQLite accepts various parameter types - cast to bypass complex union type
    type SQLiteParam = string | number | bigint | boolean | null | Uint8Array;
    return stmt.run(...((params ?? []) as SQLiteParam[]));
  }
  
  /**
   * Query SQL and return all results
   */
  query<T = unknown>(sql: string, params?: unknown[]): T[] {
    if (!this.open) throw new Error('Database is closed');
    const stmt = this.prepareCached(sql);
    type SQLiteParam = string | number | bigint | boolean | null | Uint8Array;
    return stmt.all(...((params ?? []) as SQLiteParam[])) as T[];
  }
  
  /**
   * Query SQL and return first result
   */
  queryOne<T = unknown>(sql: string, params?: unknown[]): T | undefined {
    if (!this.open) throw new Error('Database is closed');
    const stmt = this.prepareCached(sql);
    type SQLiteParam = string | number | bigint | boolean | null | Uint8Array;
    return stmt.get(...((params ?? []) as SQLiteParam[])) as T | undefined;
  }
  
  /**
   * Prepare statement (cached)
   */
  private prepareCached(sql: string): ReturnType<Database['prepare']> {
    let stmt = this.stmtCache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.stmtCache.set(sql, stmt);
    }
    return stmt;
  }
  
  /**
   * Prepare statement (uncached)
   */
  prepare(sql: string): ReturnType<Database['prepare']> {
    if (!this.open) throw new Error('Database is closed');
    return this.db.prepare(sql);
  }
  
  /**
   * Execute transaction
   */
  transaction(fn: () => void): void {
    if (!this.open) throw new Error('Database is closed');
    this.db.transaction(fn)();
  }
  
  /**
   * Close connection
   */
  close(): void {
    if (this.open) {
      this.stmtCache.clear();
      this.db.close();
      this.open = false;
    }
  }
  
  /**
   * Get raw database instance
   */
  getRaw(): Database {
    return this.db;
  }
  
  /**
   * Clear statement cache
   */
  clearCache(): void {
    this.stmtCache.clear();
  }
}

// ============================================================================
// Backward Compatibility Helpers (for gradual migration)
// ============================================================================

/**
 * Get database connection via container
 * @deprecated Use container.resolve(DatabaseConnection) or constructor injection
 */
export function getConnection(): DatabaseConnection {
  // Dynamic import to avoid circular dependency
  const { container } = require('tsyringe');
  return container.resolve(DatabaseConnection);
}

/**
 * @deprecated Use container.reset()
 */
export function resetConnection(): void {
  const { container } = require('tsyringe');
  container.reset();
}

/**
 * @deprecated Use container.resolve(DatabaseConnection).isOpen()
 */
export function isConnectionOpen(): boolean {
  return getConnection().isOpen();
}

/**
 * @deprecated Use container.resolve(DatabaseConnection).getRaw()
 */
export function getDatabasePath(): string {
  return databasePath;
}

/**
 * @deprecated Set via environment variable AGENTS_MEM_DB_PATH
 */
export function setDatabasePath(path: string): void {
  process.env.AGENTS_MEM_DB_PATH = path;
}

/**
 * Execute query using container connection
 */
export function executeQuery<T = unknown>(sql: string, params?: unknown[]): T[] {
  return getConnection().query<T>(sql, params);
}

/**
 * Execute single statement using container connection
 */
export function executeRun(sql: string, params?: unknown[]): ReturnType<Database['run']> {
  return getConnection().run(sql, params);
}

/**
 * Execute transaction using container connection
 */
export function executeTransaction(sqls: string[]): void {
  getConnection().transaction(() => {
    for (const sql of sqls) {
      getConnection().exec(sql);
    }
  });
}

/**
 * Prepare statement using container connection
 */
export function prepareStatement(sql: string): ReturnType<Database['prepare']> {
  return getConnection().prepare(sql);
}