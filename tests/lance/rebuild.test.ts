/**
 * @file tests/lance/rebuild.test.ts
 * @description Auto-rebuild tests for LanceDB documents_vec table (TDD RED phase)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  rebuildTable,
  checkAndRebuild,
  hybridSearchDocuments
} from '../../src/lance/hybrid_search';
import {
  resetConnection,
  closeConnection,
  setDatabasePath,
  getConnection,
  createTable,
  listTables,
  dropTable
} from '../../src/lance/connection';
import { createDocumentsVecSchema } from '../../src/lance/schema';
import { addDocumentVector, searchDocumentVectors, countDocumentVectors } from '../../src/lance/documents_vec';
import {
  resetConnection as resetSQLiteConnection,
  closeConnection as closeSQLiteConnection,
  setDatabasePath as setSQLitePath,
  getConnection as getSQLiteConnection
} from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { createDocument, getDocumentsByScope } from '../../src/sqlite/documents';
import { Scope } from '../../src/core/types';

describe('LanceDB Auto-Rebuild', () => {
  // Use unique temp directories per test to ensure isolation
  let testCounter = 0;
  
  beforeEach(async () => {
    testCounter++;
    const uniqueId = `${Date.now()}-${testCounter}`;
    
    // Unique temp directories for both SQLite and LanceDB
    const tempBase = path.join(os.tmpdir(), `agents-mem-rebuild-test-${uniqueId}`);
    const sqliteDir = path.join(tempBase, 'sqlite');
    const lanceDir = path.join(tempBase, 'lance');

    // Reset all connections and singletons
    resetConnection();
    resetSQLiteConnection();
    resetManager();

    // Create temp directories
    if (!fs.existsSync(tempBase)) {
      fs.mkdirSync(tempBase, { recursive: true });
    }
    if (!fs.existsSync(sqliteDir)) {
      fs.mkdirSync(sqliteDir, { recursive: true });
    }
    if (!fs.existsSync(lanceDir)) {
      fs.mkdirSync(lanceDir, { recursive: true });
    }

    // Set paths
    setSQLitePath(path.join(sqliteDir, 'test.db'));
    setDatabasePath(lanceDir);

    // Initialize SQLite with migrations
    const sqliteDb = getSQLiteConnection();
    runMigrations();

    // Initialize LanceDB connection
    await getConnection();
    
    // Store paths for afterEach cleanup
    (global as unknown as { currentTempBase: string }).currentTempBase = tempBase;
  });

  afterEach(async () => {
    // Close all connections
    await closeConnection();
    closeSQLiteConnection();

    // Cleanup temp directories
    const tempBase = (global as unknown as { currentTempBase: string }).currentTempBase;
    try {
      if (tempBase && fs.existsSync(tempBase)) {
        fs.rmSync(tempBase, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('checkAndRebuild', () => {
    it('should trigger rebuild when documents_vec table is missing', async () => {
      // Setup: SQLite has documents, but LanceDB has no documents_vec table
      const scope: Scope = { userId: 'user-1' };
      
      createDocument({
        user_id: scope.userId,
        doc_type: 'note',
        title: 'Test Document',
        content: 'This is test content for rebuild'
      });

      // Verify SQLite has the document
      const sqliteDocs = getDocumentsByScope(scope);
      expect(sqliteDocs.length).toBeGreaterThan(0);

      // Verify LanceDB does NOT have documents_vec table
      const tables = await listTables();
      expect(tables).not.toContain('documents_vec');

      // Execute checkAndRebuild - should trigger rebuild
      const result = await checkAndRebuild('documents_vec', scope);

      // Expect rebuild was triggered and succeeded
      expect(result.rebuilt).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify table now exists
      const tablesAfter = await listTables();
      expect(tablesAfter).toContain('documents_vec');
    });

    it('should NOT trigger rebuild when documents_vec table already exists', async () => {
      // Setup: Create documents_vec table BEFORE check
      const scope: Scope = { userId: 'user-2' };
      
      await createTable('documents_vec', createDocumentsVecSchema());

      // Add some data to SQLite
      createDocument({
        user_id: scope.userId,
        doc_type: 'note',
        title: 'Existing Document',
        content: 'Content that should not trigger rebuild'
      });

      // Execute checkAndRebuild - should NOT rebuild since table exists
      const result = await checkAndRebuild('documents_vec', scope);

      // Expect rebuild was NOT triggered
      expect(result.rebuilt).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('table exists');

      // Table should still exist (unchanged)
      const tables = await listTables();
      expect(tables).toContain('documents_vec');
    });
  });

  describe('rebuildTable', () => {
    it('should read all documents from SQLite correctly', async () => {
      // Setup: Create multiple documents in SQLite
      const scope: Scope = { userId: 'user-3', agentId: 'agent-1' };
      
      createDocument({
        user_id: scope.userId,
        agent_id: scope.agentId,
        doc_type: 'note',
        title: 'Document 1',
        content: 'First document content'
      });

      createDocument({
        user_id: scope.userId,
        agent_id: scope.agentId,
        doc_type: 'note',
        title: 'Document 2',
        content: 'Second document content'
      });

      createDocument({
        user_id: scope.userId,
        doc_type: 'note',
        title: 'Document 3 (no agent)',
        content: 'Third document without agent'
      });

      // Execute rebuild for specific scope
      const result = await rebuildTable('documents_vec', scope);

      // Expect all scoped documents were processed
      expect(result.success).toBe(true);
      expect(result.documentsProcessed).toBe(2); // Only 2 with agentId match

      // Verify vector count
      const count = await countDocumentVectors();
      expect(count).toBe(2);
    });

    it('should handle embedding failure gracefully and return error', async () => {
      // Setup: Create document with problematic content
      // Note: In real implementation, embedding failure might come from Ollama being unavailable
      // For this test, we simulate the scenario where rebuild encounters an embedding error
      
      const scope: Scope = { userId: 'user-4' };
      
      // Create many documents - one with empty content (potential failure case)
      createDocument({
        user_id: scope.userId,
        doc_type: 'note',
        title: 'Valid Document',
        content: 'Valid content here'
      });

      createDocument({
        user_id: scope.userId,
        doc_type: 'note',
        title: 'Empty Document',
        content: '' // Empty content - may cause embedding issues
      });

      // Execute rebuild
      const result = await rebuildTable('documents_vec', scope);

      // Expect graceful handling - should report error but not crash
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('embedding_error');
      expect(result.documentsProcessed).toBeDefined(); // Should still report progress
    });

    it('should prevent concurrent rebuild attempts (single rebuild lock)', async () => {
      // Setup: Create documents
      const scope: Scope = { userId: 'user-5' };
      
      createDocument({
        user_id: scope.userId,
        doc_type: 'note',
        title: 'Concurrent Test',
        content: 'Testing concurrent rebuild prevention'
      });

      // Execute two concurrent rebuild calls
      const [result1, result2] = await Promise.all([
        rebuildTable('documents_vec', scope),
        rebuildTable('documents_vec', scope)
      ]);

      // One should succeed, one should be blocked
      const successCount = [result1, result2].filter(r => r.success).length;
      const blockedCount = [result1, result2].filter(r => r.blocked).length;

      expect(successCount).toBe(1);
      expect(blockedCount).toBe(1);

      // The blocked one should indicate it was blocked
      const blockedResult = result1.blocked ? result1 : result2;
      expect(blockedResult.reason).toContain('rebuild in progress');
    });
  });

  describe('hybridSearchDocuments with auto-rebuild', () => {
    it('should succeed with correct results after rebuild', async () => {
      // Setup: SQLite has documents, LanceDB missing table
      const scope: Scope = { userId: 'user-6' };
      
      createDocument({
        user_id: scope.userId,
        doc_type: 'note',
        title: 'Searchable Document',
        content: 'This content should be searchable after rebuild'
      });

      // Search should trigger rebuild internally and return results
      const queryVector = new Float32Array(768).fill(0.1);
      const results = await hybridSearchDocuments({
        queryVector,
        queryText: 'searchable',
        scope
      });

      // Expect search succeeded with results
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('searchable');

      // Verify table now exists
      const tables = await listTables();
      expect(tables).toContain('documents_vec');
    });

    it('should return empty array for empty SQLite (no docs)', async () => {
      // Setup: SQLite has NO documents for this scope
      const scope: Scope = { userId: 'user-7' };

      // No documents created

      // Rebuild should create empty table
      const result = await rebuildTable('documents_vec', scope);

      expect(result.success).toBe(true);
      expect(result.documentsProcessed).toBe(0);

      // Table exists but is empty
      const tables = await listTables();
      expect(tables).toContain('documents_vec');

      // Search should return empty array
      const queryVector = new Float32Array(768).fill(0.2);
      const results = await searchDocumentVectors(queryVector, 10, scope);

      expect(results).toEqual([]);
    });

    it('should complete partial rebuild when previously interrupted', async () => {
      // Setup: Simulate partial rebuild scenario
      // Create documents in SQLite
      const scope: Scope = { userId: 'user-8' };
      
      for (let i = 0; i < 5; i++) {
        createDocument({
          user_id: scope.userId,
          doc_type: 'note',
          title: `Document ${i}`,
          content: `Content for document ${i}`
        });
      }

      // Create empty documents_vec table (simulating interrupted rebuild)
      await createTable('documents_vec', createDocumentsVecSchema());

      // Manually add only partial vectors (simulating interrupted state)
      const vector = new Float32Array(768).fill(0.3);
      await addDocumentVector({
        id: 'partial-doc-1',
        content: 'Partial document',
        vector: vector,
        user_id: scope.userId,
        title: 'Partial'
      });

      // Execute checkAndRebuild - should detect incomplete and complete rebuild
      const result = await checkAndRebuild('documents_vec', scope);

      // Should detect mismatch and rebuild
      expect(result.rebuilt).toBe(true);
      expect(result.reason).toContain('incomplete');

      // All 5 documents should now be in vector table
      const count = await countDocumentVectors();
      expect(count).toBe(5);
    });
  });

  describe('Error handling', () => {
    it('should handle SQLite read errors gracefully', async () => {
      // Setup: Close SQLite connection to simulate read error
      const scope: Scope = { userId: 'user-9' };
      
      closeSQLiteConnection();

      // Execute rebuild
      const result = await rebuildTable('documents_vec', scope);

      // Expect error handling
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('sqlite_error');
    });

    it('should handle LanceDB write errors gracefully', async () => {
      // Setup: Create documents in SQLite, but LanceDB will fail
      const scope: Scope = { userId: 'user-10' };
      
      createDocument({
        user_id: scope.userId,
        doc_type: 'note',
        title: 'LanceDB Error Test',
        content: 'Testing LanceDB write error handling'
      });

      // Close LanceDB connection to simulate write error
      await closeConnection();
      resetConnection();

      // Execute rebuild - should handle LanceDB error
      const result = await rebuildTable('documents_vec', scope);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('lancedb_error');
    });
  });
});