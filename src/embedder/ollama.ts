/**
 * @file src/embedder/ollama.ts
 * @description Ollama embedding client
 */

import { EMBED_DIMENSION } from '../core/constants';

/**
 * Default embedding model
 */
export const DEFAULT_EMBED_MODEL = 'nomic-embed-text';

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
export class OllamaEmbedder {
  private model: string;
  private url: string;
  
  constructor(config?: EmbedderConfig) {
    this.model = config?.model ?? DEFAULT_EMBED_MODEL;
    this.url = config?.url ?? DEFAULT_OLLAMA_URL;
  }
  
  /**
   * Get embedding for single text
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
    
    return new Float32Array(data.embedding);
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
   * Get dimension
   */
  getDimension(): number {
    return EMBED_DIMENSION;
  }
}

/**
 * Singleton embedder instance
 */
let embedderInstance: OllamaEmbedder | null = null;

/**
 * Create/get singleton embedder
 */
export function createEmbedder(config?: EmbedderConfig): OllamaEmbedder {
  if (!embedderInstance) {
    embedderInstance = new OllamaEmbedder(config);
  }
  return embedderInstance;
}

/**
 * Get embedding using singleton
 */
export async function getEmbedding(text: string): Promise<Float32Array> {
  return createEmbedder().getEmbedding(text);
}

/**
 * Get embeddings using singleton
 */
export async function getEmbeddings(texts: string[]): Promise<Float32Array[]> {
  return createEmbedder().getEmbeddings(texts);
}