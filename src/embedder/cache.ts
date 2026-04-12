/**
 * @file src/embedder/cache.ts
 * @description Embedding cache for reducing API calls
 */

import { EMBED_DIMENSION } from '../core/constants';

/**
 * Embedding cache class
 */
export class EmbeddingCache {
  private cache: Map<string, Float32Array> = new Map();
  private maxSize: number = 1000;
  
  constructor(maxSize?: number) {
    this.maxSize = maxSize ?? 1000;
  }
  
  /**
   * Get cached embedding
   */
  get(key: string): Float32Array | undefined {
    return this.cache.get(key);
  }
  
  /**
   * Set cached embedding
   */
  set(key: string, embedding: Float32Array): void {
    // Remove oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, embedding);
  }
  
  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  /**
   * Delete cached embedding
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Singleton cache instance
 */
let cacheInstance: EmbeddingCache | null = null;

/**
 * Get cache singleton
 */
function getCache(): EmbeddingCache {
  if (!cacheInstance) {
    cacheInstance = new EmbeddingCache();
  }
  return cacheInstance;
}

/**
 * Get cached embedding
 */
export function getCachedEmbedding(key: string): Float32Array | undefined {
  return getCache().get(key);
}

/**
 * Set cached embedding
 */
export function setCachedEmbedding(key: string, embedding: Float32Array): void {
  getCache().set(key, embedding);
}

/**
 * Clear cache
 */
export function clearCache(): void {
  getCache().clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: getCache().size(),
    maxSize: 1000
  };
}