/**
 * @file src/llm/prompts.ts
 * @description Structured prompts for LLM operations
 */

import { L0_TOKEN_BUDGET, L1_TOKEN_BUDGET } from '../core/constants';

// ============================================================================
// System Prompts
// ============================================================================

export const L0_SYSTEM_PROMPT = `You are a summarization assistant. Generate a ONE-sentence abstract that captures the essential information from the given content.

Focus on:
- Key topics or themes
- Main conclusions or findings
- Critical entities (people, projects, concepts)

Keep the abstract between 50-100 tokens.`;

export const L1_SYSTEM_PROMPT = `You are a content summarization assistant. Generate a structured overview from the given content.

Structure your response as:
1. **Summary**: 2-3 sentences overview
2. **Key Points**: Bullet list of main topics
3. **Entities**: Important entities mentioned
4. **Context**: Background information needed to understand

Keep the overview between 500-2000 tokens.`;

export const FACT_SYSTEM_PROMPT = `You are a fact extraction assistant. Extract atomic facts from the given content.

For each fact, identify:
- content: The fact statement (one sentence)
- factType: One of: preference, decision, observation, conclusion
- entities: Entities involved (array of strings)
- confidence: Confidence level between 0.0 and 1.0

Output as a valid JSON array only (no markdown, no explanation).`;

export const AGGREGATION_SYSTEM_PROMPT = `You are an entity content aggregator. Combine child node contents into a coherent summary that represents the parent entity.

Requirements:
- Preserve key information from all children
- Remove redundancy
- Keep within 2000 token budget
- Focus on the parent entity`;

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build L0 abstract generation prompt
 */
export function buildL0AbstractPrompt(content: string): string {
  if (!content) {
    return `${L0_SYSTEM_PROMPT}

Content: (empty)

Abstract (one sentence):`;
  }

  return `${L0_SYSTEM_PROMPT}

Content:
${content}

Abstract (one sentence, ~${L0_TOKEN_BUDGET} tokens):`;
}

/**
 * Build L1 overview generation prompt
 */
export function buildL1OverviewPrompt(content: string): string {
  if (!content) {
    return `${L1_SYSTEM_PROMPT}

Content: (empty)

Overview:`;
  }

  return `${L1_SYSTEM_PROMPT}

Content:
${content}

Overview (~${L1_TOKEN_BUDGET} tokens):`;
}

/**
 * Build fact extraction prompt
 */
export function buildFactExtractionPrompt(content: string): string {
  if (!content) {
    return `${FACT_SYSTEM_PROMPT}

Content: (empty)

Facts (JSON array): []`;
  }

  return `${FACT_SYSTEM_PROMPT}

Content:
${content}

Facts (JSON array):`;
}

/**
 * Build aggregation prompt for entity tree
 */
export function buildAggregationPrompt(childContents: string[], entityName: string): string {
  const combinedContent = childContents.length > 0
    ? childContents.join('\n\n---\n\n')
    : '(no child content)';

  return `${AGGREGATION_SYSTEM_PROMPT}

Parent Entity: ${entityName}

Child contents:
${combinedContent}

Aggregated content (~${L1_TOKEN_BUDGET} tokens):`;
}