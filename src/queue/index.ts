/**
 * @file src/queue/index.ts
 * @description Queue module exports
 */

import { EmbeddingQueue } from './embedding_queue';
import type { QueueJobConfig } from './types';

export * from './types';
export { EmbeddingQueue };

/**
 * Global singleton for EmbeddingQueue
 */
let embeddingQueueInstance: EmbeddingQueue | null = null;

/**
 * Get or create the global EmbeddingQueue singleton
 */
export function getEmbeddingQueue(config?: Partial<QueueJobConfig>): EmbeddingQueue {
  if (!embeddingQueueInstance) {
    embeddingQueueInstance = new EmbeddingQueue(config);
  }
  return embeddingQueueInstance;
}