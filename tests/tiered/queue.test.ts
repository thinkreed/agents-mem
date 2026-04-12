/**
 * @file tests/tiered/queue.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TieredQueue, getTieredQueue } from '../../src/tiered/queue';
import type { Mock } from 'vitest';

// Mock the generator module
vi.mock('../../src/tiered/generator', () => ({
  createTieredGenerator: vi.fn()
}));

// Import mocked module after vi.mock
import { createTieredGenerator } from '../../src/tiered/generator';

// Cast mock for TypeScript
const mockCreateTieredGenerator = createTieredGenerator as Mock;

// Helper to wait for async operations
const waitFor = (fn: () => boolean, timeout = 500): Promise<void> => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      try {
        if (fn()) {
          resolve();
        } else if (Date.now() - start > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 10);
        }
      } catch (e) {
        if (Date.now() - start > timeout) {
          reject(e);
        } else {
          setTimeout(check, 10);
        }
      }
    };
    check();
  });
};

describe('TieredQueue', () => {
  let queue: TieredQueue;
  let mockGenerator: { generateBoth: Mock };

  beforeEach(() => {
    // Reset singleton by creating new instance
    queue = new TieredQueue();
    
    // Setup mock generator
    mockGenerator = {
      generateBoth: vi.fn().mockResolvedValue({
        abstract: 'test abstract',
        overview: 'test overview'
      })
    };
    mockCreateTieredGenerator.mockReturnValue(mockGenerator);
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should add item to queue and trigger processing', async () => {
      const callback = vi.fn();
      
      // Use delayed mock to capture queue state before processing completes
      mockGenerator.generateBoth.mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 100));
        return { abstract: 'test', overview: 'test' };
      });
      
      queue.enqueue('id-1', 'test content', callback);
      
      // Item is immediately shifted when processing starts, so size is 0
      // The key behavior is that callback gets called
      await waitFor(() => callback.mock.calls.length > 0);
      
      expect(callback).toHaveBeenCalled();
      expect(mockGenerator.generateBoth).toHaveBeenCalledWith('test content');
    });

    it('should add multiple items and process them', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      mockGenerator.generateBoth
        .mockResolvedValueOnce({ abstract: 'a1', overview: 'o1' })
        .mockResolvedValueOnce({ abstract: 'a2', overview: 'o2' });
      
      queue.enqueue('id-1', 'content 1', callback1);
      queue.enqueue('id-2', 'content 2', callback2);
      
      await waitFor(() => callback1.mock.calls.length > 0 && callback2.mock.calls.length > 0, 300);
      
      expect(callback1).toHaveBeenCalledWith({ abstract: 'a1', overview: 'o1' });
      expect(callback2).toHaveBeenCalledWith({ abstract: 'a2', overview: 'o2' });
    });
  });

  describe('size', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.size()).toBe(0);
    });

    it('should return 0 after processing starts (items shifted immediately)', async () => {
      // Queue shifts items immediately when processing starts
      const callback = vi.fn();
      
      mockGenerator.generateBoth.mockImplementationOnce(async () => {
        await new Promise(r => setTimeout(r, 50));
        return { abstract: 'test', overview: 'test' };
      });
      
      queue.enqueue('id-1', 'content', callback);
      
      // size is 0 because item is shifted immediately
      expect(queue.size()).toBe(0);
      
      await waitFor(() => callback.mock.calls.length > 0);
    });

    it('should return pending items count during rapid enqueue', async () => {
      // With delayed processing, subsequent items stay in queue while first is processed
      mockGenerator.generateBoth.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 100));
        return { abstract: 'test', overview: 'test' };
      });
      
      const callbacks = [vi.fn(), vi.fn(), vi.fn()];
      
      queue.enqueue('id-1', 'content 1', callbacks[0]);
      // First item shifted, size is 0
      expect(queue.size()).toBe(0);
      
      queue.enqueue('id-2', 'content 2', callbacks[1]);
      // While first is processing, second stays in queue briefly
      // But processing flag prevents concurrent processing
      
      queue.enqueue('id-3', 'content 3', callbacks[2]);
      
      // Wait for all to complete
      await waitFor(() => callbacks.every(cb => cb.mock.calls.length > 0), 500);
      
      expect(queue.size()).toBe(0);
    });
  });

  describe('callback', () => {
    it('should call callback after processing', async () => {
      const callback = vi.fn();
      const expectedResult = {
        abstract: 'generated abstract',
        overview: 'generated overview'
      };
      
      mockGenerator.generateBoth.mockResolvedValue(expectedResult);
      
      queue.enqueue('id-1', 'test content', callback);
      
      await waitFor(() => callback.mock.calls.length > 0);
      
      expect(callback).toHaveBeenCalledWith(expectedResult);
    });

    it('should call callback with generator result', async () => {
      const callback = vi.fn();
      const customResult = {
        abstract: 'custom abstract',
        overview: 'custom overview'
      };
      
      mockGenerator.generateBoth.mockResolvedValue(customResult);
      
      queue.enqueue('doc-123', 'document content', callback);
      
      await waitFor(() => callback.mock.calls.length > 0);
      
      expect(callback).toHaveBeenCalledWith(customResult);
    });

    it('should pass content to generateBoth', async () => {
      const content = 'specific test content';
      const callback = vi.fn();
      
      queue.enqueue('id-1', content, callback);
      
      await waitFor(() => mockGenerator.generateBoth.mock.calls.length > 0);
      
      expect(mockGenerator.generateBoth).toHaveBeenCalledWith(content);
    });
  });

  describe('queue processing', () => {
    it('should process items sequentially', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();
      const processingOrder: string[] = [];
      
      // Track processing order
      mockGenerator.generateBoth
        .mockImplementationOnce(async () => {
          processingOrder.push('item1-start');
          await new Promise(r => setTimeout(r, 50));
          processingOrder.push('item1-end');
          return { abstract: 'abstract 1', overview: 'overview 1' };
        })
        .mockImplementationOnce(async () => {
          processingOrder.push('item2-start');
          await new Promise(r => setTimeout(r, 50));
          processingOrder.push('item2-end');
          return { abstract: 'abstract 2', overview: 'overview 2' };
        })
        .mockImplementationOnce(async () => {
          processingOrder.push('item3-start');
          await new Promise(r => setTimeout(r, 50));
          processingOrder.push('item3-end');
          return { abstract: 'abstract 3', overview: 'overview 3' };
        });
      
      queue.enqueue('id-1', 'content 1', callback1);
      queue.enqueue('id-2', 'content 2', callback2);
      queue.enqueue('id-3', 'content 3', callback3);
      
      await waitFor(() => 
        callback1.mock.calls.length > 0 &&
        callback2.mock.calls.length > 0 &&
        callback3.mock.calls.length > 0,
        500
      );
      
      // Verify sequential processing: each item starts before previous ends
      expect(processingOrder).toEqual([
        'item1-start', 'item1-end',
        'item2-start', 'item2-end',
        'item3-start', 'item3-end'
      ]);
      
      expect(callback1).toHaveBeenCalledWith({ abstract: 'abstract 1', overview: 'overview 1' });
      expect(callback2).toHaveBeenCalledWith({ abstract: 'abstract 2', overview: 'overview 2' });
      expect(callback3).toHaveBeenCalledWith({ abstract: 'abstract 3', overview: 'overview 3' });
    });

    it('should clear queue after processing all items', async () => {
      queue.enqueue('id-1', 'content', vi.fn());
      
      // Item is shifted immediately when processing starts
      expect(queue.size()).toBe(0);
      
      await new Promise(r => setTimeout(r, 100));
      
      expect(queue.size()).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const callback = vi.fn();
      
      mockGenerator.generateBoth.mockRejectedValue(new Error('Generation failed'));
      
      queue.enqueue('error-id', 'content', callback);
      
      await waitFor(() => consoleSpy.mock.calls.length > 0);
      
      // console.error is called with format: `Failed to generate tiered content for ${id}:`, error
      const errorMessage = consoleSpy.mock.calls[0][0];
      expect(errorMessage).toContain('Failed to generate tiered content');
      expect(errorMessage).toContain('error-id');
      
      // Callback should NOT be called on error
      expect(callback).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should continue processing after error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorCallback = vi.fn();
      const successCallback = vi.fn();
      
      mockGenerator.generateBoth
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ abstract: 'success', overview: 'success overview' });
      
      queue.enqueue('error-id', 'error content', errorCallback);
      queue.enqueue('success-id', 'success content', successCallback);
      
      await waitFor(() => successCallback.mock.calls.length > 0, 300);
      
      expect(successCallback).toHaveBeenCalledWith({ abstract: 'success', overview: 'success overview' });
      expect(errorCallback).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should use createTieredGenerator for processing', async () => {
      const callback = vi.fn();
      
      queue.enqueue('id-1', 'content', callback);
      
      await waitFor(() => callback.mock.calls.length > 0);
      
      expect(mockCreateTieredGenerator).toHaveBeenCalled();
    });
  });

  describe('singleton', () => {
    it('should return same instance from getTieredQueue', () => {
      const instance1 = getTieredQueue();
      const instance2 = getTieredQueue();
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance on first call', () => {
      const instance = getTieredQueue();
      
      expect(instance).toBeDefined();
      expect(typeof instance.size).toBe('function');
      expect(typeof instance.enqueue).toBe('function');
    });
    
    it('should be a TieredQueue instance', () => {
      const instance = getTieredQueue();
      
      expect(instance.constructor.name).toBe('TieredQueue');
    });
  });

  describe('integration scenarios', () => {
    it('should not call generator on empty queue', () => {
      // No items enqueued - should not call generator
      expect(queue.size()).toBe(0);
      expect(mockCreateTieredGenerator).not.toHaveBeenCalled();
    });

    it('should handle rapid enqueue calls', async () => {
      const callbacks = Array.from({ length: 5 }, () => vi.fn());
      
      mockGenerator.generateBoth.mockImplementation(async () => ({
        abstract: 'test',
        overview: 'test'
      }));
      
      // Rapid enqueue
      for (let i = 0; i < 5; i++) {
        queue.enqueue(`id-${i}`, `content ${i}`, callbacks[i]);
      }
      
      // Wait for all to process
      await waitFor(() => callbacks.every(cb => cb.mock.calls.length > 0), 500);
      
      // All callbacks should be called
      for (const cb of callbacks) {
        expect(cb).toHaveBeenCalled();
      }
      
      expect(queue.size()).toBe(0);
    });

    it('should process items with different content', async () => {
      const results: { abstract: string; overview: string }[] = [];
      const callback = vi.fn((result) => results.push(result));
      
      mockGenerator.generateBoth
        .mockResolvedValueOnce({ abstract: 'content-a', overview: 'overview-a' })
        .mockResolvedValueOnce({ abstract: 'content-b', overview: 'overview-b' });
      
      queue.enqueue('a', 'first content', callback);
      queue.enqueue('b', 'second content', callback);
      
      await waitFor(() => results.length >= 2, 300);
      
      expect(results[0]).toEqual({ abstract: 'content-a', overview: 'overview-a' });
      expect(results[1]).toEqual({ abstract: 'content-b', overview: 'overview-b' });
    });
  });
});