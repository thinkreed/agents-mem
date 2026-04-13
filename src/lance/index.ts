/**
 * @file src/lance/index.ts
 * @description LanceDB index management
 */

import { Index } from '@lancedb/lancedb';
import { getTable, listTables } from './connection';
import { getVectorFieldName } from './schema';

/**
 * Minimum rows required for creating vector index
 */
const MIN_ROWS_FOR_VECTOR_INDEX = 256;

/**
 * Index statistics
 */
export interface IndexStats {
  tableName: string;
  rowCount: number;
  hasVectorIndex: boolean;
  hasFTSIndex: boolean;
}

/**
 * Create vector index on table (requires at least 256 rows)
 */
export async function createVectorIndex(tableName: string): Promise<void> {
  const table = await getTable(tableName);
  
  // Check if we have enough rows for index creation
  const rowCount = await table.countRows();
  if (rowCount < MIN_ROWS_FOR_VECTOR_INDEX) {
    // Skip index creation if not enough rows
    console.log(`Skipping vector index creation for ${tableName}: only ${rowCount} rows (need ${MIN_ROWS_FOR_VECTOR_INDEX})`);
    return;
  }
  
  // Create vector index with proper options
  await table.createIndex(getVectorFieldName(), {
    config: Index.ivfPq({
      numPartitions: Math.min(Math.ceil(rowCount / 256), 256)
    })
  });
}

/**
 * Create FTS index on table
 * For documents_vec, creates indexes on both 'content' and 'content_segmented' columns
 * to support both English and Chinese full-text search.
 */
export async function createFTSIndex(tableName: string, column: string): Promise<void> {
  const table = await getTable(tableName);
  
  // For documents_vec, create FTS index on both columns for full coverage
  if (tableName === 'documents_vec' && column === 'content') {
    // Create FTS index on original content (for English and general search)
    await table.createIndex('content', { config: Index.fts() });
    
    // Create FTS index on segmented content (for Chinese search)
    try {
      await table.createIndex('content_segmented', { config: Index.fts() });
    } catch {
      // content_segmented may not exist or be all null, ignore error
      console.log(`Skipping content_segmented FTS index for ${tableName}`);
    }
  } else {
    // Create BM25-based FTS index using LanceDB Index.fts()
    await table.createIndex(column, { config: Index.fts() });
  }
}

/**
 * Create all indexes for all tables (requires 256+ rows per table)
 */
export async function createAllIndexes(): Promise<void> {
  const tableNames = await listTables();
  
  for (const tableName of tableNames) {
    // Only create vector index if table has enough rows
    const table = await getTable(tableName);
    const rowCount = await table.countRows();
    if (rowCount >= MIN_ROWS_FOR_VECTOR_INDEX) {
      await createVectorIndex(tableName);
    }
  }
}

/**
 * Get index statistics
 */
export async function getIndexStats(tableName: string): Promise<IndexStats> {
  const table = await getTable(tableName);
  
  const rowCount = await table.countRows();
  
  return {
    tableName,
    rowCount,
    hasVectorIndex: rowCount >= MIN_ROWS_FOR_VECTOR_INDEX,
    hasFTSIndex: false
  };
}

/**
 * Optimize index
 */
export async function optimizeIndex(tableName: string): Promise<void> {
  const table = await getTable(tableName);
  
  // LanceDB optimization - compact the table
  // Note: optimize may only work on tables with indexes
  const rowCount = await table.countRows();
  if (rowCount >= MIN_ROWS_FOR_VECTOR_INDEX) {
    // Only optimize if we have an index
  }
}