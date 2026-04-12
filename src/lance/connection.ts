/**
 * @file src/lance/connection.ts
 * @description LanceDB connection management
 */

import * as lancedb from '@lancedb/lancedb';
import { Schema } from 'apache-arrow';
import { getVectorDir, ensureDir } from '../utils/file';
import { getSchemaForTable } from './schema';

/**
 * Default database path
 */
let databasePath: string = getVectorDir();

/**
 * Singleton connection instance
 */
let connectionInstance: LanceDBConnection | null = null;

/**
 * LanceDB connection wrapper
 */
export class LanceDBConnection {
  private db: lancedb.Connection | null = null;
  private path: string;
  private open: boolean = false;
  
  constructor(path: string) {
    this.path = path;
  }
  
  /**
   * Connect to database
   */
  async connect(): Promise<void> {
    if (this.open) return;
    
    // Ensure directory exists for file-based databases
    if (this.path !== ':memory:') {
      ensureDir(this.path);
    }
    
    this.db = await lancedb.connect(this.path);
    this.open = true;
  }
  
  /**
   * Check if connection is open
   */
  isOpen(): boolean {
    return this.open;
  }
  
  /**
   * Create table with Arrow schema
   */
  async createTable(name: string, schema: Schema): Promise<lancedb.Table> {
    if (!this.db) throw new Error('Database not connected');
    
    const table = await this.db.createEmptyTable(name, schema);
    return table;
  }
  
  /**
   * Create table by name (using predefined schema)
   */
  async createTableByName(name: string): Promise<lancedb.Table> {
    const schema = getSchemaForTable(name);
    if (!schema) {
      throw new Error(`Unknown table name: ${name}`);
    }
    return this.createTable(name, schema);
  }
  
  /**
   * Get existing table
   */
  async getTable(name: string): Promise<lancedb.Table> {
    if (!this.db) throw new Error('Database not connected');
    
    return this.db.openTable(name);
  }
  
  /**
   * Drop table
   */
  async dropTable(name: string): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    await this.db.dropTable(name);
  }
  
  /**
   * List all tables
   */
  async listTables(): Promise<string[]> {
    if (!this.db) throw new Error('Database not connected');
    
    return this.db.tableNames();
  }
  
  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.open) {
      this.db = null;
      this.open = false;
    }
  }
  
  /**
   * Get raw connection
   */
  getRaw(): lancedb.Connection | null {
    return this.db;
  }
}

/**
 * Get singleton connection
 */
export async function getConnection(): Promise<LanceDBConnection> {
  if (!connectionInstance) {
    connectionInstance = new LanceDBConnection(databasePath);
    await connectionInstance.connect();
  }
  return connectionInstance;
}

/**
 * Close singleton connection
 */
export async function closeConnection(): Promise<void> {
  if (connectionInstance) {
    await connectionInstance.close();
    connectionInstance = null;
  }
}

/**
 * Reset singleton connection
 */
export function resetConnection(): void {
  connectionInstance = null;
}

/**
 * Check if singleton connection is open
 */
export async function isConnectionOpen(): Promise<boolean> {
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
 * Create table using singleton (with Schema)
 */
export async function createTable(name: string, schema: Schema): Promise<lancedb.Table> {
  const db = await getConnection();
  return db.createTable(name, schema);
}

/**
 * Create table by name using singleton (uses predefined schema)
 */
export async function createTableByName(name: string): Promise<lancedb.Table> {
  const db = await getConnection();
  return db.createTableByName(name);
}

/**
 * Get table using singleton
 */
export async function getTable(name: string): Promise<lancedb.Table> {
  const db = await getConnection();
  return db.getTable(name);
}

/**
 * Drop table using singleton
 */
export async function dropTable(name: string): Promise<void> {
  const db = await getConnection();
  return db.dropTable(name);
}

/**
 * List tables using singleton
 */
export async function listTables(): Promise<string[]> {
  const db = await getConnection();
  return db.listTables();
}

/**
 * Check if a table exists in LanceDB
 */
export async function tableExists(tableName: string): Promise<boolean> {
  const db = await getConnection();
  const tables = await db.listTables();
  return tables.includes(tableName);
}

/**
 * Initialize all vector tables
 * Creates documents_vec, messages_vec, facts_vec, assets_vec, tiered_vec
 * Idempotent - safe to call multiple times
 */
export async function initTables(): Promise<void> {
  const tableNames = ['documents_vec', 'messages_vec', 'facts_vec', 'assets_vec', 'tiered_vec'];
  for (const tableName of tableNames) {
    if (!await tableExists(tableName)) {
      // Pass full tableName - getSchemaForTable strips _vec suffix internally
      await createTableByName(tableName);
    }
  }
}