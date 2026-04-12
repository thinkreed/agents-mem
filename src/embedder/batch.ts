/**
 * @file src/embedder/batch.ts
 * @description Batch embedding operations
 */

import { MAX_EMBED_CONCURRENT } from '../core/constants';
import { createEmbedder } from './ollama';
import { setCachedEmbedding, getCachedEmbedding } from './cache';

/**
 * Batch configuration
 */
export interface BatchConfig {
  concurrency?: number;
}

/**
 * Default batch config
 */
let batchConfig: BatchConfig = {
  concurrency: MAX_EMBED_CONCURRENT
};

/**
 * Batch embedder class
 */
export class BatchEmbedder {
  private concurrency: number;
  
  constructor(config?: BatchConfig) {
    this.concurrency = config?.concurrency ?? MAX_EMBED_CONCURRENT;
  }
  
  /**
   * Embed texts in batches
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const embedder = createEmbedder();
    const results: Float32Array[] = [];
    
    // Process in parallel batches
    const batches = this.chunkArray(texts, this.concurrency);
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(text => this.embedWithCache(text, embedder))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * Embed single text with cache
   */
  private async embedWithCache(text: string, embedder: ReturnType<typeof createEmbedder>): Promise<Float32Array> {
    // Check cache first
    const cacheKey = this.hashText(text);
    const cached = getCachedEmbedding(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    // Get embedding
    const embedding = await embedder.getEmbedding(text);
    
    // Cache result
    setCachedEmbedding(cacheKey, embedding);
    
    return embedding;
  }
  
  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Simple text hash for cache key
   */
  private hashText(text: string): string {
    // Simple hash - can be improved
    return `embed:${text.slice(0, 50)}:${text.length}`;
  }
}

/**
 * Singleton batch embedder
 */
let batchInstance: BatchEmbedder | null = null;

/**
 * Batch embed texts
 */
export async function batchEmbed(texts: string[]): Promise<Float32Array[]> {
  if (!batchInstance) {
    batchInstance = new BatchEmbedder(batchConfig);
  }
  return batchInstance.embedBatch(texts);
}

/**
 * Set batch config
 */
export function setBatchConfig(config: BatchConfig): void {
  batchConfig = { ...batchConfig, ...config };
  batchInstance = null; // Reset instance
}

/**
 * Get batch config
 */
export function getBatchConfig(): BatchConfig {
  return { ...batchConfig };
}