/**
 * @file src/facts/extractor.ts
 * @description Fact extraction from content with LLM support
 */

import 'reflect-metadata';
import { singleton } from 'tsyringe';
import { TOKENS } from '../core/tokens';
import { inject } from 'tsyringe';
import type { ILLMClient } from '../core/interfaces';
import { createFact, FactInput } from '../sqlite/facts';
import { createExtractionStatus, updateExtractionStatus } from '../sqlite/extraction_status';
import { generateUUID } from '../utils/uuid';
import { buildFactExtractionPrompt } from '../llm/prompts';

/**
 * Extracted fact
 */
export interface ExtractedFact {
  content: string;
  factType: string;
  entities: string[];
  confidence: number;
}

/**
 * Valid fact types
 */
const VALID_FACT_TYPES = ['preference', 'decision', 'observation', 'conclusion'];

/**
 * Fact extractor with LLM support
 */
@singleton()
export class FactExtractor {
  constructor(@inject(TOKENS.LLMClient) private llmClient: ILLMClient) {}
  /**
   * Extract facts from content using LLM
   */
  async extract(content: string): Promise<ExtractedFact[]> {
    // Handle empty/whitespace content
    if (!content || content.trim() === '') {
      return [];
    }

    try {
      const prompt = buildFactExtractionPrompt(content);
      const facts = await this.llmClient.generateJSON<ExtractedFact[]>(prompt, []);

      // Validate and filter facts
      return this.validateFacts(facts);
    } catch {
      // Return empty array on failure
      return [];
    }
  }

  /**
   * Validate extracted facts
   */
  private validateFacts(facts: unknown[]): ExtractedFact[] {
    if (!Array.isArray(facts)) {
      return [];
    }

    return facts.filter((fact): fact is ExtractedFact => {
      if (!fact || typeof fact !== 'object') {
        return false;
      }

      const f = fact as Record<string, unknown>;

      // Check required fields
      if (typeof f.content !== 'string' || !f.content.trim()) {
        return false;
      }

      if (!VALID_FACT_TYPES.includes(f.factType as string)) {
        return false;
      }

      if (!Array.isArray(f.entities)) {
        return false;
      }

      if (typeof f.confidence !== 'number' || f.confidence < 0 || f.confidence > 1) {
        return false;
      }

      return true;
    }).map(f => ({
      content: String(f.content).trim(),
      factType: String(f.factType),
      entities: (f.entities as string[]).map(String),
      confidence: Number(f.confidence)
    }));
  }

  /**
   * Extract and save facts
   */
  async extractAndSave(input: {
    userId: string;
    sourceType: string;
    sourceId: string;
    content: string;
  }): Promise<string[]> {
    const status = createExtractionStatus({
      target_type: input.sourceType,
      target_id: input.sourceId,
      extraction_mode: 'on_demand'
    });

    const facts = await this.extract(input.content);
    const factIds: string[] = [];

    for (const fact of facts) {
      const id = generateUUID();
      createFact({
        id,
        user_id: input.userId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        content: fact.content,
        fact_type: fact.factType,
        entities: JSON.stringify(fact.entities),
        confidence: fact.confidence
      });
      factIds.push(id);
    }

    updateExtractionStatus(status.id, {
      status: 'completed',
      facts_count: facts.length
    });

    return factIds;
  }
}

// ============================================================================
// Backward Compatibility Helpers
// ============================================================================

/**
 * @deprecated Use container.resolve(FactExtractor)
 */
export function getFactExtractor(): FactExtractor {
  const { container } = require('tsyringe');
  return container.resolve(FactExtractor);
}

/**
 * @deprecated Use container.reset()
 */
export function resetFactExtractor(): void {
  const { container } = require('tsyringe');
  container.reset();
}