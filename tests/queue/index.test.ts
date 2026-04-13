/**
 * @file tests/queue/index.test.ts
 * @description TDD Wave 1: Singleton tests for EmbeddingQueue
 */

import { describe, it, expect } from 'vitest';

describe('getEmbeddingQueue', () => {
  it('returns EmbeddingQueue instance', async () => {
    const { getEmbeddingQueue } = await import('../../src/queue/index');
    const queue = getEmbeddingQueue();
    expect(queue).toBeDefined();
    expect(typeof queue.addJob).toBe('function');
  });

  it('returns same instance on multiple calls (singleton pattern)', async () => {
    const { getEmbeddingQueue } = await import('../../src/queue/index');
    const queue1 = getEmbeddingQueue();
    const queue2 = getEmbeddingQueue();
    expect(queue1).toBe(queue2);
  });

  it('accepts optional config parameter', async () => {
    const { getEmbeddingQueue } = await import('../../src/queue/index');
    const queue = getEmbeddingQueue({ maxRetries: 5 });
    expect(queue).toBeDefined();
  });

  it('exports getEmbeddingQueue from queue module', async () => {
    const queueModule = await import('../../src/queue/index');
    expect(queueModule.getEmbeddingQueue).toBeDefined();
    expect(typeof queueModule.getEmbeddingQueue).toBe('function');
  });

  it('singleton persists across imports (dynamic import test)', async () => {
    // First import
    const { getEmbeddingQueue: getQueue1 } = await import('../../src/queue/index');
    const queue1 = getQueue1();

    // Second import (should get same instance)
    const { getEmbeddingQueue: getQueue2 } = await import('../../src/queue/index');
    const queue2 = getQueue2();

    // Both imports should return the same instance
    expect(queue1).toBe(queue2);
  });
});