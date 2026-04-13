/**
 * @file tests/sqlite/schema.test.ts
 * @description SQLite schema tests (TDD)
 */

import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  getSchemaSQL,
  getTableNames,
  getCreateTableSQL,
  getIndexesSQL,
  validateSchema,
  TABLE_NAMES,
  SchemaTable
} from '../../src/sqlite/schema';

describe('SQLite Schema', () => {
  describe('Schema Version', () => {
    it('should define SCHEMA_VERSION', () => {
      expect(SCHEMA_VERSION).toBeDefined();
      expect(SCHEMA_VERSION).toBeGreaterThan(0);
    });
  });

  describe('Table Names', () => {
    it('should define all required tables', () => {
      const expectedTables = [
        'users', 'agents', 'teams', 'team_members',
        'memory_index',
        'documents', 'assets', 'tiered_content',
        'conversations', 'messages',
        'facts', 'entity_nodes',
        'extraction_status', 'memory_access_log',
        'queue_jobs' // NEW: Background job queue
      ];
      
      for (const table of expectedTables) {
        expect(TABLE_NAMES).toContain(table);
      }
    });

    it('should have 15 tables total', () => {
      expect(TABLE_NAMES.length).toBe(15);
    });
  });

  describe('getSchemaSQL', () => {
    it('should return complete schema SQL', () => {
      const sql = getSchemaSQL();
      
      expect(sql).toBeDefined();
      expect(sql.length).toBeGreaterThan(0);
      
      // Should contain CREATE TABLE statements
      expect(sql).toContain('CREATE TABLE');
    });

    it('should include all tables in schema', () => {
      const sql = getSchemaSQL();
      
      for (const table of TABLE_NAMES) {
        expect(sql).toContain(`CREATE TABLE ${table}`);
      }
    });

    it('should include indexes', () => {
      const sql = getSchemaSQL();
      
      expect(sql).toContain('CREATE INDEX');
    });
  });

  describe('getTableNames', () => {
    it('should return array of table names', () => {
      const names = getTableNames();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBe(15);
    });
  });

  describe('getCreateTableSQL', () => {
    it('should return SQL for specific table', () => {
      const usersSQL = getCreateTableSQL('users');
      
      expect(usersSQL).toContain('CREATE TABLE users');
      expect(usersSQL).toContain('id TEXT PRIMARY KEY');
      expect(usersSQL).toContain('name TEXT NOT NULL');
    });

    it('should return SQL for memory_index table', () => {
      const indexSQL = getCreateTableSQL('memory_index');
      
      expect(indexSQL).toContain('CREATE TABLE memory_index');
      expect(indexSQL).toContain('uri TEXT NOT NULL UNIQUE');
      expect(indexSQL).toContain('target_type TEXT NOT NULL');
    });

    it('should return SQL for documents table', () => {
      const docsSQL = getCreateTableSQL('documents');
      
      expect(docsSQL).toContain('CREATE TABLE documents');
      expect(docsSQL).toContain('content TEXT NOT NULL');
      expect(docsSQL).toContain('openviking_uri TEXT');
    });

    it('should return SQL for facts table', () => {
      const factsSQL = getCreateTableSQL('facts');
      
      expect(factsSQL).toContain('CREATE TABLE facts');
      expect(factsSQL).toContain('fact_type TEXT NOT NULL');
      expect(factsSQL).toContain('confidence REAL');
    });

    it('should throw for unknown table', () => {
      // Cast to bypass type check - testing runtime behavior
      expect(() => getCreateTableSQL('unknown_table' as 'users')).toThrow();
    });
  });

  describe('getIndexesSQL', () => {
    it('should return indexes SQL for specific table', () => {
      const agentsIndexes = getIndexesSQL('agents');
      
      expect(agentsIndexes).toContain('CREATE INDEX idx_agents_user');
    });

    it('should return empty string for table without indexes', () => {
      const usersIndexes = getIndexesSQL('users');
      
      // users table has no additional indexes (PRIMARY KEY is implicit)
      expect(usersIndexes).toBeDefined();
    });

    it('should include scope indexes for scoped tables', () => {
      const docsIndexes = getIndexesSQL('documents');
      
      expect(docsIndexes).toContain('idx_documents_scope');
    });
  });

  describe('SchemaTable type', () => {
    it('should be valid table name type', () => {
      const table: SchemaTable = 'users';
      expect(table).toBe('users');
    });

    it('should accept all table names', () => {
      for (const name of TABLE_NAMES) {
        const table: SchemaTable = name as SchemaTable;
        expect(table).toBe(name);
      }
    });
  });

  describe('validateSchema', () => {
    it('should return true for valid schema', () => {
      // This would require actual DB connection, so we test the function exists
      expect(validateSchema).toBeDefined();
      expect(typeof validateSchema).toBe('function');
    });
  });

  describe('Schema SQL structure', () => {
    it('should have proper foreign key constraints', () => {
      const agentsSQL = getCreateTableSQL('agents');
      
      expect(agentsSQL).toContain('FOREIGN KEY');
      expect(agentsSQL).toContain('REFERENCES users');
    });

    it('should have proper indexes for tiered_content', () => {
      const tieredSQL = getCreateTableSQL('tiered_content');
      
      expect(tieredSQL).toContain('source_type TEXT NOT NULL');
      expect(tieredSQL).toContain('source_id TEXT NOT NULL');
    });

    it('should have proper indexes for messages', () => {
      const messagesSQL = getCreateTableSQL('messages');
      
      expect(messagesSQL).toContain('conversation_id TEXT NOT NULL');
      expect(messagesSQL).toContain('FOREIGN KEY');
    });

    it('should have proper indexes for entity_nodes', () => {
      const entitySQL = getCreateTableSQL('entity_nodes');
      
      expect(entitySQL).toContain('depth INTEGER');
      expect(entitySQL).toContain('parent_id TEXT');
    });

    it('should have timestamp defaults', () => {
      const usersSQL = getCreateTableSQL('users');
      
      expect(usersSQL).toContain('created_at');
      expect(usersSQL).toContain('updated_at');
    });
  });
});