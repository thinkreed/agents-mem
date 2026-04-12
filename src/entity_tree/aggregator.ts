/**
 * @file src/entity_tree/aggregator.ts
 * @description Entity node content aggregator with LLM support
 */

import { getEntityNodeById, getEntityNodesByParent, updateEntityNode } from '../sqlite/entity_nodes';
import { estimateTokens } from '../utils/token_estimate';
import { L1_TOKEN_BUDGET } from '../core/constants';
import { createLLMClient } from '../llm/ollama';
import { buildAggregationPrompt } from '../llm/prompts';

/**
 * Aggregate child content into parent using LLM
 */
export async function aggregateChildContent(parentNodeId: string): Promise<string> {
  const parent = getEntityNodeById(parentNodeId);
  const children = getEntityNodesByParent(parentNodeId);

  if (!parent || children.length === 0) return '';

  // Collect child contents
  const contents: string[] = [];
  for (const child of children) {
    if (child.aggregated_content) {
      contents.push(child.aggregated_content);
    }
  }

  if (contents.length === 0) return '';

  // Simple combination for small content (no LLM needed)
  const combined = contents.join('\n\n---\n\n');
  if (estimateTokens(combined) <= L1_TOKEN_BUDGET) {
    return combined;
  }

  try {
    const llmClient = createLLMClient();
    const prompt = buildAggregationPrompt(contents, parent.entity_name);

    const aggregated = await llmClient.generate(prompt, {
      temperature: 0.5,
      maxTokens: L1_TOKEN_BUDGET + 50
    });

    // Ensure result is within budget
    if (estimateTokens(aggregated) > L1_TOKEN_BUDGET + 50) {
      return combined.slice(0, L1_TOKEN_BUDGET * 4);
    }

    return aggregated.trim();
  } catch {
    // Fall back to simple combination + truncation
    return combined.slice(0, L1_TOKEN_BUDGET * 4);
  }
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