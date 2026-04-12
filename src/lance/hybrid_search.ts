/**
 * @file src/lance/hybrid_search.ts
 * @description Hybrid search combining vector and FTS with RRF reranking
 * 
 * Implementation follows DESIGN.md L229-237:
 * table.search(query, "hybrid")
 *   .vector(queryEmbedding)
 *   .ftsColumns("content")
 *   .where(scopeFilter)
 *   .rerank(new RRFReranker())
 *   .limit(10)
 */

import * as lancedb from '@lancedb/lancedb';
import { getTable, tableExists, initTables, createTableByName, isConnectionOpen as isLanceOpen } from './connection';
import { Scope } from '../core/types';
import { ScopeFilter } from '../core/scope';
import { searchDocumentVectors, DocumentVectorRecord, addDocumentVector, countDocumentVectors, deleteDocumentVector, getDocumentVector, clearDocumentVectors, getAllDocumentVectorIds } from './documents_vec';
import { searchFactVectors, FactVectorRecord } from './facts_vec';
import { getDocumentsByScope, DocumentRecord } from '../sqlite/documents';
import { getEmbedding } from '../embedder/ollama';
import { createDocumentsVecSchema } from './schema';
import { isConnectionOpen as isSQLiteOpen, closeConnection as closeSQLiteConnection } from '../sqlite/connection';

/**
 * Hybrid search result
 */
export interface HybridSearchResult {
  id: string;
  content: string;
  score: number;
  sourceType: string;
  sourceId?: string;
}

/**
 * Hybrid search options
 */
export interface HybridSearchOptions {
  tableName: string;
  queryVector: Float32Array;
  queryText: string;
  limit?: number;
  scope?: Scope;
}

/**
 * Hybrid search documents options
 */
export interface DocumentSearchOptions {
  queryVector: Float32Array;
  queryText: string;
  limit?: number;
  scope?: Scope;
}

/**
 * Hybrid search facts options
 */
export interface FactSearchOptions {
  queryVector: Float32Array;
  queryText: string;
  limit?: number;
  scope?: Scope;
}

/**
 * Build scope filter string for LanceDB queries
 */
function buildScopeFilter(scope?: Scope): string | undefined {
  if (!scope) return undefined;
  
  const filter = new ScopeFilter(scope);
  return filter.toLanceFilter();
}

/**
 * Rebuild error type
 */
export interface RebuildError {
  type: 'sqlite_error' | 'lancedb_error' | 'embedding_error' | 'unknown';
  message: string;
}

/**
 * Rebuild result
 */
export interface RebuildResult {
  success: boolean;
  documentsProcessed: number;
  error?: RebuildError;
  blocked?: boolean;
  reason?: string;
}

/**
 * Check and rebuild result
 */
export interface CheckAndRebuildResult {
  rebuilt: boolean;
  error?: RebuildError;
  skipped?: boolean;
  reason?: string;
}

/**
 * Rebuild lock for preventing concurrent rebuilds
 */
let rebuildLock: Map<string, boolean> = new Map();

/**
 * Rebuild table from SQLite documents
 * Creates table if missing, reads documents from SQLite, generates embeddings, inserts to LanceDB
 * @param clearExisting - If true, clears existing vectors before rebuilding (for incomplete rebuilds)
 */
export async function rebuildTable(tableName: string, scope?: Scope, clearExisting: boolean = false): Promise<RebuildResult> {
  // Check for concurrent rebuild attempt
  const lockKey = `${tableName}:${scope?.userId || 'default'}`;
  if (rebuildLock.get(lockKey)) {
    return {
      success: false,
      blocked: true,
      documentsProcessed: 0,
      reason: 'rebuild in progress'
    };
  }
  
  // Acquire lock
  rebuildLock.set(lockKey, true);
  
  try {
    // Check SQLite connection before using
    if (!isSQLiteOpen()) {
      return {
        success: false,
        documentsProcessed: 0,
        error: {
          type: 'sqlite_error',
          message: 'SQLite connection is closed'
        }
      };
    }
    
    // Check LanceDB connection before using
    if (!await isLanceOpen()) {
      return {
        success: false,
        documentsProcessed: 0,
        error: {
          type: 'lancedb_error',
          message: 'LanceDB connection is closed'
        }
      };
    }
    
    // Create table if missing
    const tableCreated = !await tableExists(tableName);
    if (tableCreated) {
      await createTableByName(tableName);
    }
    
    // Clear existing vectors if requested (for incomplete rebuilds)
    if (clearExisting && tableName === 'documents_vec') {
      await clearDocumentVectors();
    }
    
    // Get documents from SQLite for this scope
    let docs: DocumentRecord[] = [];
    try {
      if (scope) {
        docs = getDocumentsByScope(scope);
      }
    } catch (err) {
      return {
        success: false,
        documentsProcessed: 0,
        error: {
          type: 'sqlite_error',
          message: err instanceof Error ? err.message : 'SQLite read error'
        }
      };
    }
    
    // Process documents - generate embeddings and insert
    let documentsProcessed = 0;
    for (const doc of docs) {
      // Check for empty content - treat as embedding error
      if (!doc.content || doc.content.trim() === '') {
        return {
          success: false,
          documentsProcessed,
          error: {
            type: 'embedding_error',
            message: `Document ${doc.id} has empty content`
          }
        };
      }
      
      try {
        // Check if vector already exists to avoid duplicates (only if not clearing)
        if (!clearExisting) {
          const existing = await getDocumentVector(doc.id);
          if (existing) {
            documentsProcessed++;
            continue;
          }
        }
        
        const embedding = await getEmbedding(doc.content);
        
        await addDocumentVector({
          id: doc.id,
          content: doc.content,
          vector: embedding,
          user_id: doc.user_id,
          agent_id: doc.agent_id,
          team_id: doc.team_id,
          is_global: doc.is_global,
          title: doc.title,
          created_at: doc.created_at
        });
        
        documentsProcessed++;
      } catch (err) {
        // Embedding or LanceDB error - return gracefully
        const errorType = err instanceof Error && err.message.includes('LanceDB') 
          ? 'lancedb_error' 
          : 'embedding_error';
        return {
          success: false,
          documentsProcessed,
          error: {
            type: errorType,
            message: err instanceof Error ? err.message : 'Processing failed'
          }
        };
      }
    }
    
    return {
      success: true,
      documentsProcessed
    };
  } catch (err) {
    // LanceDB error (table operations)
    return {
      success: false,
      documentsProcessed: 0,
      error: {
        type: 'lancedb_error',
        message: err instanceof Error ? err.message : 'LanceDB write error'
      }
    };
  } finally {
    // Release lock
    rebuildLock.delete(lockKey);
  }
}

/**
 * Check if table exists and rebuild if missing
 * Returns result indicating whether rebuild was triggered
 */
export async function checkAndRebuild(tableName: string, scope?: Scope): Promise<CheckAndRebuildResult> {
  // Check if table exists
  if (await tableExists(tableName)) {
    // Check if rebuild is incomplete (LanceDB has partial data)
    if (scope && tableName === 'documents_vec') {
      try {
        const sqliteDocs = getDocumentsByScope(scope);
        const lanceCount = await countDocumentVectors();
        
        // Only rebuild if LanceDB has SOME vectors but fewer than SQLite
        // If LanceDB has 0 vectors, it's intentionally empty (skip rebuild)
        if (lanceCount > 0 && sqliteDocs.length > lanceCount) {
          // Pass clearExisting=true to remove stale vectors before rebuilding
          const result = await rebuildTable(tableName, scope, true);
          return {
            rebuilt: result.success,
            error: result.error,
            reason: result.success ? 'incomplete rebuild detected' : result.reason
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

/**
 * Perform hybrid search (vector + FTS)
>>>>>>> fix/vector-index-init
 */
export async function hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResult[]> {
  const table = await getTable(options.tableName);
  const limit = options.limit ?? 10;
  
  try {
    // Create RRF reranker for hybrid search
    const reranker = await lancedb.rerankers.RRFReranker.create();
    
    // Build hybrid query: FTS + Vector + RRF reranking
    let query = table
      .query()
      .fullTextSearch(options.queryText)
      .nearestTo(Array.from(options.queryVector))
      .rerank(reranker)
      .limit(limit);
    
    // Add scope filter if provided
    const scopeFilter = buildScopeFilter(options.scope);
    if (scopeFilter) {
      query = query.where(scopeFilter);
    }
    
    // Execute hybrid search
    const results = await query.toArray();
    
    // Convert to HybridSearchResult format with RRF relevance scores
    return results.map((r: Record<string, unknown>) => {
      // RRF produces _relevance_score column
      const relevanceScore = (r._relevance_score as number) ?? 
                            (r._score as number) ?? 
                            0;
      
      return {
        id: r.id as string,
        content: r.content as string,
        score: relevanceScore,
        sourceType: options.tableName.replace('_vec', ''),
        sourceId: r.source_id as string | undefined
      };
    });
  } catch (error) {
    // Fallback to vector-only search if hybrid search fails
    // (e.g., when FTS index doesn't exist)
    console.warn('Hybrid search failed, falling back to vector search:', error);
    
    return fallbackVectorSearch(options);
  }
}

/**
 * Fallback to vector-only search when hybrid search fails
 */
async function fallbackVectorSearch(options: HybridSearchOptions): Promise<HybridSearchResult[]> {
  const table = await getTable(options.tableName);
  const limit = options.limit ?? 10;
  
  // Vector search using nearestTo
  let query = table
    .query()
    .nearestTo(Array.from(options.queryVector))
    .limit(limit);
  
  // Add scope filter
  const scopeFilter = buildScopeFilter(options.scope);
  if (scopeFilter) {
    query = query.where(scopeFilter);
  }
  
  // Execute search
  const results = await query.toArray();
  
  // Convert distance to similarity score (inverted)
  // Distance is typically 0-2 for cosine, higher = worse match
  // We convert to score: 1 - distance/2 (normalized)
  return results.map((r: Record<string, unknown>) => {
    const distance = (r._distance as number) ?? 1;
    // Convert distance to similarity score (0 = perfect match, 2 = worst)
    const score = Math.max(0, 1 - distance / 2);
    
    return {
      id: r.id as string,
      content: r.content as string,
      score: score,
      sourceType: options.tableName.replace('_vec', ''),
      sourceId: r.source_id as string | undefined
    };
  });
}

/**
 * Hybrid search documents with auto-rebuild
 */
export async function hybridSearchDocuments(options: DocumentSearchOptions): Promise<HybridSearchResult[]> {
  const limit = options.limit ?? 10;
  
  // Check and rebuild if table missing
  await checkAndRebuild('documents_vec', options.scope);
  
  // Primary: vector search
  const vectorResults = await searchDocumentVectors(
    options.queryVector,
    limit,
    options.scope
  );
  
  // Convert to hybrid results
  return vectorResults.map(r => ({
    id: r.id,
    content: r.content,
    score: 0.5,
    sourceType: 'documents',
    sourceId: r.id
  }));
}

/**
 * Hybrid search facts
 */
export async function hybridSearchFacts(options: FactSearchOptions): Promise<HybridSearchResult[]> {
  return hybridSearch({
    tableName: 'facts_vec',
    queryVector: options.queryVector,
    queryText: options.queryText,
    limit: options.limit,
    scope: options.scope
  });
}