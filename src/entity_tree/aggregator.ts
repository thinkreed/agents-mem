/**
 * @file src/entity_tree/aggregator.ts
 * @description Entity node content aggregator
 */

import { getEntityNodeById, getEntityNodesByParent, updateEntityNode } from '../sqlite/entity_nodes';
import { estimateTokens } from '../utils/token_estimate';
import { L1_TOKEN_BUDGET } from '../core/constants';

/**
 * Aggregate child content into parent
 */
export async function aggregateChildContent(parentNodeId: string): Promise<string> {
  const children = getEntityNodesByParent(parentNodeId);
  
  if (children.length === 0) return '';
  
  const contents: string[] = [];
  
  for (const child of children) {
    if (child.aggregated_content) {
      contents.push(child.aggregated_content);
    }
  }
  
  // Combine and truncate to budget
  const combined = contents.join('\n');
  
  // Simple truncation - real implementation would use LLM
  if (estimateTokens(combined) > L1_TOKEN_BUDGET) {
    return combined.slice(0, L1_TOKEN_BUDGET * 4);
  }
  
  return combined;
}

/**
 * Update parent aggregation
 */
export async function updateParentAggregation(parentNodeId: string): Promise<void> {
  const aggregated = await aggregateChildContent(parentNodeId);
  const children = getEntityNodesByParent(parentNodeId);
  
  updateEntityNode(parentNodeId, {
    aggregated_content: aggregated,
    child_count: children.length
  });
}