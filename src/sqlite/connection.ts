/**
 * @file src/sqlite/connection.ts
 * @description SQLite connection management using Bun built-in SQLite
 */

import { Database } from 'bun:sqlite';
import { getSQLitePath, ensureDir } from '../utils/file';
import { SQLITE_WAL_MODE } from '../core/constants';

/**
 * Default database path
 */
let databasePath: string = getSQLitePath();

/**
 * Singleton connection instance
 */
let connectionInstance: DatabaseConnection | null = null;

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
export class DatabaseConnection {
  private db: Database;
  private open: boolean = true;
  private stmtCache: Map<string, ReturnType<Database['prepare']>> = new Map();
  
  constructor(path: string = ':memory:') {
    // Ensure directory exists for file-based databases
    if (path !== ':memory:') {
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir) {
        ensureDir(dir);
      }
    }
    
    this.db = new Database(path);
    
    // Enable WAL mode if configured
    if (SQLITE_WAL_MODE && path !== ':memory:') {
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
   * Execute SQL without parameters
   */
  exec(sql: string): void {
    if (!this.open) throw new Error('Database is closed');
    this.db.run(sql);
  }
  
  /**
   * Run SQL with parameters
   */
  run(sql: string, params?: unknown[]): ReturnType<Database['run']> {
    if (!this.open) throw new Error('Database is closed');
    const stmt = this.prepareCached(sql);
    return stmt.run(...(params ?? []));
  }
  
  /**
   * Query SQL and return all results
   */
  query<T = unknown>(sql: string, params?: unknown[]): T[] {
    if (!this.open) throw new Error('Database is closed');
    const stmt = this.prepareCached(sql);
    return stmt.all(...(params ?? [])) as T[];
  }
  
  /**
   * Query SQL and return first result
   */
  queryOne<T = unknown>(sql: string, params?: unknown[]): T | undefined {
    if (!this.open) throw new Error('Database is closed');
    const stmt = this.prepareCached(sql);
    return stmt.get(...(params ?? [])) as T | undefined;
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

/**
 * Get singleton connection
 */
export function getConnection(): DatabaseConnection {
  if (!connectionInstance) {
    connectionInstance = new DatabaseConnection(databasePath);
  }
  return connectionInstance;
}

/**
 * Close singleton connection
 */
export function closeConnection(): void {
  if (connectionInstance) {
    connectionInstance.close();
    connectionInstance = null;
  }
}

/**
 * Reset singleton connection (close and create new)
 */
export function resetConnection(): void {
  closeConnection();
}

/**
 * Check if singleton connection is open
 */
export function isConnectionOpen(): boolean {
  return connectionInstance?.isOpen() ?? false;
}

/**
 * Get database path
 */
export function getDatabasePath(): string {
  return databasePath;
}

/**
 * Set database path (requires resetConnection to take effect)
 */
export function setDatabasePath(path: string): void {
  databasePath = path;
}

/**
 * Execute query using singleton connection
 */
export function executeQuery<T = unknown>(sql: string, params?: unknown[]): T[] {
  return getConnection().query<T>(sql, params);
}

/**
 * Execute single statement using singleton connection
 */
export function executeRun(sql: string, params?: unknown[]): ReturnType<Database['run']> {
  return getConnection().run(sql, params);
}

/**
 * Execute transaction using singleton connection
 */
export function executeTransaction(sqls: string[]): void {
  getConnection().transaction(() => {
    for (const sql of sqls) {
      getConnection().exec(sql);
    }
  });
}

/**
 * Prepare statement using singleton connection
 */
export function prepareStatement(sql: string): ReturnType<Database['prepare']> {
  return getConnection().prepare(sql);
}