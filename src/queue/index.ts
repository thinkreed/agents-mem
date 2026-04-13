/**
 * @file src/queue/index.ts
 * @description Queue module exports
 */

export * from './types';
import { EmbeddingQueue } from './embedding_queue';
import type { QueueJobConfig } from './types';

/**
 * Singleton queue instance
 */
let queueInstance: EmbeddingQueue | null = null;

/**
 * Get embedding queue singleton
 */
export function getEmbeddingQueue(config?: Partial<QueueJobConfig>): EmbeddingQueue {
  if (!queueInstance) {
    queueInstance = new EmbeddingQueue(config);
  }
  return queueInstance;
}