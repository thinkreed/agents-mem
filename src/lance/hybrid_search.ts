/**
 * @file src/lance/hybrid_search.ts
 * @description Hybrid search combining vector and FTS
 */

import { getTable } from './connection';
import { Scope } from '../core/types';
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
 * Perform hybrid search (vector + FTS)
 */
export async function hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResult[]> {
  const table = await getTable(options.tableName);
  const limit = options.limit ?? 10;
  
  // Vector search using nearestTo (LanceDB 0.27+ API)
  let query = table.query()
    .nearestTo(Array.from(options.queryVector))
    .limit(limit);
  
  // Add scope filter
  if (options.scope) {
    query = query.where(`user_id = '${options.scope.userId}'`);
  }
  
  // Execute search
  const results = await query.toArray();
  
  // Convert to HybridSearchResult format
  return results.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r.content as string,
    score: (r._distance as number) ?? 0.5,
    sourceType: options.tableName.replace('_vec', ''),
    sourceId: r.source_id as string | undefined
  }));
}

/**
 * Hybrid search documents
 */
export async function hybridSearchDocuments(options: DocumentSearchOptions): Promise<HybridSearchResult[]> {
  const limit = options.limit ?? 10;
  
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
  const limit = options.limit ?? 10;
  
  // Primary: vector search
  const vectorResults = await searchFactVectors(
    options.queryVector,
    limit,
    options.scope
  );
  
  // Convert to hybrid results
  return vectorResults.map(r => ({
    id: r.id,
    content: r.content,
    score: r.confidence ?? 0.5,
    sourceType: 'facts',
    sourceId: r.source_id
  }));
}