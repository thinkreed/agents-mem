/**
 * @file src/materials/trace.ts
 * @description Trace chain implementation
 */

import { getFactById, getFactsBySource } from '../sqlite/facts';
import { getTieredContentById, getTieredContentBySource } from '../sqlite/tiered_content';
import { getDocumentById } from '../sqlite/documents';

/**
 * Trace result
 */
export interface TraceResult {
  fact?: ReturnType<typeof getFactById>;
  tiered?: ReturnType<typeof getTieredContentById>;
  document?: ReturnType<typeof getDocumentById>;
  uri?: string;
}

/**
 * Trace fact to source
 */
export async function traceFact(factId: string): Promise<TraceResult> {
  const fact = getFactById(factId);
  if (!fact) return {};
  
  const result: TraceResult = { fact };
  
  // Get tiered content
  const tiered = getTieredContentBySource(fact.source_type, fact.source_id);
  if (tiered) {
    result.tiered = tiered;
    result.uri = tiered.original_uri;
  }
  
  // Get document if source is document
  if (fact.source_type === 'documents') {
    result.document = getDocumentById(fact.source_id);
  }
  
  return result;
}

/**
 * Trace all facts for source
 */
export async function traceSource(sourceType: string, sourceId: string): Promise<TraceResult[]> {
  const facts = getFactsBySource(sourceType, sourceId);
  
  return facts.map(fact => ({
    fact: fact,
    tiered: getTieredContentBySource(sourceType, sourceId)
  }));
}

/**
 * Trace fact to source (alias for compatibility)
 */
export function traceFactToSource(factId: string): TraceResult {
  const fact = getFactById(factId);
  if (!fact) return {};
  
  const result: TraceResult = { fact };
  
  // Get source documents/assets
  const sources = getFactsBySource(fact.source_type, fact.source_id);
  
  // Get tiered content
  const tiered = getTieredContentBySource(fact.source_type, fact.source_id);
  if (tiered) {
    result.tiered = tiered;
    result.uri = tiered.original_uri;
  }
  
  // Get document if source is document
  if (fact.source_type === 'documents') {
    result.document = getDocumentById(fact.source_id);
  }
  
  return result;
}