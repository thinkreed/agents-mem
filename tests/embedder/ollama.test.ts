/**
 * @file tests/embedder/ollama.test.ts
 * @description Ollama embedder tests (TDD)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OllamaEmbedder,
  createEmbedder,
  getEmbedding,
  getEmbeddings,
  DEFAULT_EMBED_MODEL,
  DEFAULT_OLLAMA_URL
} from '../../src/embedder/ollama';

describe('Ollama Embedder', () => {
  describe('Configuration', () => {
    it('should define default model', () => {
      expect(DEFAULT_EMBED_MODEL).toBe('nomic-embed-text');
    });

    it('should define default URL', () => {
      expect(DEFAULT_OLLAMA_URL).toBeDefined();
    });
  });

  describe('OllamaEmbedder', () => {
    it('should create embedder', () => {
      const embedder = new OllamaEmbedder();
      expect(embedder).toBeDefined();
    });

    it('should create with custom config', () => {
      const embedder = new OllamaEmbedder({
        model: 'custom-model',
        url: 'http://localhost:11434'
      });
      expect(embedder).toBeDefined();
    });

    it('should get model name', () => {
      const embedder = new OllamaEmbedder({ model: 'test-model' });
      expect(embedder.getModel()).toBe('test-model');
    });

    it('should get dimension', () => {
      const embedder = new OllamaEmbedder();
      expect(embedder.getDimension()).toBe(768);
    });
  });

  describe('createEmbedder', () => {
    it('should create singleton embedder', () => {
      const embedder = createEmbedder();
      expect(embedder).toBeDefined();
    });
  });

  // Mock fetch tests - use global fetch mock for Bun
  describe('Embedding with mocked fetch', () => {
    let originalFetch: typeof fetch;
    
    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = vi.fn(async (url: string, options?: any) => {
        // Mock Ollama API response
        if (url.includes('/api/embeddings')) {
          return {
            ok: true,
            json: async () => ({
              embedding: Array(768).fill(0.1)
            })
          } as Response;
        }
        return { ok: false } as Response;
      });
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.clearAllMocks();
    });

    it('should call getEmbedding with mocked fetch', async () => {
      const embedder = new OllamaEmbedder();
      const embedding = await embedder.getEmbedding('test text');
      
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should call getEmbeddings with mocked fetch', async () => {
      const embedder = new OllamaEmbedder();
      const embeddings = await embedder.getEmbeddings(['text 1', 'text 2']);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(2);
      expect(embeddings[0].length).toBe(768);
    });

    it('should use singleton getEmbedding', async () => {
      const embedding = await getEmbedding('test');
      
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });

    it('should use singleton getEmbeddings', async () => {
      const embeddings = await getEmbeddings(['test 1', 'test 2']);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(2);
    });
  });

  // Note: Actual embedding tests require running Ollama server
  // These are placeholder tests for the interface
  describe('Embedding Interface', () => {
    it('should have getEmbedding method', () => {
      const embedder = new OllamaEmbedder();
      expect(typeof embedder.getEmbedding).toBe('function');
    });

    it('should have getEmbeddings method', () => {
      const embedder = new OllamaEmbedder();
      expect(typeof embedder.getEmbeddings).toBe('function');
    });
  });
});