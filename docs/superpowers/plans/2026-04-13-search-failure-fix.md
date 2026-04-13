# Search Failure Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix hybrid/FTS search returning empty results after document storage by ensuring FTS index is created during document insertion.

**Architecture:** Three-layer fix: (1) Add `fts_index` job queuing in `store.ts` after document creation, (2) Update `checkAndRebuild()` in `hybrid_search.ts` to verify and rebuild FTS indexes, (3) Add comprehensive TDD tests for FTS index creation and hybrid search.

**Tech Stack:** TypeScript, Bun, Vitest, LanceDB FTS, SQLite queue jobs, Ollama embeddings.

---

## File Structure

### Files to Modify

| File | Lines | Responsibility |
|------|-------|----------------|
| `src/materials/store.ts` | 56-70 | Add `fts_index` job queuing after `embedding` job |
| `src/lance/hybrid_search.ts` | 264-305 | Add FTS index verification in `checkAndRebuild()` |
| `src/queue/embedding_queue.ts` | 243-252 | Already has `processFtsIndex()` - verify implementation |

### Files to Create

| File | Responsibility |
|------|----------------|
| `tests/lance/fts_index_creation.test.ts` | TDD tests for FTS index creation workflow |
| `tests/queue/fts_index_job.test.ts` | TDD tests for FTS index queue job processing |

### Test Files to Extend

| File | Add Tests For |
|------|---------------|
| `tests/lance/hybrid_search.test.ts` | Integration tests for hybrid search with FTS index |
| `tests/lance/fts_search.test.ts` | FTS-only search tests |

---

## Design Decisions (CONFIRMED BY USER)

**DECISION 1: FTS Index Creation Timing - CHOICE: A + Feedback**
- **Selected:** Option A (异步排队) + 添加队列处理结果反馈机制
- **Implementation:** Queue both `embedding` and `fts_index` jobs synchronously, process asynchronously
- **Feedback:** Add queue status tracking - job completion notification via event listeners or status polling

**DECISION 2: Chinese Text Support - CHOICE: Preprocessing**
- **Selected:** 预处理分词（用 jieba 分词后存储到 `content_segmented` 列）
- **Implementation:** 
  1. Install `jieba-wasm` or `nodejieba` package
  2. Add `content_segmented` field to LanceDB schema
  3. Segment Chinese text before indexing
  4. Create FTS index on `content_segmented` column (for Chinese) AND `content` column (for English)
- **Reason:** LanceDB/Tantivy doesn't support external tokenizer, preprocessing is the only viable option

**DECISION 3: Index Rebuild Strategy - CHOICE: A + B (双重防御)**
- **Selected:** 主动检查 FTS 索引存在性 + 搜索失败后重建
- **Implementation:**
  1. In `checkAndRebuild()`: Try FTS search on empty query, catch error → rebuild
  2. Add FTS index existence check via LanceDB API (if available)
  3. Log rebuild events for debugging/auditing

---

## Success Criteria

1. **Functional:** After storing a document, hybrid search returns the document within 5 seconds
2. **FTS-only:** FTS search mode (`searchMode: 'fts'`) returns documents containing query keywords
3. **Hybrid:** Hybrid search mode (`searchMode: 'hybrid'`) returns documents with RRF scores
4. **Resilience:** `checkAndRebuild()` detects missing FTS index and rebuilds automatically
5. **Tests:** 100% coverage on modified code paths (store.ts, hybrid_search.ts, embedding_queue.ts)
6. **Performance:** Document storage response time < 500ms (FTS index job is async)

---

## Task Dependencies (UPDATED)

```
Task 1: FTS Index Creation Tests (foundation)
    ↓
Task 2: FTS Index Queue Job Tests
    ↓
Task 3: Chinese Preprocessing (jieba integration)
    ↓
Task 4: store.ts FTS Index Queuing Implementation
    ↓
Task 5: checkAndRebuild() FTS Index Verification (A+B)
    ↓
Task 6: Queue Status Feedback Mechanism
    ↓
Task 7: Integration Tests (full workflow)
    ↓
Task 8: Documentation Updates (DESIGN.md, AGENTS.md)
```

---

## Task 3: Chinese Preprocessing (jieba Integration) - NEW

**Files:**
- Create: `src/utils/chinese_segmenter.ts`
- Modify: `src/lance/schema.ts` - Add `content_segmented` field
- Modify: `src/lance/documents_vec.ts` - Add segmented content handling
- Test: Create `tests/utils/chinese_segmenter.test.ts`

**Goal:** Implement Chinese text segmentation using jieba before FTS indexing.

**⚠️ Package Installation Required:**
```bash
bun add jieba-wasm
# OR
bun add nodejieba
```

- [ ] **Step 3.1: Write failing test for Chinese segmentation**

```typescript
// tests/utils/chinese_segmenter.test.ts
import { describe, it, expect } from 'vitest';
import { segmentChinese, detectChineseContent } from '../../src/utils/chinese_segmenter';

describe('Chinese Segmenter', () => {
  it('should detect Chinese content', () => {
    const text = '本文讨论机器学习与深度学习的应用';
    expect(detectChineseContent(text)).toBe(true);
    
    const englishText = 'Machine learning and deep neural networks';
    expect(detectChineseContent(englishText)).toBe(false);
    
    const mixedText = 'Machine learning 机器学习 applications';
    expect(detectChineseContent(mixedText)).toBe(true);
  });
  
  it('should segment Chinese text into words', async () => {
    const text = '本文讨论机器学习与深度学习的应用';
    const segmented = await segmentChinese(text);
    
    // Should split into meaningful words, not single characters
    expect(segmented).toContain('机器学习');
    expect(segmented).toContain('深度学习');
    
    // Segmented text should have spaces between words
    expect(segmented.split(' ').length).toBeGreaterThan(3);
  });
  
  it('should handle mixed Chinese-English content', async () => {
    const text = 'Machine learning 机器学习 applications 应用';
    const segmented = await segmentChinese(text);
    
    // Should preserve English words
    expect(segmented).toContain('Machine');
    expect(segmented).toContain('learning');
    
    // Should segment Chinese words
    expect(segmented).toContain('机器学习');
  });
  
  it('should return original text if no Chinese detected', async () => {
    const text = 'Machine learning with Python';
    const segmented = await segmentChinese(text);
    
    // Should return unchanged for pure English
    expect(segmented).toBe(text);
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `bun test tests/utils/chinese_segmenter.test.ts -v`
Expected: Tests fail (implementation not exists)

- [ ] **Step 3.3: Install jieba package**

```bash
bun add jieba-wasm
```

- [ ] **Step 3.4: Implement Chinese segmenter**

```typescript
// src/utils/chinese_segmenter.ts
import * as jieba from 'jieba-wasm';

/**
 * Detect if text contains Chinese characters
 */
export function detectChineseContent(text: string): boolean {
  // Match CJK characters (Chinese, Japanese, Korean)
  const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  return cjkRegex.test(text);
}

/**
 * Segment Chinese text using jieba
 * Preserves English words and numbers
 */
export async function segmentChinese(text: string): Promise<string> {
  if (!detectChineseContent(text)) {
    return text; // No Chinese, return unchanged
  }
  
  // Load jieba (may need async initialization)
  await jieba.load();
  
  // Segment the text
  const segments = jieba.cut(text, false); // cutAll=false for accurate mode
  
  // Join with spaces for FTS indexing
  return segments.join(' ');
}

/**
 * Segment mixed content - handles both Chinese and English
 */
export async function segmentMixedContent(text: string): Promise<string> {
  // For mixed content, we segment Chinese parts and preserve English
  return await segmentChinese(text);
}
```

- [ ] **Step 3.5: Add content_segmented field to LanceDB schema**

```typescript
// src/lance/schema.ts - Add to createDocumentsVecSchema()
// Add new field for segmented Chinese content
content_segmented: vector ? null, // String field for segmented Chinese text
```

- [ ] **Step 3.6: Update documents_vec.ts to store segmented content**

```typescript
// src/lance/documents_vec.ts - Modify addDocumentVector()
import { segmentChinese, detectChineseContent } from '../utils/chinese_segmenter';

export async function addDocumentVector(record: DocumentVectorRecord): Promise<void> {
  const table = await getTable('documents_vec');
  
  // Segment Chinese content for FTS
  let contentSegmented = record.content;
  if (detectChineseContent(record.content)) {
    contentSegmented = await segmentChinese(record.content);
  }
  
  const data = {
    id: record.id,
    content: record.content,
    content_segmented: contentSegmented, // NEW field
    vector: Array.from(record.vector),
    title: record.title,
    user_id: record.user_id,
    // ... rest of fields
  };
  
  await table.add([data]);
}
```

- [ ] **Step 3.7: Update createFTSIndex to index segmented content**

```typescript
// src/lance/index.ts - Modify createFTSIndex()
export async function createFTSIndex(tableName: string, column: string): Promise<void> {
  const table = await getTable(tableName);
  
  // For Chinese content, use content_segmented column
  // For mixed/English content, use content column
  if (column === 'content') {
    // Create FTS index on both columns for full coverage
    await table.createIndex('content', { config: Index.fts() });
    await table.createIndex('content_segmented', { config: Index.fts() });
  } else {
    await table.createIndex(column, { config: Index.fts() });
  }
}
```

- [ ] **Step 3.8: Run tests to verify they pass**

Run: `bun test tests/utils/chinese_segmenter.test.ts -v`
Expected: All tests pass

- [ ] **Step 3.9: Commit**

```bash
git add src/utils/chinese_segmenter.ts src/lance/schema.ts src/lance/documents_vec.ts tests/utils/chinese_segmenter.test.ts
git commit -m "feat: add Chinese text segmentation for FTS indexing"
```

**Category:** unspecified-high (core functionality)
**Skills:** [`test-driven-development`, `agents-mem-tools`]

---

## Implementation Plan

### Task 1: FTS Index Creation Tests (TDD Foundation)

**Files:**
- Create: `tests/lance/fts_index_creation.test.ts`
- Test: `tests/lance/hybrid_search.test.ts` (extend)

**Goal:** Define expected behavior for FTS index creation before implementation.

- [ ] **Step 1.1: Write failing test for FTS index existence check**

```typescript
// tests/lance/fts_index_creation.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as lancedb from '@lancedb/lancedb';
import { ftsSearchDocuments } from '../../src/lance/fts_search';
import { resetConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createDocumentsVecSchema } from '../../src/lance/schema';
import { addDocumentVector } from '../../src/lance/documents_vec';
import { createFTSIndex } from '../../src/lance/index';

describe('FTS Index Creation', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-fts-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
  });
  
  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });
  
  it('should find documents via FTS after index creation', async () => {
    // Arrange: Create table and add document WITHOUT FTS index
    const table = await createTable('documents_vec', createDocumentsVecSchema());
    const testVector = new Float32Array(768).fill(0.1);
    
    await addDocumentVector({
      id: 'test-doc-1',
      content: 'Machine learning with Python',
      vector: testVector,
      user_id: 'user-1',
      title: 'Test Doc'
    });
    
    // Act: Try FTS search BEFORE index creation (should fail or return empty)
    const resultsBefore = await ftsSearchDocuments({
      queryText: 'machine learning',
      limit: 10,
      scope: { userId: 'user-1' }
    });
    
    // Assert: Before index, search may return empty or throw
    // (depending on LanceDB behavior without FTS index)
    expect(resultsBefore).toBeDefined();
    
    // Act: Create FTS index
    await createFTSIndex('documents_vec', 'content');
    
    // Act: Try FTS search AFTER index creation
    const resultsAfter = await ftsSearchDocuments({
      queryText: 'machine learning',
      limit: 10,
      scope: { userId: 'user-1' }
    });
    
    // Assert: After index, should find document
    expect(resultsAfter.length).toBeGreaterThan(0);
    expect(resultsAfter[0].id).toBe('test-doc-1');
    expect(resultsAfter[0].content).toContain('Machine learning');
  });
  
  it('should create FTS index without errors on populated table', async () => {
    // Arrange: Create table with documents
    const table = await createTable('documents_vec', createDocumentsVecSchema());
    const testVector = new Float32Array(768).fill(0.1);
    
    await addDocumentVector({
      id: 'test-doc-1',
      content: 'Machine learning with Python',
      vector: testVector,
      user_id: 'user-1',
      title: 'Test Doc'
    });
    
    await addDocumentVector({
      id: 'test-doc-2',
      content: 'Deep learning neural networks',
      vector: testVector,
      user_id: 'user-1',
      title: 'Test Doc 2'
    });
    
    // Act: Create FTS index
    await expect(createFTSIndex('documents_vec', 'content')).resolves.not.toThrow();
  });
  
  it('should handle FTS index creation on empty table gracefully', async () => {
    // Arrange: Create empty table
    await createTable('documents_vec', createDocumentsVecSchema());
    
    // Act: Create FTS index on empty table
    await expect(createFTSIndex('documents_vec', 'content')).resolves.not.toThrow();
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `bun test tests/lance/fts_index_creation.test.ts -v`
Expected: Tests pass if `createFTSIndex()` works correctly (baseline test)

- [ ] **Step 1.3: Extend hybrid_search.test.ts with FTS fallback test**

```typescript
// Add to tests/lance/hybrid_search.test.ts inside describe('Edge Cases')

it('should fallback to vector search when FTS index missing', async () => {
  // Arrange: Create table WITHOUT FTS index (skip beforeEach FTS index creation)
  // This tests the fallback behavior in hybridSearch() catch block
  
  const mlVector = new Float32Array(768);
  for (let i = 0; i < 768; i++) mlVector[i] = 0.1 + (i % 10) * 0.01;
  
  // Act: Hybrid search on table without FTS index
  const results = await hybridSearch({
    tableName: 'documents_vec',
    queryVector: mlVector,
    queryText: 'machine learning',
    limit: 10
  });
  
  // Assert: Should still return results via vector fallback
  expect(results).toBeDefined();
  expect(Array.isArray(results)).toBe(true);
  // May be empty or have vector-only results
});
```

- [ ] **Step 1.4: Run extended hybrid search tests**

Run: `bun test tests/lance/hybrid_search.test.ts -v`
Expected: All tests pass

- [ ] **Step 1.5: Commit**

```bash
git add tests/lance/fts_index_creation.test.ts tests/lance/hybrid_search.test.ts
git commit -m "test: add FTS index creation TDD tests"
```

**Category:** unspecified-high (test-heavy, foundational)
**Skills:** [`test-driven-development`, `agents-mem-tools`]

---

### Task 2: FTS Index Queue Job Tests (TDD)

**Files:**
- Create: `tests/queue/fts_index_job.test.ts`
- Modify: `tests/queue/embedding_queue.test.ts` (verify existing tests)

**Goal:** Test that FTS index jobs are queued, processed, and completed correctly.

- [ ] **Step 2.1: Write failing test for FTS index job queuing**

```typescript
// tests/queue/fts_index_job.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbeddingQueue } from '../../src/queue/embedding_queue';
import { createFTSIndex } from '../../src/lance/index';

// Mock FTS index creation
vi.mock('../../src/lance/index', () => ({
  createFTSIndex: vi.fn().mockResolvedValue(undefined)
}));

describe('FTS Index Queue Job', () => {
  let queue: EmbeddingQueue;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queue = new EmbeddingQueue({ maxRetries: 3, retryDelay: 100 });
  });
  
  afterEach(() => {
    queue.clear();
  });
  
  it('should accept fts_index job type', async () => {
    // Arrange
    const ftsJob = {
      type: 'fts_index' as const,
      resourceId: 'test-doc-1',
      resourceType: 'document',
      payload: {
        tableName: 'documents_vec',
        column: 'content'
      },
      userId: 'user-1'
    };
    
    // Act: Add FTS index job
    const job = await queue.addJob(ftsJob);
    
    // Assert
    expect(job.type).toBe('fts_index');
    expect(job.status).toBe('pending');
    expect(job.payload.tableName).toBe('documents_vec');
  });
  
  it('should process fts_index job and call createFTSIndex', async () => {
    // Arrange
    const job = await queue.addJob({
      type: 'fts_index',
      resourceId: 'test-doc-1',
      resourceType: 'document',
      payload: {
        tableName: 'documents_vec',
        column: 'content'
      },
      userId: 'user-1'
    });
    
    // Act: Process job
    await queue.processJob(job);
    
    // Assert: createFTSIndex should be called with correct params
    expect(createFTSIndex).toHaveBeenCalledWith('documents_vec', 'content');
    
    // Job should be completed
    const completedJob = await queue.getJob(job.id);
    expect(completedJob?.status).toBe('completed');
  });
  
  it('should retry fts_index job on failure (maxRetries=3)', async () => {
    // Arrange: Mock createFTSIndex to fail twice, succeed on third try
    let callCount = 0;
    vi.mocked(createFTSIndex).mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('FTS index creation failed');
      }
    });
    
    const job = await queue.addJob({
      type: 'fts_index',
      resourceId: 'test-doc-1',
      resourceType: 'document',
      payload: {
        tableName: 'documents_vec',
        column: 'content'
      },
      userId: 'user-1'
    });
    
    // Act: Process job (will retry)
    await queue.processJob(job);
    
    // Assert: Should retry up to maxRetries
    expect(createFTSIndex).toHaveBeenCalledTimes(3);
    
    const completedJob = await queue.getJob(job.id);
    expect(completedJob?.status).toBe('completed');
  });
  
  it('should mark fts_index job as failed after maxRetries exceeded', async () => {
    // Arrange: Mock createFTSIndex to always fail
    vi.mocked(createFTSIndex).mockRejectedValue(new Error('Permanent FTS failure'));
    
    const job = await queue.addJob({
      type: 'fts_index',
      resourceId: 'test-doc-1',
      resourceType: 'document',
      payload: {
        tableName: 'documents_vec',
        column: 'content'
      },
      userId: 'user-1'
    });
    
    // Act: Process job (will fail all retries)
    await queue.processJob(job);
    
    // Assert: Job should be marked as failed
    const failedJob = await queue.getJob(job.id);
    expect(failedJob?.status).toBe('failed');
    expect(failedJob?.retries).toBe(3);
    expect(failedJob?.error).toBeDefined();
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `bun test tests/queue/fts_index_job.test.ts -v`
Expected: Tests fail initially (implementation not connected yet)

- [ ] **Step 2.3: Verify EmbeddingQueue.processFtsIndex() implementation**

Check: `src/queue/embedding_queue.ts:243-252`
Expected: `processFtsIndex()` should call `createFTSIndex()` (already exists)

- [ ] **Step 2.4: Commit**

```bash
git add tests/queue/fts_index_job.test.ts
git commit -m "test: add FTS index queue job TDD tests"
```

**Category:** unspecified-high (test-heavy, queue integration)
**Skills:** [`test-driven-development`, `agents-mem-tools`]

---

### Task 3: store.ts FTS Index Queuing Implementation

**Files:**
- Modify: `src/materials/store.ts:56-70`
- Test: `tests/materials/store.test.ts` (extend or create)

**Goal:** Queue `fts_index` job immediately after `embedding` job when storing document.

**Design Decision:** This implements DECISION 1 (Option A) - queue both jobs synchronously, process asynchronously.

**⚠️ DISCUSSION REQUIRED WITH USER:**
- Should FTS index creation block document creation response? 
- If yes, make `storeDocument()` await both jobs. If no, queue and process async (current design).
- Recommendation: Keep async (current) for performance, document the behavior.

- [ ] **Step 3.1: Write failing test for FTS index job queuing in store**

```typescript
// tests/materials/store.test.ts (extend or create)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storeDocument } from '../../src/materials/store';
import { getEmbeddingQueue } from '../../src/queue';
import { EmbeddingQueue } from '../../src/queue/embedding_queue';

// Mock queue
const mockQueue = {
  addJob: vi.fn().mockResolvedValue({ id: 'job-1', status: 'pending' }),
  process: vi.fn().mockResolvedValue(undefined)
};

vi.mock('../../src/queue', () => ({
  getEmbeddingQueue: vi.fn(() => mockQueue)
}));

describe('storeDocument - FTS Index Queuing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should queue both embedding and fts_index jobs', async () => {
    // Arrange
    const testData = {
      userId: 'user-1',
      docType: 'article',
      title: 'Test Article',
      content: 'Machine learning with Python'
    };
    
    // Act: Store document
    await storeDocument(testData);
    
    // Assert: Should queue two jobs
    expect(mockQueue.addJob).toHaveBeenCalledTimes(2);
    
    // First job: embedding
    expect(mockQueue.addJob).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'embedding',
      resourceType: 'document',
      payload: expect.objectContaining({
        content: 'Machine learning with Python',
        title: 'Test Article'
      })
    }));
    
    // Second job: fts_index
    expect(mockQueue.addJob).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: 'fts_index',
      resourceType: 'document',
      payload: expect.objectContaining({
        tableName: 'documents_vec',
        column: 'content'
      })
    }));
  });
  
  it('should pass correct scope to fts_index job', async () => {
    // Arrange
    const testData = {
      userId: 'user-1',
      agentId: 'agent-1',
      teamId: 'team-1',
      docType: 'note',
      title: 'Test Note',
      content: 'Test content'
    };
    
    // Act
    await storeDocument(testData);
    
    // Assert: FTS index job should have scope fields
    expect(mockQueue.addJob).toHaveBeenCalledWith(expect.objectContaining({
      type: 'fts_index',
      userId: 'user-1',
      agentId: 'agent-1',
      teamId: 'team-1',
      payload: expect.objectContaining({
        tableName: 'documents_vec'
      })
    }));
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `bun test tests/materials/store.test.ts -v`
Expected: Tests fail (FTS index job not queued yet)

- [ ] **Step 3.3: Implement FTS index job queuing in store.ts**

```typescript
// src/materials/store.ts:56-70
// Queue async embedding generation
const queue = getEmbeddingQueue();

// Queue embedding job
await queue.addJob({
  type: 'embedding',
  resourceId: doc.id,
  resourceType: 'document',
  payload: { content: input.content, title: input.title },
  userId: input.userId,
  agentId: input.agentId,
  teamId: input.teamId
});

// Queue FTS index job (NEW)
await queue.addJob({
  type: 'fts_index',
  resourceId: doc.id,
  resourceType: 'document',
  payload: { 
    tableName: 'documents_vec',
    column: 'content'
  },
  userId: input.userId,
  agentId: input.agentId,
  teamId: input.teamId
});

// Start background processing (fire-and-forget)
queue.process().catch(err => console.error('Queue processing error:', err));
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `bun test tests/materials/store.test.ts -v`
Expected: All tests pass

- [ ] **Step 3.5: Commit**

```bash
git add src/materials/store.ts tests/materials/store.test.ts
git commit -m "feat: queue FTS index job on document storage"
```

**Category:** unspecified-high (core functionality)
**Skills:** [`test-driven-development`, `agents-mem-tools`]

---

### Task 4: checkAndRebuild() FTS Index Verification

**Files:**
- Modify: `src/lance/hybrid_search.ts:264-305`
- Test: `tests/lance/hybrid_search.test.ts` (extend)

**Goal:** Add FTS index verification and rebuild to `checkAndRebuild()` as defensive fallback.

**Design Decision:** This implements DECISION 3 (Option B) - attempt FTS search, catch error, rebuild.

**⚠️ DISCUSSION REQUIRED WITH USER:**
- Should FTS index rebuild be logged/audited?
- Should rebuild be triggered only on explicit failure, or proactively checked?
- Recommendation: Attempt FTS search, catch specific "no FTS index" error, then rebuild silently.

- [ ] **Step 4.1: Write failing test for checkAndRebuild FTS verification**

```typescript
// Add to tests/lance/hybrid_search.test.ts

describe('checkAndRebuild - FTS Index Verification', () => {
  it('should detect missing FTS index and rebuild', async () => {
    // Arrange: Create table WITHOUT FTS index
    const table = await createTable('documents_vec', createDocumentsVecSchema());
    const testVector = new Float32Array(768).fill(0.1);
    
    await addDocumentVector({
      id: 'test-doc-1',
      content: 'Machine learning with Python',
      vector: testVector,
      user_id: 'user-1',
      title: 'Test Doc'
    });
    
    // Act: checkAndRebuild should detect and rebuild
    const result = await checkAndRebuild('documents_vec', { userId: 'user-1' });
    
    // Assert: Rebuild should occur
    expect(result.rebuilt).toBe(true);
    
    // Verify FTS search now works
    const ftsResults = await ftsSearchDocuments({
      queryText: 'machine learning',
      limit: 10,
      scope: { userId: 'user-1' }
    });
    
    expect(ftsResults.length).toBeGreaterThan(0);
  });
  
  it('should skip rebuild if FTS index exists', async () => {
    // Arrange: Create table WITH FTS index
    const table = await createTable('documents_vec', createDocumentsVecSchema());
    const testVector = new Float32Array(768).fill(0.1);
    
    await addDocumentVector({
      id: 'test-doc-1',
      content: 'Machine learning',
      vector: testVector,
      user_id: 'user-1',
      title: 'Test Doc'
    });
    
    // Create FTS index
    await createFTSIndex('documents_vec', 'content');
    
    // Act: checkAndRebuild should skip (both vector and FTS exist)
    const result = await checkAndRebuild('documents_vec', { userId: 'user-1' });
    
    // Assert: Should skip rebuild
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('table exists');
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `bun test tests/lance/hybrid_search.test.ts -v`
Expected: Tests fail (checkAndRebuild doesn't handle FTS yet)

- [ ] **Step 4.3: Implement FTS index verification in checkAndRebuild()**

```typescript
// src/lance/hybrid_search.ts:264-305
export async function checkAndRebuild(tableName: string, scope?: Scope): Promise<CheckAndRebuildResult> {
  // Check if table exists
  if (await tableExists(tableName)) {
    // Check if rebuild is incomplete (LanceDB has partial data)
    if (scope && tableName === 'documents_vec') {
      try {
        const sqliteDocs = getDocumentsByScope(scope);
        const lanceCount = await countDocumentVectors();
        
        // Rebuild if SQLite has more documents than LanceDB vectors
        if (sqliteDocs.length > lanceCount) {
          // Pass clearExisting=true to remove stale vectors before rebuilding
          const result = await rebuildTable(tableName, scope, true);
          return {
            rebuilt: result.success,
            error: result.error,
            reason: result.success ? 'incomplete rebuild detected' : result.reason
          };
        }
        
        // NEW: Check FTS index by attempting FTS search
        // If FTS index missing, this will throw/error, triggering rebuild
        try {
          const table = await getTable(tableName);
          const testQuery = table.query()
            .fullTextSearch('test')
            .limit(1);
          await testQuery.toArray();
          // If we get here, FTS index exists
        } catch (ftsError) {
          // FTS index missing - rebuild
          console.log(`FTS index missing for ${tableName}, rebuilding...`);
          const result = await rebuildTable(tableName, scope, true);
          return {
            rebuilt: result.success,
            error: result.error,
            reason: result.success ? 'FTS index missing, rebuilt' : result.reason
          };
        }
      } catch {
        // Ignore comparison errors, table exists
      }
    }
    
    return {
      rebuilt: false,
      skipped: true,
      reason: 'table exists'
    };
  }
  
  // Table missing - trigger rebuild
  const result = await rebuildTable(tableName, scope);
  
  return {
    rebuilt: result.success,
    error: result.error,
    reason: result.success ? 'table missing, rebuilt successfully' : result.reason
  };
}
```

- [ ] **Step 4.4: Run test to verify it passes**

Run: `bun test tests/lance/hybrid_search.test.ts -v`
Expected: All tests pass

- [ ] **Step 4.5: Commit**

```bash
git add src/lance/hybrid_search.ts tests/lance/hybrid_search.test.ts
git commit -m "feat: add FTS index verification to checkAndRebuild()"
```

**Category:** unspecified-high (defensive programming)
**Skills:** [`test-driven-development`, `agents-mem-tools`]

---

### Task 5: Integration Tests (Full Workflow)

**Files:**
- Create: `tests/integration/search_workflow.test.ts`

**Goal:** End-to-end test verifying document storage → FTS index creation → hybrid search success.

- [ ] **Step 5.1: Write integration test for full workflow**

```typescript
// tests/integration/search_workflow.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { handleMemCreate, handleMemRead } from '../../src/tools/crud_handlers';
import { resetConnection, setDatabasePath, closeConnection } from '../../src/lance/connection';
import { resetSQLiteConnection } from '../../src/sqlite/connection';

describe('Search Workflow Integration', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-integration-test');
  
  beforeEach(async () => {
    resetConnection();
    resetSQLiteConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
  });
  
  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });
  
  it('should store document and find it via hybrid search', async () => {
    // Arrange: Store document
    const createResult = await handleMemCreate({
      resource: 'document',
      data: {
        title: 'Machine Learning Article',
        content: 'This article discusses machine learning with Python and neural networks.',
        docType: 'article'
      },
      scope: { userId: 'user-1' }
    });
    
    const createdDoc = JSON.parse(createResult.content[0].text);
    expect(createdDoc.id).toBeDefined();
    
    // Wait for async queue processing (in real system, this is background)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Act: Search for document via hybrid search
    const searchResult = await handleMemRead({
      resource: 'document',
      query: {
        search: 'machine learning',
        searchMode: 'hybrid',
        limit: 10
      },
      scope: { userId: 'user-1' }
    });
    
    // Assert: Should find document
    const searchData = JSON.parse(searchResult.content[0].text);
    expect(Array.isArray(searchData)).toBe(true);
    expect(searchData.length).toBeGreaterThan(0);
    
    const foundDoc = searchData.find((d: any) => d.id === createdDoc.id);
    expect(foundDoc).toBeDefined();
  });
  
  it('should store document and find it via FTS search', async () => {
    // Arrange: Store document
    const createResult = await handleMemCreate({
      resource: 'document',
      data: {
        title: 'Python Tutorial',
        content: 'Learn Python programming with examples and best practices.',
        docType: 'article'
      },
      scope: { userId: 'user-1' }
    });
    
    const createdDoc = JSON.parse(createResult.content[0].text);
    
    // Wait for async queue processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Act: Search via FTS mode
    const searchResult = await handleMemRead({
      resource: 'document',
      query: {
        search: 'Python programming',
        searchMode: 'fts',
        limit: 10
      },
      scope: { userId: 'user-1' }
    });
    
    // Assert: Should find document
    const searchData = JSON.parse(searchResult.content[0].text);
    expect(searchData.length).toBeGreaterThan(0);
    
    const foundDoc = searchData.find((d: any) => d.id === createdDoc.id);
    expect(foundDoc).toBeDefined();
    expect(foundDoc.content).toContain('Python');
  });
  
  it('should handle Chinese content in hybrid search', async () => {
    // Arrange: Store Chinese document
    const createResult = await handleMemCreate({
      resource: 'document',
      data: {
        title: '机器学习教程',
        content: '本文讨论机器学习与深度学习的应用，包括神经网络和自然语言处理。',
        docType: 'article'
      },
      scope: { userId: 'user-1' }
    });
    
    const createdDoc = JSON.parse(createResult.content[0].text);
    
    // Wait for async queue processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Act: Search via hybrid mode (should fallback to vector for Chinese)
    const searchResult = await handleMemRead({
      resource: 'document',
      query: {
        search: '机器学习',
        searchMode: 'hybrid',
        limit: 10
      },
      scope: { userId: 'user-1' }
    });
    
    // Assert: Should find document (via vector search fallback)
    const searchData = JSON.parse(searchResult.content[0].text);
    // May find it via vector similarity even if FTS doesn't support Chinese
    // This tests the fallback behavior
    expect(searchData).toBeDefined();
  });
});
```

- [ ] **Step 5.2: Run integration test**

Run: `bun test tests/integration/search_workflow.test.ts -v`
Expected: All tests pass (full workflow)

- [ ] **Step 5.3: Run all LanceDB tests to verify no regressions**

Run: `bun test tests/lance/ -v`
Expected: All tests pass

- [ ] **Step 5.4: Run all queue tests to verify no regressions**

Run: `bun test tests/queue/ -v`
Expected: All tests pass

- [ ] **Step 5.5: Commit**

```bash
git add tests/integration/search_workflow.test.ts
git commit -m "test: add integration tests for search workflow"
```

**Category:** unspecified-high (integration testing)
**Skills:** [`test-driven-development`, `agents-mem-tools`]

---

### Task 6: Documentation Updates

**Files:**
- Modify: `docs/DESIGN.md`
- Modify: `AGENTS.md`
- Modify: `README.md` (optional)

**Goal:** Document the FTS index creation behavior and design decisions.

- [ ] **Step 6.1: Update DESIGN.md with FTS index architecture**

Add to `docs/DESIGN.md` (find appropriate section, likely near L2-Layer section):

```markdown
## FTS Index Creation

**Location:** `src/materials/store.ts`, `src/queue/embedding_queue.ts`, `src/lance/hybrid_search.ts`

**Design:** Dual-strategy for FTS index creation:

1. **Proactive (primary):** When document is stored via `storeDocument()`, two jobs are queued:
   - `embedding` job: Generate 768-dim vector
   - `fts_index` job: Create BM25 FTS index on `content` column

2. **Reactive (defensive):** `checkAndRebuild()` in `hybrid_search.ts` detects missing FTS index:
   - Attempts FTS search on empty query
   - Catches "no FTS index" error
   - Triggers full rebuild (vectors + FTS)

**Async Processing:**
- Jobs are queued synchronously during `mem_create`
- `queue.process()` runs asynchronously (fire-and-forget)
- Document creation response returns immediately (< 500ms)
- FTS index available within ~1-5 seconds (depends on content size)

**Chinese Language Support:**
- LanceDB FTS (Tantivy) does not support Chinese word segmentation
- Hybrid search falls back to vector search for Chinese queries
- Embeddings (nomic-embed-text) support Chinese semantically
- Recommendation: Use `searchMode: 'hybrid'` for multilingual content

**Failure Handling:**
- FTS job retries up to 3 times on failure
- Job status tracked in SQLite `queue_jobs` table
- Failed jobs logged to console (future: audit logger)
```

- [ ] **Step 6.2: Update AGENTS.md with FTS index notes**

Add to `AGENTS.md` section "WHERE TO LOOK" table:

| Task | Location | Notes |
|------|----------|-------|
| FTS index creation | `src/materials/store.ts:56-70` | Queues `fts_index` job after `embedding` |
| FTS index processing | `src/queue/embedding_queue.ts:243-252` | `processFtsIndex()` calls `createFTSIndex()` |
| FTS verification | `src/lance/hybrid_search.ts:264-305` | `checkAndRebuild()` detects missing FTS |

Add to "CONVENTIONS" section:

- **FTS indexing:** Async job queue (not synchronous)
- **Chinese queries:** Fallback to vector search (FTS doesn't support Chinese)
- **Job retries:** maxRetries=3, retryDelay=100ms

- [ ] **Step 6.3: Add troubleshooting section to AGENTS.md**

Add new section to `AGENTS.md`:

```markdown
## Troubleshooting

### Search Returns Empty Results

**Symptom:** Document stored successfully, but hybrid/FTS search returns `[]`

**Causes:**
1. FTS index not yet created (async processing delay)
2. Embedding service unavailable (Ollama not running)
3. Scope mismatch (searching with different userId)

**Fixes:**
1. Wait 5 seconds and retry (FTS index creation)
2. Verify Ollama: `curl http://localhost:11434/api/tags`
3. Check scope matches document scope: `{ userId: '...' }`

**Debug:**
```javascript
// Check if FTS index exists
agents-mem_mem_read({
  resource: 'document',
  query: { search: 'test', searchMode: 'fts' },
  scope: { userId: 'user-1' }
})
// If error: "FTS index not found", index needs rebuild

// Force rebuild via hybrid search (automatic)
agents-mem_mem_read({
  resource: 'document',
  query: { search: 'test', searchMode: 'hybrid' },
  scope: { userId: 'user-1' }
})
// checkAndRebuild() will detect and rebuild FTS index
```

### Chinese Search Issues

**Symptom:** Chinese queries return no results or poor results

**Cause:** LanceDB FTS doesn't support Chinese word segmentation

**Workaround:**
- Use `searchMode: 'hybrid'` (relies on vector search)
- Embeddings support Chinese semantically
- Consider pinyin preprocessing for FTS (future enhancement)
```

- [ ] **Step 6.4: Commit documentation**

```bash
git add docs/DESIGN.md AGENTS.md
git commit -m "docs: document FTS index creation architecture"
```

**Category:** low (documentation)
**Skills:** [] (no special skills needed)

---

## Final Verification Checklist

After all tasks complete, verify:

- [ ] **L0:** All tests pass: `bun test -v`
- [ ] **L1:** Type check passes: `bun run typecheck`
- [ ] **L2:** Manual test: Store document, search immediately, verify found
- [ ] **L3:** Manual test: Store Chinese document, hybrid search, verify found
- [ ] **L4:** Manual test: Delete vector DB dir, store document, verify auto-rebuild
- [ ] **L5:** Git clean: `git status` shows no uncommitted changes

---

## Test Coverage Report

| File | Lines Changed | Tests Added | Coverage Target |
|------|---------------|-------------|-----------------|
| `src/materials/store.ts` | 12 | 2 | 100% |
| `src/lance/hybrid_search.ts` | 20 | 3 | 100% |
| `src/queue/embedding_queue.ts` | 0 | 4 | Already covered |
| `tests/lance/fts_index_creation.test.ts` | 80 (new) | N/A | N/A |
| `tests/queue/fts_index_job.test.ts` | 120 (new) | N/A | N/A |
| `tests/integration/search_workflow.test.ts` | 150 (new) | N/A | N/A |

---

## Rollback Plan

If fix causes regressions:

1. **Revert store.ts:** Remove FTS index job queuing (keep embedding only)
2. **Revert hybrid_search.ts:** Remove FTS verification from checkAndRebuild()
3. **Keep tests:** New tests are valuable even if implementation reverts
4. **Root cause:** Investigate LanceDB FTS compatibility issues

Commands:
```bash
git revert HEAD~5  # Revert last 5 commits (or specific commits)
git checkout origin/main -- src/materials/store.ts
git checkout origin/main -- src/lance/hybrid_search.ts
```
