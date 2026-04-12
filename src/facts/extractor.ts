/**
 * @file src/facts/extractor.ts
 * @description Fact extraction from content
 */

import { createFact, FactInput } from '../sqlite/facts';
import { createExtractionStatus, updateExtractionStatus } from '../sqlite/extraction_status';
import { generateUUID } from '../utils/uuid';

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
 * Fact extractor
 */
export class FactExtractor {
  /**
   * Extract facts from content
   * Note: In production, this would call LLM
   */
  async extract(content: string): Promise<ExtractedFact[]> {
    // Placeholder implementation
    // Returns empty array - real implementation would call LLM
    return [];
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

/**
 * Singleton extractor
 */
let extractorInstance: FactExtractor | null = null;

/**
 * Get fact extractor
 */
export function getFactExtractor(): FactExtractor {
  if (!extractorInstance) {
    extractorInstance = new FactExtractor();
  }
  return extractorInstance;
}