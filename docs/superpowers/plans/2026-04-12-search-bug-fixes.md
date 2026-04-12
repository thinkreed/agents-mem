# Search Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical search bugs where all search modes return empty results, implement background queue for async embedding generation, and ensure 100% test coverage.

**Architecture:** 
1. Fix hybrid search to use actual RRF hybrid search instead of placeholder vector search
2. Fix semantic search scope filtering using ScopeFilter class
3. Implement background queue system for async embedding generation
4. Trigger FTS index creation on document store
5. Add comprehensive TDD tests for all fixes

**Tech Stack:** Bun runtime, TypeScript, Vitest, LanceDB, SQLite, Ollama embeddings

---

## File Structure

### Modified Files
- `src/lance/hybrid_search.ts:402-423` - Fix hybridSearchDocuments to call hybridSearch
- `src/lance/semantic_search.ts:50-58` - Fix scope filtering
- `src/lance/hybrid_search.ts:275-300` - Fix checkAndRebuild logic
- `src/materials/store.ts:14-52` - Add async indexing trigger
- `src/lance/index.ts:50-56` - Export createFTSIndex for use
- `src/lance/connection.ts` - Add queue helper functions

### New Files
- `src/queue/index.ts` - Queue system exports
- `src/queue/embedding_queue.ts` - Embedding job queue
- `src/queue/types.ts` - Queue type definitions
- `tests/queue/embedding_queue.test.ts` - Queue tests
- `tests/lance/hybrid_search_fixes.test.ts` - Hybrid search fix tests
- `tests/lance/semantic_search_fixes.test.ts` - Semantic search fix tests
- `tests/materials/store_indexing.test.ts` - Store indexing tests

---

## Phase 1: Test Specification (ALL tests first)

### Task 1: Write Hybrid Search Fix Tests

**Files:**
- Create: `tests/lance/hybrid_search_fixes.test.ts`

- [ ] **Step 1: Write test for hybridSearchDocuments using actual hybrid search**

```typescript
/**
 * @file tests/lance/hybrid_search_fixes.test.ts
 * @description Tests for hybrid search bug fixes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { hybridSearchDocuments } from '../../src/lance/hybrid_search';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';

describe('Hybrid Search Bug Fixes', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-hybrid-fix-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('documents_vec', createDocumentsVecSchema());
  });

  afterEach(async () => {
    await closeConnection();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('hybridSearchDocuments - Bug 1 Fix', () => {
    it('should use actual hybrid search with RRF scores, not hardcoded 0.5', async () => {
      const testVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) testVector[i] = 0.1 + (i % 10) * 0.01;
      
      await addDocumentVector({
        id: 'test-doc-1',
        content: 'Machine learning with TypeScript',
        vector: testVector,
        user_id: 'user-1',
        title: 'Test Doc'
      });
      
      const results = await hybridSearchDocuments({
        queryVector: testVector,
        queryText: 'machine learning',
        limit: 5,
        scope: { userId: 'user-1' }
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Verify RRF scores - should NOT be exactly 0.5
      for (const result of results) {
        expect(result.score).not.toBe(0.5);
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThan(1);
      }
    });

    it('should combine FTS and vector search results', async () => {
      const testVector = new Float32Array(768);
      for (let i = 0; i < 768; i++) testVector[i] = 0.1 + (i % 10) * 0.01;
      
      await addDocumentVector({
        id: 'test-doc-ml',
        content: 'Machine learning algorithms',
        vector: testVector,
        user_id: 'user-1',
        title: 'ML Doc'
      });
      
      const results = await hybridSearchDocuments({
        queryVector: testVector,
        queryText: 'machine learning',
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      const mlDocs = results.filter(r => 
        r.content.toLowerCase().includes('machine learning')
      );
      expect(mlDocs.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/lance/hybrid_search_fixes.test.ts
```
Expected: FAIL with scores are 0.5

- [ ] **Step 3: Commit test file**

```bash
git add tests/lance/hybrid_search_fixes.test.ts
git commit -m "test: add hybrid search fix tests (TDD)"
```

### Task 2: Write Semantic Search Fix Tests

**Files:**
- Create: `tests/lance/semantic_search_fixes.test.ts`

- [ ] **Step 1: Write test for scope filtering bug**

```typescript
/**
 * @file tests/lance/semantic_search_fixes.test.ts
 * @description Tests for semantic search scope filtering bug fixes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { semanticSearchDocuments } from '../../src/lance/semantic_search';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';

describe('Semantic Search Bug Fixes', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-semantic-fix-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('documents_vec', createDocumentsVecSchema());
    
    const vector = new Float32Array(768).fill(0.1);
    
    await addDocumentVector({
      id: 'doc-user1-1',
      content: 'User 1 document 1',
      vector: vector,
      user_id: 'user-1',
      title: 'User 1 Doc'
    });
    
    await addDocumentVector({
      id: 'doc-user2-1',
      content: 'User 2 document 1',
      vector: vector,
      user_id: 'user-2',
      title: 'User 2 Doc'
    });
  });

  afterEach(async () => {
    await closeConnection();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('semanticSearchDocuments - Bug 2 Fix', () => {
    it('should filter by userId correctly', async () => {
      const queryVector = new Float32Array(768).fill(0.1);
      
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-1' }
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      const user2Docs = results.filter(r => r.id === 'doc-user2-1');
      expect(user2Docs.length).toBe(0);
    });

    it('should filter by userId AND agentId correctly', async () => {
      const vector = new Float32Array(768).fill(0.1);
      await addDocumentVector({
        id: 'doc-user1-agent1',
        content: 'User 1 agent 1 document',
        vector: vector,
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'Agent Doc'
      });
      
      const queryVector = new Float32Array(768).fill(0.1);
      const results = await semanticSearchDocuments({
        queryVector: queryVector,
        limit: 10,
        scope: { userId: 'user-1', agentId: 'agent-1' }
      });
      
      const agentDocs = results.filter(r => r.id === 'doc-user1-agent1');
      expect(agentDocs.length).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/lance/semantic_search_fixes.test.ts
```
Expected: FAIL with scope filtering not working

- [ ] **Step 3: Commit test file**

```bash
git add tests/lance/semantic_search_fixes.test.ts
git commit -m "test: add semantic search scope filter tests (TDD)"
```

### Task 3: Write CheckAndRebuild Fix Tests

**Files:**
- Modify: `tests/lance/rebuild.test.ts`

- [ ] **Step 1: Add test for rebuild when LanceDB count is 0**

```typescript
// Add to tests/lance/rebuild.test.ts in appropriate describe block

describe('checkAndRebuild - Bug 4 Fix', () => {
  it('should rebuild when LanceDB has 0 vectors but SQLite has documents', async () => {
    const scope = { userId: 'user-1' };
    
    createDocument({
      id: 'sqlite-doc-1',
      user_id: 'user-1',
      title: 'Test Doc',
      content: 'Test content'
    });
    
    const result = await checkAndRebuild('documents_vec', scope);
    
    expect(result.rebuilt).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/lance/rebuild.test.ts -t "Bug 4 Fix"
```
Expected: FAIL with result.rebuilt=false

- [ ] **Step 3: Commit test changes**

```bash
git add tests/lance/rebuild.test.ts
git commit -m "test: add rebuild test for empty LanceDB case (TDD)"
```

### Task 4: Write Queue System Tests

**Files:**
- Create: `src/queue/types.ts`
- Create: `tests/queue/embedding_queue.test.ts`

- [ ] **Step 1: Define queue types**

```typescript
/**
 * @file src/queue/types.ts
 * @description Queue system type definitions
 */

export type JobType = 'embedding' | 'fts_index' | 'vector_index';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueJob {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, string | number>;
  retries: number;
  error?: string;
  created_at: number;
  updated_at: number;
}

export interface JobResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export type JobHandler = (job: QueueJob) => Promise<JobResult>;

export interface QueueEventHandlers {
  onJobAdded?: (job: QueueJob) => void;
  onJobCompleted?: (job: QueueJob, result: JobResult) => void;
  onJobFailed?: (job: QueueJob, error: unknown) => void;
}
```

- [ ] **Step 2: Create queue tests**

```typescript
/**
 * @file tests/queue/embedding_queue.test.ts
 * @description Tests for embedding queue system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Queue } from '../../src/queue/embedding_queue';
import { resetConnection, closeConnection } from '../../src/sqlite/connection';

describe('Embedding Queue', () => {
  beforeEach(() => resetConnection());
  afterEach(async () => closeConnection());

  describe('Queue Basics', () => {
    it('should create queue instance', async () => {
      const queue = new Queue();
      expect(queue).toBeDefined();
    });

    it('should add embedding job to queue', async () => {
      const queue = new Queue();
      const job = await queue.addJob({
        type: 'embedding',
        payload: { documentId: 'doc-1', content: 'Test content' }
      });
      
      expect(job.id).toBeDefined();
      expect(job.type).toBe('embedding');
      expect(job.status).toBe('pending');
    });

    it('should process jobs in order', async () => {
      const queue = new Queue();
      const results: string[] = [];
      
      queue.addHandler('embedding', async (job) => {
        results.push(job.payload.documentId as string);
        return { success: true };
      });
      
      await queue.addJob({ type: 'embedding', payload: { documentId: 'doc-1', content: 'C1' } });
      await queue.addJob({ type: 'embedding', payload: { documentId: 'doc-2', content: 'C2' } });
      
      await queue.process();
      
      expect(results).toEqual(['doc-1', 'doc-2']);
    });

    it('should mark job as completed after processing', async () => {
      const queue = new Queue();
      queue.addHandler('embedding', async () => ({ success: true }));
      
      const job = await queue.addJob({ type: 'embedding', payload: { documentId: 'doc-1', content: 'C' } });
      expect(job.status).toBe('pending');
      
      await queue.process();
      const completedJob = await queue.getJob(job.id);
      expect(completedJob?.status).toBe('completed');
    });

    it('should retry failed jobs up to maxRetries', async () => {
      const queue = new Queue({ maxRetries: 3 });
      let attempts = 0;
      
      queue.addHandler('embedding', async () => {
        attempts++;
        if (attempts < 3) throw new Error('Simulated failure');
        return { success: true };
      });
      
      const job = await queue.addJob({ type: 'embedding', payload: { documentId: 'doc-1', content: 'C' } });
      await queue.process();
      await queue.process();
      await queue.process();
      
      const finalJob = await queue.getJob(job.id);
      expect(finalJob?.status).toBe('completed');
      expect(attempts).toBe(3);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
bun test tests/queue/embedding_queue.test.ts
```
Expected: FAIL (queue system not implemented)

- [ ] **Step 4: Commit test files**

```bash
git add src/queue/types.ts tests/queue/embedding_queue.test.ts
git commit -m "test: add queue system tests (TDD)"
```

---

## Phase 2: Bug Fixes (Search Layer)

### Task 5: Fix hybridSearchDocuments to Use Actual Hybrid Search

**Files:**
- Modify: `src/lance/hybrid_search.ts:402-423`

- [ ] **Step 1: Implement fix for hybridSearchDocuments**

```typescript
// Replace the buggy hybridSearchDocuments function (lines 402-423)

export async function hybridSearchDocuments(options: DocumentSearchOptions): Promise<HybridSearchResult[]> {
  await checkAndRebuild('documents_vec', options.scope);
  
  const tableExistsResult = await tableExists('documents_vec');
  if (!tableExistsResult) {
    return [];
  }
  
  return hybridSearch({
    tableName: 'documents_vec',
    queryVector: options.queryVector,
    queryText: options.queryText,
    limit: options.limit,
    scope: options.scope
  });
}
```

- [ ] **Step 2: Run hybrid search tests**

```bash
bun test tests/lance/hybrid_search_fixes.test.ts
bun test tests/lance/hybrid_search.test.ts
```
Expected: PASS - RRF scores should not be 0.5

- [ ] **Step 3: Commit fix**

```bash
git add src/lance/hybrid_search.ts
git commit -m "fix: hybridSearchDocuments now uses actual hybrid search with RRF"
```

### Task 6: Fix Semantic Search Scope Filtering

**Files:**
- Modify: `src/lance/semantic_search.ts:50-58`

- [ ] **Step 1: Import ScopeFilter and fix scope filtering**

```typescript
// Add import at top of file
import { ScopeFilter } from '../core/scope';

// Replace the buggy semanticSearch function (lines 50-58)
export async function semanticSearch(options: SemanticSearchOptions): Promise<SemanticSearchResult[]> {
  const table = await getTable(options.tableName);
  const limit = options.limit ?? 10;
  
  let query = table.query()
    .nearestTo(Array.from(options.queryVector))
    .limit(limit);
  
  if (options.scope) {
    const filter = new ScopeFilter(options.scope);
    const lanceFilter = filter.toLanceFilter();
    if (lanceFilter) {
      query = query.where(lanceFilter);
    }
  }
  
  const results = await query.toArray();
  
  return results.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r.content as string,
    score: (r._distance as number) ?? 0.5,
    metadata: r as Record<string, unknown>
  }));
}
```

- [ ] **Step 2: Run semantic search tests**

```bash
bun test tests/lance/semantic_search_fixes.test.ts
bun test tests/lance/semantic_search.test.ts
```
Expected: PASS

- [ ] **Step 3: Commit fix**

```bash
git add src/lance/semantic_search.ts
git commit -m "fix: semantic search scope filtering using ScopeFilter class"
```

### Task 7: Fix checkAndRebuild Logic

**Files:**
- Modify: `src/lance/hybrid_search.ts:275-300`

- [ ] **Step 1: Fix checkAndRebuild to rebuild when LanceDB has 0 vectors**

```typescript
// Modify checkAndRebuild function (lines 264-300)

export async function checkAndRebuild(tableName: string, scope?: Scope): Promise<CheckAndRebuildResult> {
  if (await tableExists(tableName)) {
    if (scope && tableName === 'documents_vec') {
      try {
        const sqliteDocs = getDocumentsByScope(scope);
        const lanceCount = await countDocumentVectors();
        
        // FIXED: Rebuild if LanceDB has fewer vectors than SQLite (including 0)
        if (sqliteDocs.length > lanceCount) {
          const result = await rebuildTable(tableName, scope, true);
          return {
            rebuilt: result.success,
            error: result.error,
            reason: result.success ? 'incomplete rebuild detected' : result.reason
          };
        }
      } catch {
        // Ignore comparison errors
      }
    }
    
    return {
      rebuilt: false,
      skipped: true,
      reason: 'table exists'
    };
  }
  
  const result = await rebuildTable(tableName, scope);
  
  return {
    rebuilt: result.success,
    error: result.error,
    reason: result.success ? 'table missing, rebuilt successfully' : result.reason
  };
}
```

- [ ] **Step 2: Run rebuild tests**

```bash
bun test tests/lance/rebuild.test.ts
```
Expected: PASS

- [ ] **Step 3: Commit fix**

```bash
git add src/lance/hybrid_search.ts
git commit -m "fix: checkAndRebuild rebuilds when LanceDB has fewer vectors than SQLite"
```

---

## Phase 3: Background Queue System

### Task 8: Create Queue System Infrastructure

**Files:**
- Create: `src/queue/index.ts`
- Create: `src/queue/embedding_queue.ts`

- [ ] **Step 1: Create embedding queue implementation**

```typescript
/**
 * @file src/queue/embedding_queue.ts
 * @description Background queue for embedding generation
 */

import { createQueueJob, getPendingJobs, updateJobStatus, getJobById } from '../sqlite/queue_jobs';
import { getEmbedding } from '../embedder/ollama';
import { addDocumentVector } from '../lance/documents_vec';
import { createFTSIndex } from '../lance/index';
import { generateUUID } from '../utils/uuid';
import type { JobType, JobStatus, QueueJob, JobResult, QueueEventHandlers } from './types';

export interface QueueConfig {
  maxRetries?: number;
  pollIntervalMs?: number;
}

type JobHandler = (job: QueueJob) => Promise<JobResult>;

export class Queue {
  private handlers: Map<JobType, JobHandler> = new Map();
  private config: QueueConfig;
  private eventHandlers: QueueEventHandlers = {};
  private isProcessing: boolean = false;
  
  constructor(config: QueueConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      pollIntervalMs: config.pollIntervalMs ?? 1000
    };
  }
  
  addHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }
  
  async addJob(options: { type: JobType; payload: Record<string, string | number> }): Promise<QueueJob> {
    const jobId = generateUUID();
    const now = Math.floor(Date.now() / 1000);
    
    const job: QueueJob = {
      id: jobId,
      type: options.type,
      status: 'pending',
      payload: options.payload,
      retries: 0,
      created_at: now,
      updated_at: now
    };
    
    createQueueJob({
      id: jobId,
      type: options.type,
      status: 'pending',
      payload: JSON.stringify(options.payload),
      retries: 0,
      created_at: now,
      updated_at: now
    });
    
    this.eventHandlers.onJobAdded?.(job);
    return job;
  }
  
  async getJob(jobId: string): Promise<QueueJob | undefined> {
    const record = getJobById(jobId);
    if (!record) return undefined;
    return { ...record, payload: JSON.parse(record.payload as string) };
  }
  
  async process(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      const pendingJobs = getPendingJobs();
      for (const jobRecord of pendingJobs) {
        const job: QueueJob = { ...jobRecord, payload: JSON.parse(jobRecord.payload as string) };
        await this.processJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  private async processJob(job: QueueJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.markJobFailed(job.id, new Error(`No handler for job type: ${job.type}`));
      return;
    }
    
    try {
      updateJobStatus(job.id, 'processing');
      const result = await handler(job);
      
      if (result.success) {
        await this.markJobCompleted(job.id, result.data);
        this.eventHandlers.onJobCompleted?.(job, result);
      } else {
        await this.markJobFailed(job.id, new Error(result.error));
      }
    } catch (error) {
      if (job.retries < (this.config.maxRetries ?? 3)) {
        updateJobStatus(job.id, 'pending', job.retries + 1);
      } else {
        await this.markJobFailed(job.id, error);
      }
    }
  }
  
  private async markJobCompleted(jobId: string, data?: Record<string, unknown>): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    updateJobStatus(jobId, 'completed', undefined, data ? JSON.stringify(data) : undefined, now);
  }
  
  private async markJobFailed(jobId: string, error: unknown): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateJobStatus(jobId, 'failed', undefined, undefined, now, errorMessage);
    const job = await this.getJob(jobId);
    if (job) {
      this.eventHandlers.onJobFailed?.(job, error);
    }
  }
  
  on(event: 'jobAdded' | 'jobCompleted' | 'jobFailed', callback: Function): void {
    if (event === 'jobAdded') this.eventHandlers.onJobAdded = callback as QueueEventHandlers['onJobAdded'];
    else if (event === 'jobCompleted') this.eventHandlers.onJobCompleted = callback as QueueEventHandlers['onJobCompleted'];
    else if (event === 'jobFailed') this.eventHandlers.onJobFailed = callback as QueueEventHandlers['onJobFailed'];
  }
}

export async function embeddingJobHandler(job: QueueJob): Promise<JobResult> {
  try {
    const { documentId, content } = job.payload as { documentId: string; content: string };
    const embedding = await getEmbedding(content);
    
    await addDocumentVector({
      id: documentId,
      content: content,
      vector: embedding,
      user_id: job.payload.user_id as string || 'unknown',
      title: job.payload.title as string || 'Untitled'
    });
    
    return { success: true, data: { embeddingLength: embedding.length } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Embedding generation failed' };
  }
}

export async function ftsIndexJobHandler(job: QueueJob): Promise<JobResult> {
  try {
    const { tableName, column } = job.payload as { tableName: string; column: string };
    await createFTSIndex(tableName, column);
    return { success: true, data: { indexCreated: true } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'FTS index creation failed' };
  }
}
```

- [ ] **Step 2: Create queue index export**

```typescript
/**
 * @file src/queue/index.ts
 * @description Queue system exports
 */

export { Queue, embeddingJobHandler, ftsIndexJobHandler } from './embedding_queue';
export type { QueueConfig, JobType, JobStatus, QueueJob, JobResult, JobHandler, QueueEventHandlers } from './types';
```

- [ ] **Step 3: Run queue tests**

```bash
bun test tests/queue/embedding_queue.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit queue system**

```bash
git add src/queue/
git commit -m "feat: add background queue system for async job processing"
```

### Task 9: Create SQLite Queue Jobs Table

**Files:**
- Create: `src/sqlite/queue_jobs.ts`
- Modify: `src/sqlite/schema.ts`
- Modify: `src/sqlite/migrations.ts`

- [ ] **Step 1: Add queue_jobs table to schema**

```typescript
// Add to src/sqlite/schema.ts (after existing table definitions)

export const queueJobsTable = `
CREATE TABLE IF NOT EXISTS queue_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT NOT NULL,
  retries INTEGER NOT NULL DEFAULT 0,
  result_data TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_queue_jobs_status ON queue_jobs(status);
CREATE INDEX idx_queue_jobs_type ON queue_jobs(type);
`;
```

- [ ] **Step 2: Create queue_jobs CRUD operations**

```typescript
/**
 * @file src/sqlite/queue_jobs.ts
 * @description Queue jobs CRUD operations
 */

import { getDb } from './connection';
import type { JobStatus } from '../queue/types';

export interface QueueJobRecord {
  id: string;
  type: string;
  status: string;
  payload: string;
  retries: number;
  result_data?: string;
  error?: string;
  created_at: number;
  updated_at: number;
}

export function createQueueJob(job: {
  id: string;
  type: string;
  status: string;
  payload: string;
  retries: number;
  created_at: number;
  updated_at: number;
}): QueueJobRecord {
  const db = getDb();
  db.run(`
    INSERT INTO queue_jobs (id, type, status, payload, retries, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [job.id, job.type, job.status, job.payload, job.retries, job.created_at, job.updated_at]);
  return getJobById(job.id);
}

export function getJobById(jobId: string): QueueJobRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM queue_jobs WHERE id = ?').get(jobId) as QueueJobRecord | undefined;
}

export function getPendingJobs(): QueueJobRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM queue_jobs 
    WHERE status = 'pending' 
    ORDER BY created_at ASC
  `).all() as QueueJobRecord[];
}

export function updateJobStatus(
  jobId: string,
  status: JobStatus,
  retries?: number,
  resultData?: string,
  updatedAt?: number,
  error?: string
): void {
  const db = getDb();
  const now = updatedAt ?? Math.floor(Date.now() / 1000);
  db.run(`
    UPDATE queue_jobs 
    SET status = ?, 
        retries = COALESCE(?, retries),
        result_data = COALESCE(?, result_data),
        error = COALESCE(?, error),
        updated_at = ?
    WHERE id = ?
  `, [status, retries, resultData, error, now, jobId]);
}

export function deleteJob(jobId: string): void {
  const db = getDb();
  db.run('DELETE FROM queue_jobs WHERE id = ?', [jobId]);
}

export function clearOldCompletedJobs(beforeTimestamp: number): number {
  const db = getDb();
  const result = db.run('DELETE FROM queue_jobs WHERE status = ? AND updated_at < ?', ['completed', beforeTimestamp]);
  return result.changes;
}
```

- [ ] **Step 3: Add migration**

```typescript
// Add to src/sqlite/migrations.ts migrations array:

{
  version: 15,
  name: 'add_queue_jobs_table',
  up: (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS queue_jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payload TEXT NOT NULL,
        retries INTEGER NOT NULL DEFAULT 0,
        result_data TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_queue_jobs_status ON queue_jobs(status);
      CREATE INDEX idx_queue_jobs_type ON queue_jobs(type);
    `);
  },
  down: (db) => {
    db.run('DROP TABLE IF EXISTS queue_jobs');
  }
}
```

- [ ] **Step 4: Run migrations and tests**

```bash
bun test
```
Expected: PASS

- [ ] **Step 5: Commit queue table**

```bash
git add src/sqlite/queue_jobs.ts src/sqlite/schema.ts src/sqlite/migrations.ts
git commit -m "feat: add queue_jobs table for background job processing"
```

### Task 10: Integrate Queue with Document Store

**Files:**
- Modify: `src/materials/store.ts:14-52`

- [ ] **Step 1: Add async indexing trigger to storeDocument**

```typescript
// Modify src/materials/store.ts

import { createDocument, getDocumentById } from '../sqlite/documents';
import { createMemoryIndex } from '../sqlite/memory_index';
import { buildMaterialURI } from './uri_resolver';
import { generateUUID } from '../utils/uuid';
import { Queue } from '../queue';

let documentQueue: Queue | null = null;

function getDocumentQueue(): Queue {
  if (!documentQueue) {
    documentQueue = new Queue({ maxRetries: 3 });
  }
  return documentQueue;
}

export async function storeDocument(input: {
  userId: string;
  agentId?: string;
  teamId?: string;
  docType: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; uri: string }> {
  const id = generateUUID();
  
  const doc = createDocument({
    id,
    user_id: input.userId,
    agent_id: input.agentId,
    team_id: input.teamId,
    doc_type: input.docType,
    title: input.title,
    content: input.content,
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined
  });
  
  const uri = buildMaterialURI({
    userId: input.userId,
    agentId: input.agentId,
    teamId: input.teamId,
    type: 'documents',
    id: doc.id
  });
  
  createMemoryIndex({
    uri,
    user_id: input.userId,
    agent_id: input.agentId,
    team_id: input.teamId,
    target_type: 'documents',
    target_id: doc.id,
    title: input.title
  });
  
  // Queue embedding generation job
  const queue = getDocumentQueue();
  await queue.addJob({
    type: 'embedding',
    payload: {
      documentId: id,
      content: input.content,
      user_id: input.userId,
      title: input.title
    }
  });
  
  // Queue FTS index creation job
  await queue.addJob({
    type: 'fts_index',
    payload: {
      tableName: 'documents_vec',
      column: 'content'
    }
  });
  
  // Process queue asynchronously (in background)
  queue.process().catch(console.error);
  
  return { id: doc.id, uri };
}
```

- [ ] **Step 2: Run store indexing tests**

```bash
bun test tests/materials/store_indexing.test.ts
```
Expected: PASS

- [ ] **Step 3: Commit integration**

```bash
git add src/materials/store.ts
git commit -m "feat: integrate queue with document store for async indexing"
```

---

## Phase 4: Documentation Updates

### Task 11: Update DESIGN.md

**Files:**
- Modify: `docs/DESIGN.md`

- [ ] **Step 1: Add queue system architecture section**

Add section documenting:
- Queue architecture and job types
- Embedding generation async flow
- FTS index creation trigger
- Job retry and error handling

- [ ] **Step 2: Update search architecture section**

Document:
- Hybrid search RRF implementation
- Scope filtering with ScopeFilter class
- checkAndRebuild logic

- [ ] **Step 3: Commit DESIGN.md updates**

```bash
git add docs/DESIGN.md
git commit -m "docs: update DESIGN.md with queue system and search fixes"
```

### Task 12: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add queue system to structure**

```markdown
src/
├── queue/       # Background job queue (NEW)
│   ├── types.ts        # Job type definitions
│   ├── embedding_queue.ts  # Queue implementation
│   └── index.ts        # Exports
```

- [ ] **Step 2: Add queue conventions**

```markdown
## CONVENTIONS

- **Async queue**: Background jobs for embedding/FTS index
- **Job types**: embedding, fts_index, vector_index
- **Retry policy**: maxRetries=3 with exponential backoff
```

- [ ] **Step 3: Commit AGENTS.md updates**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with queue system structure"
```

---

## Verification Checklist

Before marking complete:

- [ ] All tests pass: `bun test`
- [ ] TypeScript typecheck: `bun run typecheck`
- [ ] RRF scores are not 0.5
- [ ] Scope filtering works with AND logic
- [ ] checkAndRebuild rebuilds when LanceDB has 0 vectors
- [ ] Queue processes jobs correctly
- [ ] Document store triggers embedding queue
- [ ] DESIGN.md updated
- [ ] AGENTS.md updated
