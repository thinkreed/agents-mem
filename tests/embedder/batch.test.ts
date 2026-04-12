/**
 * @file tests/embedder/batch.test.ts
 * @description Batch embedding tests (TDD)
 */

import { describe, it, expect, vi } from 'vitest';
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
  });

  describe('setBatchConfig', () => {
    it('should set batch config', () => {
      setBatchConfig({ concurrency: 10 });
      
      const config = getBatchConfig();
      expect(config.concurrency).toBe(10);
    });
  });

  describe('batchEmbed', () => {
    it('should have batchEmbed function', () => {
      expect(typeof batchEmbed).toBe('function');
    });
  });
});