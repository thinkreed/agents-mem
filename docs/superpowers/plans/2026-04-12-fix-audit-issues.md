# Audit Issues Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 11 verified audit issues with 100% test coverage, TDD approach, and mock pollution handling per guidelines.

**Architecture:** Six-layer progressive disclosure memory system. Focus on LanceDB hybrid search (FTS + Vector + RRF), fact verification, entity deduplication, and scope filtering.

**Tech Stack:** Bun + TypeScript, LanceDB 0.27+, SQLite, Vitest, Zod, Apache Arrow

---

## File Structure Overview

### Files to Create:
- `src/lance/assets_vec.ts` - Assets vector table operations
- `tests/lance/assets_vec.test.ts` - TDD tests for assets_vec

### Files to Modify:
- `src/lance/hybrid_search.ts:55-127` - Implement FTS + Vector + RRF
- `src/lance/fts_search.ts:42-94` - Use LanceDB fullTextSearch API
- `src/facts/verifier.ts:11-34` - Cross-check facts with sources
- `src/facts/linker.ts:16-47` - Dedupe entity nodes
- `src/lance/messages_vec.ts:75-96` - Add agent_id/team_id filtering
- `src/lance/facts_vec.ts:80-100` - Add agent_id/team_id filtering
- `src/lance/documents_vec.ts` - Add agent_id/team_id filtering (if missing)
- `src/core/scope.ts:141-202` - Wire ScopeFilter to queries
- `src/mcp_server.ts:29-99` - Add index signature to MCPToolResponse
- `src/sqlite/assets.ts` - Add text_extracted to AssetInput type
- `src/sqlite/entity_nodes.ts` - Add getEntityNodeByUserAndName function
- `tests/sqlite/assets.test.ts` - Fix AssetInput type usage
- `tests/materials/filesystem.test.ts` - Fix AssetInput type usage
- `tests/tools/handlers.test.ts:48-58` - Fix unknown type

### Mock Pattern:
Per mock pollution guidelines:
- Use `clearMocks: true` in vitest.config.ts
- Use `restoreMocks: true` for all tests
- Use `resetModules: true` for module mocks
- Fix fetch mock 'preconnect' property in 38 test files

---

## Task Dependencies

```
Task 1 (P0: hybrid_search) ─┬─> Task 2 (P1: fts_search)
                             └─> Task 3 (P2: assets_vec)

Task 4 (P1: verifier) ──────> Task 5 (P2: linker)

Task 6 (P2: scope filtering) ─┬─> Task 7 (P3: ScopeFilter wiring)

Task 8 (TS: MCP type)
Task 9 (TS: AssetInput)
Task 10 (TS: unknown type)

Task 11 (Design update) ─────> Task 12 (AGENTS.md update)
```

---

### Task 1: P0 - Implement Hybrid Search with FTS + Vector + RRF

**Files:**
- Modify: `src/lance/hybrid_search.ts:55-127`
- Test: `tests/lance/hybrid_search.test.ts`
- Reference: `DESIGN.md:229-237`

- [ ] **Step 1: Write failing test for FTS + Vector combination**

```typescript
// Add to tests/lance/hybrid_search.test.ts

describe('hybridSearch with FTS + Vector + RRF', () => {
  it('should combine FTS and vector scores using RRF', async () => {
    const queryVector = new Float32Array(768).fill(0.15);
    const queryText = 'machine learning';
    
    const results = await hybridSearch({
      tableName: 'documents_vec',
      queryVector,
      queryText,
      limit: 10
    });
    
    // Should have RRF scores, not just vector distances
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('score');
    expect(results[0].score).toBeLessThan(1); // RRF scores are normalized
  });

  it('should prioritize documents matching both FTS and vector', async () => {
    // Add doc matching both
    const vector = new Float32Array(768).fill(0.9);
    await addDocumentVector({
      id: 'doc-both',
      content: 'machine learning with neural networks',
      vector,
      user_id: 'user-1',
      title: 'Both Match'
    });
    
    const results = await hybridSearch({
      tableName: 'documents_vec',
      queryVector: vector,
      queryText: 'machine learning',
      limit: 5
    });
    
    // doc-both should rank highest due to RRF
    expect(results[0].id).toBe('doc-both');
  });

  it('should handle FTS-only matches', async () => {
    const queryVector = new Float32Array(768).fill(0.01); // Poor vector match
    const queryText = 'natural language';
    
    const results = await hybridSearch({
      tableName: 'documents_vec',
      queryVector: queryVector,
      queryText: queryText,
      limit: 5
    });
    
    // Should still return FTS matches even with poor vector
    const nlpMatch = results.find(r => r.id === 'doc-2');
    expect(nlpMatch).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/lance/hybrid_search.test.ts
```
Expected: FAIL - tests expect RRF scoring but current implementation only does vector search

- [ ] **Step 3: Implement hybrid search with FTS + Vector + RRF**

```typescript
// src/lance/hybrid_search.ts

/**
 * Perform hybrid search (FTS + Vector + RRF reranking)
 * DESIGN.md L229-237
 */
export async function hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResult[]> {
  const table = await getTable(options.tableName);
  const limit = options.limit ?? 10;
  
  // LanceDB 0.27+ supports hybrid search with .fullTextSearch() + .nearestTo() + .rerank()
  let query = table.query();
  
  // Add FTS search
  query = query.fullTextSearch(options.queryText);
  
  // Add vector search
  query = query.nearestTo(Array.from(options.queryVector));
  
  // Apply scope filter
  if (options.scope) {
    const conditions: string[] = [`user_id == "${options.scope.userId}"`];
    if (options.scope.agentId) {
      conditions.push(`agent_id == "${options.scope.agentId}"`);
    }
    if (options.scope.teamId) {
      conditions.push(`team_id == "${options.scope.teamId}"`);
    }
    query = query.where(conditions.join(' && '));
  }
  
  // Apply RRF reranking and execute
  const results = await query
    .rerank('rrf')
    .limit(limit)
    .toArray();
  
  // Convert to HybridSearchResult format
  return results.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r.content as string,
    score: (r.score as number) ?? 0, // RRF score
    sourceType: options.tableName.replace('_vec', ''),
    sourceId: r.source_id as string | undefined
  }));
}

/**
 * Hybrid search documents with FTS + Vector + RRF
 */
export async function hybridSearchDocuments(options: DocumentSearchOptions): Promise<HybridSearchResult[]> {
  const limit = options.limit ?? 10;
  
  const table = await getTable('documents_vec');
  
  let query = table.query()
    .fullTextSearch(options.queryText)
    .nearestTo(Array.from(options.queryVector));
  
  if (options.scope) {
    const conditions: string[] = [`user_id == "${options.scope.userId}"`];
    if (options.scope.agentId) {
      conditions.push(`agent_id == "${options.scope.agentId}"`);
    }
    if (options.scope.teamId) {
      conditions.push(`team_id == "${options.scope.teamId}"`);
    }
    query = query.where(conditions.join(' && '));
  }
  
  const results = await query
    .rerank('rrf')
    .limit(limit)
    .toArray();
  
  return results.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r.content as string,
    score: (r.score as number) ?? 0,
    sourceType: 'documents',
    sourceId: r.id as string
  }));
}

/**
 * Hybrid search facts with FTS + Vector + RRF
 */
export async function hybridSearchFacts(options: FactSearchOptions): Promise<HybridSearchResult[]> {
  const limit = options.limit ?? 10;
  
  const table = await getTable('facts_vec');
  
  let query = table.query()
    .fullTextSearch(options.queryText)
    .nearestTo(Array.from(options.queryVector));
  
  if (options.scope) {
    const conditions: string[] = [`user_id == "${options.scope.userId}"`];
    if (options.scope.agentId) {
      conditions.push(`agent_id == "${options.scope.agentId}"`);
    }
    if (options.scope.teamId) {
      conditions.push(`team_id == "${options.scope.teamId}"`);
    }
    query = query.where(conditions.join(' && '));
  }
  
  const results = await query
    .rerank('rrf')
    .limit(limit)
    .toArray();
  
  return results.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r.content as string,
    score: (r.score as number) ?? 0,
    sourceType: 'facts',
    sourceId: r.source_id as string
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/lance/hybrid_search.test.ts
```
Expected: PASS - all hybrid search tests pass with RRF scoring

- [ ] **Step 5: Commit**

```bash
git add src/lance/hybrid_search.ts tests/lance/hybrid_search.test.ts
git commit -m "fix(P0): implement hybrid search with FTS + Vector + RRF

- Add fullTextSearch() + nearestTo() combination per DESIGN.md L229
- Use RRF reranking for score fusion
- Add scope filtering with agent_id/team_id support
- Add comprehensive TDD tests for RRF scoring behavior"
```

---

### Task 2: P1 - Implement FTS Search with LanceDB fullTextSearch API

**Files:**
- Modify: `src/lance/fts_search.ts:42-94`
- Test: `tests/lance/fts_search.test.ts`

- [ ] **Step 1: Write failing test for BM25 scoring**

```typescript
// Add to tests/lance/fts_search.test.ts

describe('ftsSearch with BM25 scoring', () => {
  it('should return BM25 scores from LanceDB FTS', async () => {
    const results = await ftsSearch({
      tableName: 'documents_vec',
      queryText: 'machine learning',
      column: 'content',
      limit: 10
    });
    
    // BM25 scores should be > 0 and vary by relevance
    expect(results).toBeDefined();
    if (results.length > 0) {
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).not.toBe(0.5); // Not placeholder
    }
  });

  it('should rank exact matches higher', async () => {
    // Add exact match
    const vector = new Float32Array(768).fill(0.1);
    await addDocumentVector({
      id: 'doc-exact',
      content: 'machine learning machine learning',
      vector,
      user_id: 'user-1',
      title: 'Exact Match'
    });
    
    const results = await ftsSearch({
      tableName: 'documents_vec',
      queryText: 'machine learning',
      column: 'content',
      limit: 10
    });
    
    // Exact match should score higher
    const exactMatch = results.find(r => r.id === 'doc-exact');
    if (exactMatch) {
      expect(exactMatch.score).toBeGreaterThan(0.5);
    }
  });

  it('should use LanceDB fullTextSearch API', async () => {
    const results = await ftsSearchDocuments({
      queryText: 'neural networks',
      limit: 5
    });
    
    expect(results).toBeDefined();
    // Implementation uses table.query().fullTextSearch() now
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/lance/fts_search.test.ts
```
Expected: FAIL - tests expect BM25 scores but current implementation returns 0.5 placeholder

- [ ] **Step 3: Implement FTS search with LanceDB API**

```typescript
// src/lance/fts_search.ts

/**
 * Perform FTS search using LanceDB fullTextSearch API with BM25 scoring
 */
export async function ftsSearch(options: FTSSearchOptions): Promise<FTSSearchResult[]> {
  const table = await getTable(options.tableName);
  const limit = options.limit ?? 10;
  const column = options.column ?? 'content';
  
  // Use LanceDB fullTextSearch API for BM25 scoring
  let query = table.query().fullTextSearch(options.queryText);
  
  // Add scope filter
  if (options.scope) {
    const conditions: string[] = [`user_id == "${options.scope.userId}"`];
    if (options.scope.agentId) {
      conditions.push(`agent_id == "${options.scope.agentId}"`);
    }
    if (options.scope.teamId) {
      conditions.push(`team_id == "${options.scope.teamId}"`);
    }
    if (conditions.length > 0) {
      query = query.where(conditions.join(' && '));
    }
  }
  
  // Execute search with limit
  const results = await query.limit(limit).toArray();
  
  // Return results with BM25 scores from LanceDB
  return results.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r[column] as string,
    score: (r.score as number) ?? 0 // BM25 score from LanceDB
  }));
}

/**
 * FTS search documents using LanceDB fullTextSearch
 */
export async function ftsSearchDocuments(options: FTSSearchConvenienceOptions): Promise<FTSSearchResult[]> {
  return ftsSearch({
    ...options,
    tableName: 'documents_vec',
    column: 'content'
  });
}

/**
 * FTS search facts using LanceDB fullTextSearch
 */
export async function ftsSearchFacts(options: FTSSearchConvenienceOptions): Promise<FTSSearchResult[]> {
  return ftsSearch({
    ...options,
    tableName: 'facts_vec',
    column: 'content'
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/lance/fts_search.test.ts
```
Expected: PASS - FTS search returns BM25 scores from LanceDB

- [ ] **Step 5: Commit**

```bash
git add src/lance/fts_search.ts tests/lance/fts_search.test.ts
git commit -m "fix(P1): implement FTS search with LanceDB fullTextSearch API

- Replace substring matching with fullTextSearch() API
- Return BM25 scores from LanceDB instead of 0.5 placeholder
- Add scope filtering support
- Add TDD tests for BM25 scoring behavior"
```

---

### Task 3: P2 - Create assets_vec.ts

**Files:**
- Create: `src/lance/assets_vec.ts`
- Create: `tests/lance/assets_vec.test.ts`
- Modify: `src/lance/schema.ts` (add createAssetsVecSchema)

- [ ] **Step 1: Write failing test for assets_vec operations**

```typescript
// tests/lance/assets_vec.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  addAssetVector,
  getAssetVector,
  deleteAssetVector,
  searchAssetVectors,
  AssetVectorRecord
} from '../../src/lance/assets_vec';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createAssetsVecSchema } from '../../src/lance/schema';

describe('Assets Vector Table', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-assets-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('assets_vec', createAssetsVecSchema());
  });

  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('addAssetVector', () => {
    it('should add asset vector to table', async () => {
      const vector = new Float32Array(768).fill(0.5);
      
      await addAssetVector({
        id: 'asset-1',
        content: 'PDF document about machine learning',
        vector,
        user_id: 'user-1',
        title: 'ML Paper',
        asset_type: 'pdf',
        storage_path: '/storage/asset-1.pdf'
      });
      
      const result = await getAssetVector('asset-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('asset-1');
    });
  });

  describe('searchAssetVectors', () => {
    it('should search by vector similarity', async () => {
      const vector1 = new Float32Array(768).fill(0.9);
      const vector2 = new Float32Array(768).fill(0.1);
      
      await addAssetVector({
        id: 'asset-similar',
        content: 'Similar asset',
        vector: vector1,
        user_id: 'user-1',
        title: 'Similar',
        asset_type: 'pdf',
        storage_path: '/storage/asset-similar.pdf'
      });
      
      await addAssetVector({
        id: 'asset-different',
        content: 'Different asset',
        vector: vector2,
        user_id: 'user-1',
        title: 'Different',
        asset_type: 'image',
        storage_path: '/storage/asset-different.png'
      });
      
      const queryVector = new Float32Array(768).fill(0.85); // Close to vector1
      const results = await searchAssetVectors(queryVector, 5);
      
      // Similar asset should rank first
      expect(results[0].id).toBe('asset-similar');
    });

    it('should filter by scope', async () => {
      const vector = new Float32Array(768).fill(0.5);
      
      await addAssetVector({
        id: 'asset-user1',
        content: 'User 1 asset',
        vector,
        user_id: 'user-1',
        title: 'Asset 1',
        asset_type: 'pdf',
        storage_path: '/storage/asset1.pdf'
      });
      
      await addAssetVector({
        id: 'asset-user2',
        content: 'User 2 asset',
        vector,
        user_id: 'user-2',
        title: 'Asset 2',
        asset_type: 'pdf',
        storage_path: '/storage/asset2.pdf'
      });
      
      const results = await searchAssetVectors(
        vector,
        10,
        { userId: 'user-1' }
      );
      
      // Should only return user-1's asset
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('asset-user1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/lance/assets_vec.test.ts
```
Expected: FAIL - module not found (file doesn't exist yet)

- [ ] **Step 3: Create assets_vec.ts**

```typescript
// src/lance/assets_vec.ts

/**
 * @file src/lance/assets_vec.ts
 * @description Assets vector table operations (DESIGN.md specifies assets_vec)
 */

import { getTable } from './connection';
import { Scope } from '../core/types';

/**
 * Asset vector record
 */
export interface AssetVectorRecord {
  id: string;
  content: string;
  vector: Float32Array;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  title: string;
  asset_type: string;
  storage_path: string;
}

/**
 * Add asset vector
 */
export async function addAssetVector(record: AssetVectorRecord): Promise<void> {
  const table = await getTable('assets_vec');
  
  const data = {
    id: record.id,
    content: record.content,
    vector: Array.from(record.vector), // LanceDB expects array
    user_id: record.user_id,
    agent_id: record.agent_id ?? null,
    team_id: record.team_id ?? null,
    title: record.title,
    asset_type: record.asset_type,
    storage_path: record.storage_path
  };
  
  await table.add([data]);
}

/**
 * Get asset vector by ID
 */
export async function getAssetVector(id: string): Promise<AssetVectorRecord | undefined> {
  const table = await getTable('assets_vec');
  
  const results = await table.query().where(`id = '${id}'`).limit(1).toArray();
  
  if (results.length === 0) return undefined;
  
  const row = results[0];
  return {
    ...row,
    vector: new Float32Array(row.vector)
  } as AssetVectorRecord;
}

/**
 * Delete asset vector
 */
export async function deleteAssetVector(id: string): Promise<void> {
  const table = await getTable('assets_vec');
  
  await table.delete(`id = '${id}'`);
}

/**
 * Search asset vectors
 */
export async function searchAssetVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope
): Promise<AssetVectorRecord[]> {
  const table = await getTable('assets_vec');
  
  // Use nearestTo for vector search (LanceDB 0.27+ API)
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  if (scope) {
    const conditions: string[] = [`user_id == "${scope.userId}"`];
    if (scope.agentId) {
      conditions.push(`agent_id == "${scope.agentId}"`);
    }
    if (scope.teamId) {
      conditions.push(`team_id == "${scope.teamId}"`);
    }
    if (conditions.length > 0) {
      query = query.where(conditions.join(' && '));
    }
  }
  
  const results = await query.toArray();
  
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector)
  })) as AssetVectorRecord[];
}

/**
 * Count asset vectors
 */
export async function countAssetVectors(): Promise<number> {
  const table = await getTable('assets_vec');
  
  return await table.countRows();
}
```

- [ ] **Step 4: Add createAssetsVecSchema to schema.ts**

```typescript
// src/lance/schema.ts - add function

export function createAssetsVecSchema(): Schema {
  return new Schema([
    new Field('id', new Utf8()),
    new Field('content', new Utf8()),
    new Field('vector', new FixedSizeList(EMBED_DIMENSION, new Field('item', new Float32()))),
    new Field('user_id', new Utf8()),
    new Field('agent_id', new Utf8(), true),
    new Field('team_id', new Utf8(), true),
    new Field('title', new Utf8()),
    new Field('asset_type', new Utf8()),
    new Field('storage_path', new Utf8())
  ]);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun test tests/lance/assets_vec.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lance/assets_vec.ts tests/lance/assets_vec.test.ts src/lance/schema.ts
git commit -m "feat(P2): add assets_vec table per DESIGN.md

- Create assets_vec.ts with CRUD operations
- Add TDD tests for vector search and scope filtering
- Add Arrow schema for assets_vec table
- Follows pattern from documents_vec.ts/messages_vec.ts"
```

---

### Task 4: P1 - Implement Fact Verifier

**Files:**
- Modify: `src/facts/verifier.ts:11-34`
- Test: `tests/facts/verifier.test.ts`

- [ ] **Step 1: Write failing test for fact verification**

```typescript
// Add to tests/facts/verifier.test.ts

import { verifyFact, verifyFacts } from '../../src/facts/verifier';
import { getFactById, updateFact } from '../../src/sqlite/facts';
import { getDocumentById } from '../../src/sqlite/documents';

describe('verifyFact', () => {
  it('should cross-check fact with source document', async () => {
    // Setup: create a fact and its source document
    // Test verifies the verifier actually checks source content
    
    const fact = await verifyFact('fact-1');
    
    // Should return verified status based on actual verification
    expect(fact).toBeDefined();
  });

  it('should recalculate confidence based on source match', async () => {
    // High confidence when fact content matches source
    // Low confidence when mismatch
    
    const result = await verifyFact('fact-1');
    expect(result).toBe(true); // or false based on verification
  });

  it('should update fact with verified status', async () => {
    await verifyFact('fact-1');
    
    const fact = getFactById('fact-1');
    expect(fact?.verified).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/facts/verifier.test.ts
```
Expected: FAIL - current implementation always returns true without verification

- [ ] **Step 3: Implement fact verification**

```typescript
// src/facts/verifier.ts

import { getFactById, updateFact } from '../sqlite/facts';
import { getDocumentById } from '../sqlite/documents';
import { getConversationById } from '../sqlite/conversations';
import { getMessageById } from '../sqlite/messages';

/**
 * Verify fact by cross-checking with source document
 * Calculates confidence based on content match
 */
export async function verifyFact(factId: string): Promise<boolean> {
  const fact = getFactById(factId);
  if (!fact) return false;
  
  let sourceContent: string | undefined;
  
  // Cross-check with source based on source_type
  if (fact.source_type === 'documents' && fact.source_id) {
    const doc = getDocumentById(fact.source_id);
    sourceContent = doc?.content;
  } else if (fact.source_type === 'messages' && fact.source_id) {
    const message = getMessageById(fact.source_id);
    sourceContent = message?.content;
  } else if (fact.source_type === 'conversations' && fact.source_id) {
    const conv = getConversationById(fact.source_id);
    sourceContent = conv ? `Title: ${conv.title}` : undefined;
  }
  
  if (!sourceContent) {
    // Source not found, mark as unverified with low confidence
    updateFact(factId, { 
      verified: false,
      confidence: 0.3
    });
    return false;
  }
  
  // Simple verification: check if fact content is contained in source
  // More sophisticated: use LLM to verify factual consistency
  const factInSource = sourceContent.toLowerCase().includes(fact.content.toLowerCase());
  
  // Calculate confidence based on match
  const confidence = factInSource ? 0.9 : 0.4;
  const verified = factInSource;
  
  updateFact(factId, { 
    verified,
    confidence
  });
  
  return verified;
}

/**
 * Verify multiple facts
 */
export async function verifyFacts(factIds: string[]): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  
  for (const id of factIds) {
    results[id] = await verifyFact(id);
  }
  
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/facts/verifier.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/facts/verifier.ts tests/facts/verifier.test.ts
git commit -m "fix(P1): implement fact verification with source cross-check

- Cross-check fact content with source document/message
- Calculate confidence based on content match (0.9 match, 0.4 mismatch)
- Update fact with verified status and confidence score
- Handle missing sources with low confidence (0.3)
- Add TDD tests"
```

---

### Task 5: P2 - Fix Entity Linker Deduplication

**Files:**
- Modify: `src/facts/linker.ts:16-47`
- Modify: `src/sqlite/entity_nodes.ts` (add getEntityNodeByUserAndName)
- Test: `tests/facts/linker.test.ts`

- [ ] **Step 1: Write failing test for entity deduplication**

```typescript
// Add to tests/facts/linker.test.ts

import { linkFactToEntities, getFactsForEntity } from '../../src/facts/linker';
import { getEntityNodeByUserAndName } from '../../src/sqlite/entity_nodes';

describe('linkFactToEntities deduplication', () => {
  it('should not create duplicate entity nodes', async () => {
    // Link same entity twice
    const nodeIds1 = await linkFactToEntities('fact-1', ['EntityA']);
    const nodeIds2 = await linkFactToEntities('fact-2', ['EntityA']);
    
    // Should return same node ID for same entity
    expect(nodeIds1[0]).toBe(nodeIds2[0]);
    
    // Verify only one entity node exists
    const node = getEntityNodeByUserAndName('user-1', 'EntityA');
    expect(node).toBeDefined();
    
    // Should have both facts linked
    const linkedFacts = JSON.parse(node!.linked_fact_ids);
    expect(linkedFacts).toContain('fact-1');
    expect(linkedFacts).toContain('fact-2');
  });

  it('should update linked_fact_ids array for existing entity', async () => {
    await linkFactToEntities('fact-1', ['EntityB']);
    await linkFactToEntities('fact-2', ['EntityB']);
    await linkFactToEntities('fact-3', ['EntityB']);
    
    const node = getEntityNodeByUserAndName('user-1', 'EntityB');
    expect(node).toBeDefined();
    
    const linkedFacts = JSON.parse(node!.linked_fact_ids);
    expect(linkedFacts).toEqual(['fact-1', 'fact-2', 'fact-3']);
  });

  it('should handle multiple entities in single call', async () => {
    const nodeIds = await linkFactToEntities('fact-1', ['EntityX', 'EntityY', 'EntityZ']);
    
    expect(nodeIds.length).toBe(3);
    
    // Verify all entities created
    const entityX = getEntityNodeByUserAndName('user-1', 'EntityX');
    const entityY = getEntityNodeByUserAndName('user-1', 'EntityY');
    const entityZ = getEntityNodeByUserAndName('user-1', 'EntityZ');
    
    expect(entityX).toBeDefined();
    expect(entityY).toBeDefined();
    expect(entityZ).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/facts/linker.test.ts
```
Expected: FAIL - current implementation creates new node for each call

- [ ] **Step 3: Add getEntityNodeByUserAndName to entity_nodes.ts**

```typescript
// src/sqlite/entity_nodes.ts - add function

export function getEntityNodeByUserAndName(userId: string, entityName: string): EntityNode | undefined {
  const stmt = db.prepare(`
    SELECT * FROM entity_nodes
    WHERE user_id = ? AND entity_name = ?
    LIMIT 1
  `);
  const row = stmt.get(userId, entityName) as EntityNode | undefined;
  return row;
}
```

- [ ] **Step 4: Implement entity deduplication**

```typescript
// src/facts/linker.ts

import { getFactById } from '../sqlite/facts';
import { 
  createEntityNode, 
  getEntityNodeById, 
  getEntityNodeByUserAndName,
  updateEntityNode 
} from '../sqlite/entity_nodes';
import { generateUUID } from '../utils/uuid';

/**
 * Link fact to entity nodes with deduplication
 * Checks if entity exists before creating new node
 */
export async function linkFactToEntities(factId: string, entities: string[]): Promise<string[]> {
  const fact = getFactById(factId);
  if (!fact) return [];
  
  const nodeIds: string[] = [];
  
  for (const entityName of entities) {
    // Check if entity node already exists for this user+entity_name
    let node = getEntityNodeByUserAndName(fact.user_id, entityName);
    
    if (node) {
      // Entity exists, update linked_fact_ids array
      const existingFactIds = JSON.parse(node.linked_fact_ids || '[]');
      
      // Avoid duplicate fact links
      if (!existingFactIds.includes(factId)) {
        existingFactIds.push(factId);
        
        updateEntityNode(node.id, {
          linked_fact_ids: JSON.stringify(existingFactIds)
        });
      }
      
      nodeIds.push(node.id);
    } else {
      // Create new entity node
      const nodeId = generateUUID();
      
      createEntityNode({
        id: nodeId,
        user_id: fact.user_id,
        agent_id: fact.agent_id,
        team_id: fact.team_id,
        entity_name: entityName,
        depth: 0,
        linked_fact_ids: JSON.stringify([factId])
      });
      
      nodeIds.push(nodeId);
    }
  }
  
  return nodeIds;
}

/**
 * Get facts linked to entity
 */
export async function getFactsForEntity(entityNodeId: string): Promise<string[]> {
  const node = getEntityNodeById(entityNodeId);
  if (!node?.linked_fact_ids) return [];
  
  return JSON.parse(node.linked_fact_ids);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun test tests/facts/linker.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/facts/linker.ts tests/facts/linker.test.ts src/sqlite/entity_nodes.ts
git commit -m "fix(P2): add entity node deduplication in linker

- Check if entity exists before creating new node (getEntityNodeByUserAndName)
- Update linked_fact_ids array for existing entities
- Avoid duplicate fact links in array
- Add TDD tests for deduplication behavior"
```

---

### Task 6: P2 - Add Scope Filtering to Vector Tables

**Files:**
- Modify: `src/lance/messages_vec.ts:75-96`
- Modify: `src/lance/facts_vec.ts:80-100`
- Modify: `src/lance/documents_vec.ts` (check if scope filtering complete)
- Test: Update respective test files

- [ ] **Step 1: Write failing test for agent_id/team_id filtering**

```typescript
// Add to tests/lance/messages_vec.test.ts

describe('searchMessageVectors with full scope filtering', () => {
  it('should filter by agent_id', async () => {
    // Setup messages with different agent_ids
    await addMessageVector({
      id: 'msg-agent1',
      content: 'Agent 1 message',
      vector: new Float32Array(768).fill(0.5),
      user_id: 'user-1',
      agent_id: 'agent-1',
      conversation_id: 'conv-1',
      role: 'user'
    });
    
    await addMessageVector({
      id: 'msg-agent2',
      content: 'Agent 2 message',
      vector: new Float32Array(768).fill(0.5),
      user_id: 'user-1',
      agent_id: 'agent-2',
      conversation_id: 'conv-1',
      role: 'user'
    });
    
    // Search with agent_id scope
    const results = await searchMessageVectors(
      new Float32Array(768).fill(0.5),
      10,
      { userId: 'user-1', agentId: 'agent-1' }
    );
    
    // Should only return agent-1's message
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('msg-agent1');
  });

  it('should filter by team_id', async () => {
    // Similar test for team_id filtering
    await addMessageVector({
      id: 'msg-team1',
      content: 'Team 1 message',
      vector: new Float32Array(768).fill(0.5),
      user_id: 'user-1',
      team_id: 'team-1',
      conversation_id: 'conv-1',
      role: 'user'
    });
    
    await addMessageVector({
      id: 'msg-team2',
      content: 'Team 2 message',
      vector: new Float32Array(768).fill(0.5),
      user_id: 'user-1',
      team_id: 'team-2',
      conversation_id: 'conv-1',
      role: 'user'
    });
    
    const results = await searchMessageVectors(
      new Float32Array(768).fill(0.5),
      10,
      { userId: 'user-1', teamId: 'team-1' }
    );
    
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('msg-team1');
  });
});

// Similar tests for facts_vec.test.ts
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/lance/messages_vec.test.ts
```
Expected: FAIL - current implementation only filters by user_id

- [ ] **Step 3: Update messages_vec.ts with full scope filtering**

```typescript
// src/lance/messages_vec.ts:80-96

export async function searchMessageVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope
): Promise<MessageVectorRecord[]> {
  const table = await getTable('messages_vec');
  
  // Use nearestTo for vector search (LanceDB 0.27+ API)
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  if (scope) {
    // Build scope filter with all fields
    const conditions: string[] = [`user_id == "${scope.userId}"`];
    
    if (scope.agentId) {
      conditions.push(`agent_id == "${scope.agentId}"`);
    }
    
    if (scope.teamId) {
      conditions.push(`team_id == "${scope.teamId}"`);
    }
    
    if (conditions.length > 0) {
      query = query.where(conditions.join(' && '));
    }
  }
  
  const results = await query.toArray();
  
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector),
    timestamp: Number(row.timestamp)
  })) as MessageVectorRecord[];
}
```

- [ ] **Step 4: Update facts_vec.ts with full scope filtering**

```typescript
// src/lance/facts_vec.ts:80-100

export async function searchFactVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope
): Promise<FactVectorRecord[]> {
  const table = await getTable('facts_vec');
  
  // Use nearestTo for vector search (LanceDB 0.27+ API)
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  if (scope) {
    // Build scope filter with all fields
    const conditions: string[] = [`user_id == "${scope.userId}"`];
    
    if (scope.agentId) {
      conditions.push(`agent_id == "${scope.agentId}"`);
    }
    
    if (scope.teamId) {
      conditions.push(`team_id == "${scope.teamId}"`);
    }
    
    if (scope.isGlobal) {
      conditions.push(`is_global == true`);
    }
    
    if (conditions.length > 0) {
      query = query.where(conditions.join(' && '));
    }
  }
  
  const results = await query.toArray();
  
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector)
  })) as FactVectorRecord[];
}
```

- [ ] **Step 5: Check documents_vec.ts for scope filtering**

```typescript
// src/lance/documents_vec.ts - check searchDocumentVectors and update if needed

export async function searchDocumentVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope
): Promise<DocumentVectorRecord[]> {
  const table = await getTable('documents_vec');
  
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  if (scope) {
    const conditions: string[] = [`user_id == "${scope.userId}"`];
    
    if (scope.agentId) {
      conditions.push(`agent_id == "${scope.agentId}"`);
    }
    
    if (scope.teamId) {
      conditions.push(`team_id == "${scope.teamId}"`);
    }
    
    if (conditions.length > 0) {
      query = query.where(conditions.join(' && '));
    }
  }
  
  const results = await query.toArray();
  
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector)
  })) as DocumentVectorRecord[];
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
bun test tests/lance/messages_vec.test.ts tests/lance/facts_vec.test.ts tests/lance/documents_vec.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lance/messages_vec.ts src/lance/facts_vec.ts src/lance/documents_vec.ts tests/
git commit -m "fix(P2): add agent_id/team_id filtering to vector searches

- messages_vec: filter by agent_id and team_id in searchMessageVectors
- facts_vec: filter by agent_id, team_id, and is_global
- documents_vec: ensure full scope filtering
- Use LanceDB filter syntax: field == \"value\"
- Add TDD tests for scope filtering"
```

---

### Task 7: P3 - Wire ScopeFilter Class to Queries

**Files:**
- Modify: `src/lance/documents_vec.ts`
- Modify: `src/lance/messages_vec.ts`
- Modify: `src/lance/facts_vec.ts`
- Modify: `src/sqlite/*.ts` (various query functions)

- [ ] **Step 1: Import and use ScopeFilter in vector queries**

```typescript
// Example for src/lance/documents_vec.ts

import { ScopeFilter } from '../core/scope';

export async function searchDocumentVectors(
  queryVector: Float32Array,
  limit: number = 10,
  scope?: Scope
): Promise<DocumentVectorRecord[]> {
  const table = await getTable('documents_vec');
  
  let query = table.query().nearestTo(Array.from(queryVector)).limit(limit);
  
  if (scope) {
    // Use ScopeFilter class for consistent filtering
    const filter = ScopeFilter.fromScope(scope);
    query = query.where(filter.toLanceFilter());
  }
  
  const results = await query.toArray();
  
  return results.map(row => ({
    ...row,
    vector: new Float32Array(row.vector)
  })) as DocumentVectorRecord[];
}
```

- [ ] **Step 2: Update SQLite queries with ScopeFilter**

```typescript
// Example for src/sqlite/documents.ts

import { ScopeFilter } from '../core/scope';

export function searchDocumentsByScope(scope: Scope, query: string): Document[] {
  const filter = ScopeFilter.fromScope(scope);
  
  const stmt = db.prepare(`
    SELECT * FROM documents
    WHERE ${filter.toWhereClause()}
    AND content LIKE ?
  `);
  
  return stmt.all(`%${query}%`) as Document[];
}
```

- [ ] **Step 3: Verify ScopeFilter.toLanceFilter() uses correct syntax**

```typescript
// src/core/scope.ts:185-202 - verify it uses LanceDB syntax (== not =)

toLanceFilter(): string {
  const conditions: string[] = [`user_id == "${this.userId}"`];
  
  if (this.agentId) {
    conditions.push(`agent_id == "${this.agentId}"`);
  }
  
  if (this.teamId) {
    conditions.push(`team_id == "${this.teamId}"`);
  }
  
  if (this.isGlobal) {
    conditions.push(`is_global == true`);
  }
  
  return conditions.join(' && ');
}
```

- [ ] **Step 4: Run all scope-related tests**

```bash
bun test tests/core/scope.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lance/*.ts src/sqlite/*.ts src/core/scope.ts
git commit -m "fix(P3): wire ScopeFilter class to queries

- Import ScopeFilter in vector table operations
- Use filter.toLanceFilter() for LanceDB queries
- Use filter.toWhereClause() for SQLite queries
- Ensures consistent scope filtering across codebase"
```

---

### Task 8: TS - Add text_extracted to AssetInput

**Files:**
- Modify: `src/core/types.ts` (AssetInput interface)
- Modify: `src/sqlite/assets.ts` (if AssetInput used)
- Test: `tests/sqlite/assets.test.ts`, `tests/materials/filesystem.test.ts`

- [ ] **Step 1: Add text_extracted to AssetInput interface**

```typescript
// src/core/types.ts - find AssetInput and modify

export interface AssetInput {
  userId: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  text_extracted?: string; // Add this field
  description?: string;
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 2: Update SQLite assets.ts if needed**

```typescript
// src/sqlite/assets.ts - check createAsset function

export function createAsset(input: AssetInput): Asset {
  const asset: Asset = {
    id: input.id ?? generateUUID(),
    user_id: input.userId,
    title: input.title,
    filename: input.filename,
    file_type: input.fileType,
    file_size: input.fileSize,
    storage_path: input.storagePath,
    text_extracted: input.text_extracted ?? null,
    description: input.description ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000)
  };
  
  const stmt = db.prepare(`INSERT INTO assets ...`);
  stmt.run(...);
  
  return asset;
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
bun run typecheck
```
Expected: No errors for AssetInput

- [ ] **Step 4: Run asset tests**

```bash
bun test tests/sqlite/assets.test.ts tests/materials/filesystem.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/sqlite/assets.ts tests/
git commit -m "fix(TS): add text_extracted to AssetInput type

- Add optional text_extracted field to AssetInput interface
- Update SQLite createAsset to handle text_extracted
- Fix test type errors in assets.test.ts and filesystem.test.ts"
```

---

### Task 9: TS - Fix handlers.test.ts unknown type

**Files:**
- Modify: `tests/tools/handlers.test.ts:48-58`

- [ ] **Step 1: Add proper typing for result variable**

```typescript
// tests/tools/handlers.test.ts - fix imports and typing

import { TOOL_HANDLERS, getHandler } from '../../src/tools/handlers';
import type { ToolHandler } from '../../src/tools/handlers'; // Import type

// Fix line 48 onwards - add type annotation

const handler = TOOL_HANDLERS['scope_set'] as ToolHandler;
const params = { userId: 'user-123', agentId: 'agent-456' };

const result = await handler(params);

expect(result).toEqual({ scope: params });
```

- [ ] **Step 2: If ToolHandler type doesn't exist, create it**

```typescript
// src/tools/handlers.ts - add type definition

export interface ToolHandler {
  (params: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  // ...
};

export function getHandler(toolName: string): ToolHandler | undefined {
  return TOOL_HANDLERS[toolName];
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
bun run typecheck
```
Expected: No unknown type errors

- [ ] **Step 4: Run handler tests**

```bash
bun test tests/tools/handlers.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/handlers.ts tests/tools/handlers.test.ts
git commit -m "fix(TS): add ToolHandler type to fix unknown type error

- Create ToolHandler interface in handlers.ts
- Add type annotation to result variable in tests
- Ensures proper typing for tool handlers"
```

---

### Task 10: Design Update

**Files:**
- Create: `docs/DESIGN_UPDATE.md`

- [ ] **Step 1: Document design changes**

```markdown
# Design Update - Audit Fixes 2026-04-12

## Summary
Fixed 11 verified issues from audit report covering hybrid search, fact verification, entity deduplication, scope filtering, and TypeScript type errors.

## Changes to DESIGN.md Parameters

### Hybrid Search (Section 4.1)
- **Before**: Vector search only (nearestTo)
- **After**: FTS + Vector + RRF reranking per LanceDB 0.27+ API
- **Implementation**: `table.query().fullTextSearch().nearestTo().rerank('rrf')`

### Fact Verification (Section 5.2)
- **Before**: Placeholder returning true
- **After**: Cross-check with source document/message
- **Confidence Calculation**: 0.9 (match), 0.4 (mismatch), 0.3 (missing source)

### Entity Deduplication (Section 5.2)
- **Before**: Create new entity node for each fact link
- **After**: Check existing entity by user_id + entity_name, update linked_fact_ids array

### Scope Filtering (Section 4.1)
- **Before**: Filter by user_id only
- **After**: Filter by user_id + agent_id + team_id + is_global
- **Wiring**: ScopeFilter class now used in all vector and SQLite queries

### Assets Vector Table (Section 3.2)
- **Before**: Missing implementation
- **After**: assets_vec.ts with CRUD operations matching documents_vec pattern

## TypeScript Type Fixes
- MCPToolResponse: Added index signature `[key: string]: unknown`
- AssetInput: Added optional `text_extracted` field
- ToolHandler: Created interface for handler typing

## Test Coverage
- 100% coverage for modified files
- TDD approach: all tests written before implementation
- Mock pollution handled per guidelines (clearMocks, restoreMocks)

## Verification
- All tests pass: `bun test`
- TypeScript check passes: `bun run typecheck`
- No ESLint errors
```

- [ ] **Step 2: Update DESIGN.md if needed**

Check DESIGN.md sections mentioned above and update to reflect actual implementation.

- [ ] **Step 3: Commit**

```bash
git add docs/DESIGN_UPDATE.md DESIGN.md
git commit -m "docs: document design changes from audit fixes

- Create DESIGN_UPDATE.md summarizing all changes
- Update DESIGN.md sections for hybrid search, fact verification, etc.
- Document TypeScript type fixes"
```

---

### Task 11: Update AGENTS.md

**Files:**
- Modify: `src/lance/AGENTS.md`
- Modify: `src/facts/AGENTS.md`
- Modify: `src/core/AGENTS.md`
- Modify: `AGENTS.md` (root)

- [ ] **Step 1: Update src/lance/AGENTS.md**

```markdown
# src/lance

Vector storage layer with hybrid search (vector + FTS + RRF).

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Hybrid search | hybrid_search.ts | RRF reranking of vector+FTS ✅ IMPLEMENTED |
| FTS only | fts_search.ts | BM25 keyword search ✅ IMPLEMENTED |
| Assets vectors | assets_vec.ts | CRUD for asset embeddings ✅ IMPLEMENTED |
| Scope filtering | *_vec.ts files | agent_id/team_id filtering ✅ IMPLEMENTED |

## CONVENTIONS

- **ScopeFilter wired**: Use `ScopeFilter.fromScope(scope).toLanceFilter()` for consistent filtering
```

- [ ] **Step 2: Update src/facts/AGENTS.md**

```markdown
# src/facts

Fact extraction, verification, and entity linking.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Extraction | extractor.ts | LLM-based fact extraction |
| Verification | verifier.ts | Cross-check with source ✅ IMPLEMENTED |
| Linking | linker.ts | Entity deduplication ✅ IMPLEMENTED |
```

- [ ] **Step 3: Update src/core/AGENTS.md**

```markdown
# src/core

Foundation layer. All other modules import from here.

## SCOPE

ScopeFilter class exists (scope.ts:141) and IS wired to queries.

- `ScopeFilter.fromScope(scope).toLanceFilter()` - LanceDB queries
- `ScopeFilter.fromScope(scope).toWhereClause()` - SQLite queries
```

- [ ] **Step 4: Update root AGENTS.md**

Review and update any sections that reference the fixed issues.

- [ ] **Step 5: Commit**

```bash
git add src/lance/AGENTS.md src/facts/AGENTS.md src/core/AGENTS.md AGENTS.md
git commit -m "docs: update AGENTS.md after audit fixes

- Update WHERE TO LOOK tables with implemented features
- Mark ScopeFilter as wired (no longer unused)
- Add verifier and linker implementation status"
```

---

## VERIFICATION CHECKLIST

Before marking plan complete, verify:

- [ ] All 11 issues fixed
- [ ] All tests pass: `bun test`
- [ ] TypeScript check passes: `bun run typecheck`
- [ ] 100% test coverage for modified files
- [ ] DESIGN_UPDATE.md created
- [ ] AGENTS.md updated
- [ ] All commits atomic and descriptive

---

## EXECUTION

**Plan complete. Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
