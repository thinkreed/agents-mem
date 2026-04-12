/**
 * @file src/lance/fts_search.ts
 * @description Full-text search operations
 */

import { getTable } from './connection';
import { Scope } from '../core/types';

/**
 * FTS search result
 */
export interface FTSSearchResult {
  id: string;
  content: string;
  score: number;
}

/**
 * FTS search options (full)
 */
export interface FTSSearchOptions {
  tableName: string;
  queryText: string;
  column?: string;
  limit?: number;
  scope?: Scope;
}

/**
 * FTS search convenience options (tableName optional)
 */
export interface FTSSearchConvenienceOptions {
  queryText: string;
  column?: string;
  limit?: number;
  scope?: Scope;
}

/**
 * Perform FTS search using LanceDB fullTextSearch API with BM25 scoring
 */
export async function ftsSearch(options: FTSSearchOptions): Promise<FTSSearchResult[]> {
  const table = await getTable(options.tableName);
  const limit = options.limit ?? 10;
  const column = options.column ?? 'content';
  
  // Handle empty query - return empty results
  if (!options.queryText || options.queryText.trim() === '') {
    return [];
  }
  
  // Build query with fullTextSearch for BM25 scoring
  let query = table.query()
    .fullTextSearch(options.queryText, { columns: column })
    .limit(limit);
  
  // Add scope filter if provided
  if (options.scope) {
    const scopeFilter = buildScopeFilter(options.scope);
    if (scopeFilter) {
      query = query.where(scopeFilter);
    }
  }
  
  // Execute query
  const results = await query.toArray();
  
  // Convert results to FTSSearchResult format with BM25 scores
  return results.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r[column] as string,
    score: (r._score as number) ?? 0.5 // BM25 score from LanceDB
  }));
}

/**
 * Build LanceDB scope filter expression
 */
function buildScopeFilter(scope: Scope): string | null {
  const conditions: string[] = [];
  
  if (scope.userId) {
    conditions.push(`user_id == "${scope.userId}"`);
  }
  
  if (scope.agentId) {
    conditions.push(`agent_id == "${scope.agentId}"`);
  }
  
  if (scope.teamId) {
    conditions.push(`team_id == "${scope.teamId}"`);
  }
  
  return conditions.length > 0 ? conditions.join(' && ') : null;
}

/**
 * FTS search documents
 */
export async function ftsSearchDocuments(options: FTSSearchConvenienceOptions): Promise<FTSSearchResult[]> {
  return ftsSearch({
    ...options,
    tableName: 'documents_vec',
    column: 'content'
  });
}

/**
 * FTS search facts
 */
export async function ftsSearchFacts(options: FTSSearchConvenienceOptions): Promise<FTSSearchResult[]> {
  return ftsSearch({
    ...options,
    tableName: 'facts_vec',
    column: 'content'
  });
}