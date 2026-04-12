/**
 * @file src/tiered/generator.ts
 * @description L0/L1 content generator
 */

import { estimateTokens, truncateToTokens } from '../utils/token_estimate';
import { L0_TOKEN_BUDGET, L1_TOKEN_BUDGET } from '../core/constants';

/**
 * Tiered content generator
 */
export class TieredGenerator {
  /**
   * Generate L0 abstract from content
   */
  async generateL0(content: string): Promise<string> {
    // For now, truncate to L0 budget
    // In production, this would call LLM for summarization
    return truncateToTokens(content, L0_TOKEN_BUDGET);
  }
  
  /**
   * Generate L1 overview from content
   */
  async generateL1(content: string): Promise<string> {
    // For now, truncate to L1 budget
    // In production, this would call LLM for structured overview
    return truncateToTokens(content, L1_TOKEN_BUDGET);
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