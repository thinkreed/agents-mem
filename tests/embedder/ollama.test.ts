/**
 * @file tests/embedder/ollama.test.ts
 * @description Ollama embedder tests (TDD)
 */

import { describe, it, expect, vi } from 'vitest';
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
  });

  describe('createEmbedder', () => {
    it('should create singleton embedder', () => {
      const embedder = createEmbedder();
      expect(embedder).toBeDefined();
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