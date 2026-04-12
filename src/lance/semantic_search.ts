/**
 * @file src/lance/semantic_search.ts
 * @description Semantic (vector) search operations
 */

import { getTable } from './connection';
import { Scope } from '../core/types';

/**
 * Semantic search result
 */
export interface SemanticSearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Semantic search options (full)
 */
export interface SemanticSearchOptions {
  tableName: string;
  queryVector: Float32Array;
  limit?: number;
  scope?: Scope;
}

/**
 * Semantic search convenience options (tableName optional)
 */
export interface SemanticSearchConvenienceOptions {
  queryVector: Float32Array;
  limit?: number;
  scope?: Scope;
}

/**
 * Perform semantic search
 */
export async function semanticSearch(options: SemanticSearchOptions): Promise<SemanticSearchResult[]> {
  const table = await getTable(options.tableName);
  const limit = options.limit ?? 10;
  
  // Use nearestTo for vector search (LanceDB 0.27+ API)
  let query = table.query()
    .nearestTo(Array.from(options.queryVector))
    .limit(limit);
  
  if (options.scope) {
    query = query.where(`user_id = '${options.scope.userId}'`);
    if (options.scope.agentId) {
      query = query.where(`agent_id = '${options.scope.agentId}'`);
    }
    if (options.scope.teamId) {
      query = query.where(`team_id = '${options.scope.teamId}'`);
    }
  }
  
  const results = await query.toArray();
  
  return results.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r.content as string,
    score: (r._distance as number) ?? 0.5, // LanceDB returns _distance field
    metadata: r as Record<string, unknown>
  }));
}

/**
 * Semantic search documents
 */
export async function semanticSearchDocuments(options: SemanticSearchConvenienceOptions): Promise<SemanticSearchResult[]> {
  return semanticSearch({
    ...options,
    tableName: 'documents_vec'
  });
}

/**
 * Semantic search messages
 */
export async function semanticSearchMessages(options: SemanticSearchConvenienceOptions): Promise<SemanticSearchResult[]> {
  return semanticSearch({
    ...options,
    tableName: 'messages_vec'
  });
}

/**
 * Semantic search facts
 */
export async function semanticSearchFacts(options: SemanticSearchConvenienceOptions): Promise<SemanticSearchResult[]> {
  return semanticSearch({
    ...options,
    tableName: 'facts_vec'
  });
}