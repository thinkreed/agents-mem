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
 * Perform FTS search
 */
export async function ftsSearch(options: FTSSearchOptions): Promise<FTSSearchResult[]> {
  const table = await getTable(options.tableName);
  const limit = options.limit ?? 10;
  const column = options.column ?? 'content';
  
  // LanceDB supports text search via query
  // This is a placeholder implementation
  // Actual FTS depends on LanceDB version and configuration
  
  let query = table.query().limit(limit);
  
  if (options.scope) {
    query = query.where(`user_id = '${options.scope.userId}'`);
  }
  
  // Execute query
  const results = await query.toArray();
  
  // Filter results that match query text (simple substring match)
  const filtered = results.filter((r: Record<string, unknown>) => {
    const content = r[column] as string;
    if (!content) return false;
    return content.toLowerCase().includes(options.queryText.toLowerCase());
  });
  
  return filtered.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r[column] as string,
    score: 0.5 // Placeholder score
  }));
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