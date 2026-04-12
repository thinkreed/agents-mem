/**
 * @file src/tiered/queue.ts
 * @description Async tiered generation queue
 */

import { createTieredGenerator } from './generator';

/**
 * Queue item
 */
interface QueueItem {
  id: string;
  content: string;
  callback: (result: { abstract: string; overview: string }) => void;
}

/**
 * Tiered generation queue
 */
export class TieredQueue {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  
  /**
   * Add item to queue
   */
  enqueue(id: string, content: string, callback: (result: { abstract: string; overview: string }) => void): void {
    this.queue.push({ id, content, callback });
    this.processQueue();
  }
  
  /**
   * Process queue items
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    
    const generator = createTieredGenerator();
    
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;
      
      try {
        const result = await generator.generateBoth(item.content);
        item.callback(result);
      } catch (error) {
        console.error(`Failed to generate tiered content for ${item.id}:`, error);
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }
}

/**
 * Singleton queue
 */
let queueInstance: TieredQueue | null = null;

/**
 * Get tiered queue
 */
export function getTieredQueue(): TieredQueue {
  if (!queueInstance) {
    queueInstance = new TieredQueue();
  }
  return queueInstance;
}