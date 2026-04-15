/**
 * @file src/sqlite/migrations.ts
 * @description SQLite migration management
 */

import { DatabaseConnection } from './connection';
import { container } from 'tsyringe';
import { getSchemaStatements, SCHEMA_VERSION, getTableNames } from './schema';

/**
 * Migration history table name
 */
export const MIGRATION_HISTORY_TABLE = 'migration_history';

/**
 * Create migration history table SQL
 */
const CREATE_MIGRATION_HISTORY = `
CREATE TABLE IF NOT EXISTS migration_history (
  version INTEGER PRIMARY KEY,
  applied_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
  description TEXT
)`;

/**
 * Migration status
 */
export interface MigrationStatus {
  currentVersion: number;
  targetVersion: number;
  needed: boolean;
  appliedMigrations: number[];
}

/**
 * Migration record
 */
export interface MigrationRecord {
  version: number;
  appliedAt: number;
  description?: string;
}

/**
 * MigrationManager class
 */
export class MigrationManager {
  private db: DatabaseConnection;
  
  constructor(db: DatabaseConnection) {
    this.db = db;
  }
  
  /**
   * Initialize migration history table
   */
  init(): void {
    this.db.exec(CREATE_MIGRATION_HISTORY);
  }
  
  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    this.init();
    
    const result = this.db.queryOne<{ version: number }>(
      'SELECT MAX(version) as version FROM migration_history'
    );
    
    return result?.version ?? 0;
  }
  
  /**
   * Check if migration is needed
   */
  isMigrationNeeded(): boolean {
    return this.getCurrentVersion() < SCHEMA_VERSION;
  }
  
  /**
   * Get migration status
   */
  getStatus(): MigrationStatus {
    this.init();
    
    const currentVersion = this.getCurrentVersion();
    const history = this.getHistory();
    
    return {
      currentVersion,
      targetVersion: SCHEMA_VERSION,
      needed: currentVersion < SCHEMA_VERSION,
      appliedMigrations: history.map(h => h.version)
    };
  }
  
  /**
   * Get migration history
   */
  getHistory(): MigrationRecord[] {
    this.init();
    
    return this.db.query<MigrationRecord>(
      'SELECT version, applied_at, description FROM migration_history ORDER BY version'
    );
  }
  
  /**
   * Run all pending migrations
   */
  runMigrations(): void {
    this.init();
    
    const currentVersion = this.getCurrentVersion();
    
    if (currentVersion >= SCHEMA_VERSION) {
      return; // Already at target version
    }
    
    // Apply migrations from current+1 to target
    for (let version = currentVersion + 1; version <= SCHEMA_VERSION; version++) {
      this.applyVersionMigration(version);
    }
  }
  
   /**
   * Apply specific version migration
   */
  private applyVersionMigration(version: number): void {
    if (version === 1) {
      // Version 1: Initial schema
      this.db.transaction(() => {
        // Apply schema statements one by one
        const statements = getSchemaStatements();
        for (const stmt of statements) {
          if (stmt.length > 0) {
            this.db.exec(stmt);
          }
        }

        // Record migration
        this.db.run(
          'INSERT INTO migration_history (version, description) VALUES (?, ?)',
          [version, 'Initial schema creation']
        );
      });
    } else if (version === 2) {
      // Version 2: Drop deprecated queue_jobs and entity_nodes tables
      this.db.transaction(() => {
        this.db.exec('DROP TABLE IF EXISTS queue_jobs');
        this.db.exec('DROP TABLE IF EXISTS entity_nodes');

        // Record migration
        this.db.run(
          'INSERT INTO migration_history (version, description) VALUES (?, ?)',
          [version, 'Drop deprecated queue_jobs and entity_nodes tables']
        );
      });
    } else {
      // Future migrations would go here
      throw new Error(`Migration version ${version} not implemented`);
    }
  }
  
  /**
   * Apply single migration
   */
  applyMigration(version: number): void {
    this.init();
    
    const currentVersion = this.getCurrentVersion();
    
    if (version <= currentVersion) {
      throw new Error(`Version ${version} already applied`);
    }
    
    if (version > currentVersion + 1) {
      throw new Error(`Cannot skip migrations. Current: ${currentVersion}, Target: ${version}`);
    }
    
    this.applyVersionMigration(version);
  }
  
  /**
   * Rollback last migration (if supported)
   */
  rollbackMigration(): void {
    this.init();
    
    const currentVersion = this.getCurrentVersion();
    
    if (currentVersion === 0) {
      throw new Error('No migrations to rollback');
    }
    
    // For now, we don't support rollback
    // In a production system, you'd have DOWN migrations
    throw new Error('Rollback not supported. Drop tables manually if needed.');
  }
  
  /**
   * Validate all tables exist
   */
  validateSchema(): boolean {
    const existingTables = this.db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    const existingNames = existingTables.map(t => t.name);
    
    for (const table of getTableNames()) {
      if (!existingNames.includes(table)) {
        return false;
      }
    }
    
    return true;
  }
}

// ============================================================================
// Singleton Helpers
// ============================================================================

/**
 * Singleton migration manager
 */
let managerInstance: MigrationManager | null = null;

/**
 * Get migration manager
 */
function getManager(): MigrationManager {
  if (!managerInstance) {
    managerInstance = new MigrationManager(container.resolve(DatabaseConnection));
  }
  return managerInstance;
}

/**
 * Reset migration manager
 */
export function resetManager(): void {
  managerInstance = null;
}

/**
 * Run migrations using singleton
 */
export function runMigrations(): void {
  getManager().runMigrations();
}

/**
 * Get migration status using singleton
 */
export function getMigrationStatus(): MigrationStatus {
  return getManager().getStatus();
}

/**
 * Get current version using singleton
 */
export function getCurrentVersion(): number {
  return getManager().getCurrentVersion();
}

/**
 * Check if migration needed using singleton
 */
export function isMigrationNeeded(): boolean {
  return getManager().isMigrationNeeded();
}

/**
 * Apply single migration using singleton
 */
export function applyMigration(version: number): void {
  getManager().applyMigration(version);
}

/**
 * Rollback migration using singleton
 */
export function rollbackMigration(): void {
  getManager().rollbackMigration();
}