/**
 * @file tests/embedder/batch.test.ts
 * @description Batch embedding tests (TDD)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BatchEmbedder,
  batchEmbed,
  setBatchConfig,
  getBatchConfig
} from '../../src/embedder/batch';

describe('Batch Embedder', () => {
  describe('BatchEmbedder', () => {
    it('should create batch embedder', () => {
      const batcher = new BatchEmbedder();
      expect(batcher).toBeDefined();
    });

    it('should configure concurrency', () => {
      const batcher = new BatchEmbedder({ concurrency: 5 });
      expect(batcher).toBeDefined();
    });

    it('should use default concurrency when not specified', () => {
      const batcher = new BatchEmbedder();
      expect(batcher).toBeDefined();
    });
  });

  describe('setBatchConfig', () => {
    it('should set batch config', () => {
      setBatchConfig({ concurrency: 10 });
      
      const config = getBatchConfig();
      expect(config.concurrency).toBe(10);
    });

    it('should merge with existing config', () => {
      setBatchConfig({ concurrency: 5 });
      setBatchConfig({ concurrency: 20 });
      
      const config = getBatchConfig();
      expect(config.concurrency).toBe(20);
    });
  });

  describe('getBatchConfig', () => {
    it('should return current config', () => {
      const config = getBatchConfig();
      expect(config).toBeDefined();
      expect(config.concurrency).toBeDefined();
    });
  });

  describe('batchEmbed', () => {
    let originalFetch: typeof fetch;
    
    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ embedding: Array(768).fill(0.1) })
      } as Response));
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.clearAllMocks();
    });

    it('should have batchEmbed function', () => {
      expect(typeof batchEmbed).toBe('function');
    });

    it('should embed batch with mocked fetch', async () => {
      const embeddings = await batchEmbed(['text 1', 'text 2']);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(2);
    });

    it('should handle empty batch', async () => {
      const embeddings = await batchEmbed([]);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(0);
    });

    it('should handle large batch', async () => {
      const texts = Array(20).fill('test text');
      const embeddings = await batchEmbed(texts);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(20);
    });
  });

  describe('BatchEmbedder embedBatch', () => {
    let originalFetch: typeof fetch;
    
    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ embedding: Array(768).fill(0.1) })
      } as Response));
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.clearAllMocks();
    });

    it('should embed texts with BatchEmbedder instance', async () => {
      const batcher = new BatchEmbedder({ concurrency: 5 });
      const embeddings = await batcher.embedBatch(['test']);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(1);
    });

    it('should process batches with low concurrency', async () => {
      const batcher = new BatchEmbedder({ concurrency: 2 });
      const texts = ['a', 'b', 'c', 'd', 'e'];
      const embeddings = await batcher.embedBatch(texts);
      
      expect(embeddings.length).toBe(5);
    });
  });
});