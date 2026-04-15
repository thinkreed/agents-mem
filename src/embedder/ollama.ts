/**
 * @file src/embedder/ollama.ts
 * @description Ollama embedding client with multilingual support
 */

import 'reflect-metadata';
import { singleton } from 'tsyringe';
import { EMBED_DIMENSION } from '../core/constants';

/**
 * Default embedding model - BGE-M3 for multilingual + Chinese support
 * 
 * Model options:
 * - bge-m3: 1024 dim, 100+ languages, best multilingual (MIRACL 69.20)
 * - qwen3-embedding:8b: Best Chinese performance on C-MTEB
 * - nomic-embed-text-v2-moe: 768 dim, MoE multilingual
 * 
 * For Chinese text: No preprocessing needed, models handle internally
 */
export const DEFAULT_EMBED_MODEL = 'bge-m3';

/**
 * Default Ollama URL
 */
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Embedder configuration
 */
export interface EmbedderConfig {
  model?: string;
  url?: string;
}

/**
 * Ollama embedder class
 */
@singleton()
export class OllamaEmbedder {
  private model: string;
  private url: string;
  private dimension: number;
  
  constructor(config?: EmbedderConfig) {
    this.model = config?.model ?? DEFAULT_EMBED_MODEL;
    this.url = config?.url ?? DEFAULT_OLLAMA_URL;
    this.dimension = EMBED_DIMENSION;
  }
  
  /**
   * Get embedding for single text
   * Works with Chinese directly - no preprocessing needed
   */
  async getEmbedding(text: string): Promise<Float32Array> {
    const response = await fetch(`${this.url}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text
      })
    });
    
    const data = await response.json() as { embedding: number[] };
    
    // Handle different dimension models
    const embedding = data.embedding;
    this.dimension = embedding.length;
    
    return new Float32Array(embedding);
  }
  
  /**
   * Get embeddings for multiple texts
   */
  async getEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const embeddings: Float32Array[] = [];
    
    for (const text of texts) {
      const embedding = await this.getEmbedding(text);
      embeddings.push(embedding);
    }
    
    return embeddings;
  }
  
  /**
   * Get model name
   */
  getModel(): string {
    return this.model;
  }
  
  /**
   * Get dimension (dynamic based on model)
   */
  getDimension(): number {
    return this.dimension;
  }
}

// ============================================================================
// Backward Compatibility Helpers
// ============================================================================

/**
 * @deprecated Use container.resolve(OllamaEmbedder)
 */
export function createEmbedder(config?: EmbedderConfig): OllamaEmbedder {
  const { container } = require('tsyringe');
  return container.resolve(OllamaEmbedder);
}

/**
 * @deprecated Use container.resolve(OllamaEmbedder).getEmbedding()
 */
export async function getEmbedding(text: string): Promise<Float32Array> {
  return createEmbedder().getEmbedding(text);
}

/**
 * @deprecated Use container.resolve(OllamaEmbedder).getEmbeddings()
 */
export async function getEmbeddings(texts: string[]): Promise<Float32Array[]> {
  return createEmbedder().getEmbeddings(texts);
}