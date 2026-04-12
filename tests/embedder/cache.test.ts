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

    it('should evict oldest entry when at max size', () => {
      const cache = new EmbeddingCache(3); // Small max size for testing
      
      const emb1 = new Float32Array(768).fill(0.1);
      const emb2 = new Float32Array(768).fill(0.2);
      const emb3 = new Float32Array(768).fill(0.3);
      const emb4 = new Float32Array(768).fill(0.4);
      
      cache.set('key-1', emb1);
      cache.set('key-2', emb2);
      cache.set('key-3', emb3);
      
      // Cache is at max size
      expect(cache.size()).toBe(3);
      expect(cache.has('key-1')).toBe(true);
      
      // Adding new entry should evict oldest (key-1)
      cache.set('key-4', emb4);
      
      expect(cache.size()).toBe(3);
      expect(cache.has('key-1')).toBe(false); // Evicted
      expect(cache.has('key-2')).toBe(true);
      expect(cache.has('key-3')).toBe(true);
      expect(cache.has('key-4')).toBe(true);
    });

    it('should check if key exists with has()', () => {
      const cache = new EmbeddingCache();
      const embedding = new Float32Array(768).fill(0.5);
      
      cache.set('existing-key', embedding);
      
      expect(cache.has('existing-key')).toBe(true);
      expect(cache.has('non-existing-key')).toBe(false);
    });

    it('should delete cached entry', () => {
      const cache = new EmbeddingCache();
      const embedding = new Float32Array(768).fill(0.6);
      
      cache.set('delete-key', embedding);
      expect(cache.has('delete-key')).toBe(true);
      
      const deleted = cache.delete('delete-key');
      expect(deleted).toBe(true);
      expect(cache.has('delete-key')).toBe(false);
    });

    it('should return false when deleting non-existing key', () => {
      const cache = new EmbeddingCache();
      
      const deleted = cache.delete('non-existing');
      expect(deleted).toBe(false);
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