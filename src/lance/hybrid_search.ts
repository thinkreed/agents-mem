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
import { getTable } from './connection';
import { Scope } from '../core/types';
import { ScopeFilter } from '../core/scope';
import { searchDocumentVectors, DocumentVectorRecord } from './documents_vec';
import { searchFactVectors, FactVectorRecord } from './facts_vec';

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
 * Perform hybrid search (FTS + Vector + RRF reranking)
 * 
 * Uses LanceDB 0.27+ API:
 * table.query().fullTextSearch(queryText).nearestTo(vector).rerank(reranker)
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
 * Hybrid search documents
 */
export async function hybridSearchDocuments(options: DocumentSearchOptions): Promise<HybridSearchResult[]> {
  return hybridSearch({
    tableName: 'documents_vec',
    queryVector: options.queryVector,
    queryText: options.queryText,
    limit: options.limit,
    scope: options.scope
  });
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