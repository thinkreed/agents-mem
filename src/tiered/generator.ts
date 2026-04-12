/**
 * @file src/tiered/generator.ts
 * @description L0/L1 content generator with LLM support
 */

import { estimateTokens, truncateToTokens } from '../utils/token_estimate';
import { L0_TOKEN_BUDGET, L1_TOKEN_BUDGET } from '../core/constants';
import { createLLMClient, resetLLMClient } from '../llm/ollama';
import { buildL0AbstractPrompt, buildL1OverviewPrompt } from '../llm/prompts';

/**
 * Tiered content generator with LLM support
 */
export class TieredGenerator {
  /**
   * Generate L0 abstract from content using LLM
   */
  async generateL0(content: string): Promise<string> {
    // Handle empty content
    if (!content || content.trim() === '') {
      return '';
    }

    // For short content, no need to call LLM
    if (estimateTokens(content) <= L0_TOKEN_BUDGET) {
      return content;
    }

    try {
      const llmClient = createLLMClient();
      const prompt = buildL0AbstractPrompt(content);
      const abstract = await llmClient.generate(prompt, {
        temperature: 0.5,
        maxTokens: L0_TOKEN_BUDGET + 20
      });

      // Ensure result is within budget
      if (estimateTokens(abstract) > L0_TOKEN_BUDGET + 20) {
        return truncateToTokens(abstract, L0_TOKEN_BUDGET);
      }

      return abstract.trim();
    } catch {
      // Fall back to truncation if LLM fails
      return truncateToTokens(content, L0_TOKEN_BUDGET);
    }
  }

  /**
   * Generate L1 overview from content using LLM
   */
  async generateL1(content: string): Promise<string> {
    // Handle empty content
    if (!content || content.trim() === '') {
      return '';
    }

    // For short content, no need to call LLM
    if (estimateTokens(content) <= L1_TOKEN_BUDGET) {
      return content;
    }

    try {
      const llmClient = createLLMClient();
      const prompt = buildL1OverviewPrompt(content);
      const overview = await llmClient.generate(prompt, {
        temperature: 0.6,
        maxTokens: L1_TOKEN_BUDGET + 50
      });

      // Ensure result is within budget
      if (estimateTokens(overview) > L1_TOKEN_BUDGET + 50) {
        return truncateToTokens(overview, L1_TOKEN_BUDGET);
      }

      return overview.trim();
    } catch {
      // Fall back to truncation if LLM fails
      return truncateToTokens(content, L1_TOKEN_BUDGET);
    }
  }

  /**
   * Generate both L0 and L1
   */
  async generateBoth(content: string): Promise<{ abstract: string; overview: string }> {
    const abstract = await this.generateL0(content);
    const overview = await this.generateL1(content);

    return { abstract, overview };
  }
}

/**
 * Singleton generator
 */
let generatorInstance: TieredGenerator | null = null;

/**
 * Create/get tiered generator
 */
export function createTieredGenerator(): TieredGenerator {
  if (!generatorInstance) {
    generatorInstance = new TieredGenerator();
  }
  return generatorInstance;
}

/**
 * Reset generator (for testing)
 */
export function resetTieredGenerator(): void {
  generatorInstance = null;
  resetLLMClient();
}