/**
 * @file tests/embedder/cache.test.ts
 * @description Embedding cache tests (TDD)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EmbeddingCache,
  getCachedEmbedding,
  setCachedEmbedding,
  clearCache,
  getCacheStats
} from '../../src/embedder/cache';

describe('Embedding Cache', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('EmbeddingCache', () => {
    it('should create cache', () => {
      const cache = new EmbeddingCache();
      expect(cache).toBeDefined();
    });

    it('should store embedding', () => {
      const cache = new EmbeddingCache();
      const embedding = new Float32Array(768).fill(0.1);
      
      cache.set('test-key', embedding);
      
      const result = cache.get('test-key');
      expect(result).toBeDefined();
    });

    it('should return undefined for missing key', () => {
      const cache = new EmbeddingCache();
      
      const result = cache.get('missing-key');
      expect(result).toBeUndefined();
    });
  });

  describe('getCachedEmbedding', () => {
    it('should get cached embedding', () => {
      const embedding = new Float32Array(768).fill(0.2);
      setCachedEmbedding('cached-key', embedding);
      
      const result = getCachedEmbedding('cached-key');
      expect(result).toBeDefined();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      setCachedEmbedding('stat-1', new Float32Array(768).fill(0.3));
      setCachedEmbedding('stat-2', new Float32Array(768).fill(0.4));
      
      const stats = getCacheStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('clearCache', () => {
    it('should clear all entries', () => {
      setCachedEmbedding('clear-1', new Float32Array(768).fill(0.5));
      clearCache();
      
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});