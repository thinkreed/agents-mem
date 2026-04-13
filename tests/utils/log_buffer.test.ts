/**
 * @file tests/utils/log_buffer.test.ts
 * @description LogBuffer async queue tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('LogBuffer', () => {
  let LogBuffer: typeof import('../../src/utils/log_buffer').LogBuffer;
  let getLogBuffer: typeof import('../../src/utils/log_buffer').getLogBuffer;
  let DEFAULT_BUFFER_CONFIG: typeof import('../../src/utils/log_buffer').DEFAULT_BUFFER_CONFIG;
  let LogLevel: typeof import('../../src/utils/logger').LogLevel;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Dynamic import to avoid mock pollution (global setup handles resetModules)
    const logBufferModule = await import('../../src/utils/log_buffer');
    LogBuffer = logBufferModule.LogBuffer;
    getLogBuffer = logBufferModule.getLogBuffer;
    DEFAULT_BUFFER_CONFIG = logBufferModule.DEFAULT_BUFFER_CONFIG;
    
    const loggerModule = await import('../../src/utils/logger');
    LogLevel = loggerModule.LogLevel;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('T7: LogBuffer class skeleton + enqueue()', () => {
    it('should create LogBuffer with default config', () => {
      const buffer = new LogBuffer();
      const stats = buffer.getStats();
      
      expect(stats.queued).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.flushed).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should create LogBuffer with custom config', () => {
      const buffer = new LogBuffer({
        bufferSize: 500,
        flushIntervalMs: 3000,
        maxRetries: 3,
        expandOnFull: true,
        maxExpandFactor: 5,
      });
      
      const stats = buffer.getStats();
      expect(stats.queued).toBe(0);
    });

    it('should enqueue a single entry', () => {
      const buffer = new LogBuffer();
      const entry = {
        level: LogLevel.INFO,
        message: 'test message',
        timestamp: Date.now(),
      };
      
      buffer.enqueue(entry);
      
      const stats = buffer.getStats();
      expect(stats.queued).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it('should enqueue multiple entries', () => {
      const buffer = new LogBuffer();
      
      for (let i = 0; i < 10; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const stats = buffer.getStats();
      expect(stats.queued).toBe(10);
      expect(stats.pending).toBe(10);
    });

    it('should enqueue entry with metadata', () => {
      const buffer = new LogBuffer();
      const entry = {
        level: LogLevel.ERROR,
        message: 'error occurred',
        timestamp: Date.now(),
        metadata: { userId: 'user-123', errorCode: 'E001' },
      };
      
      buffer.enqueue(entry);
      
      const stats = buffer.getStats();
      expect(stats.queued).toBe(1);
    });

    it('should expand buffer when reaching bufferSize', () => {
      const buffer = new LogBuffer({ bufferSize: 100, expandOnFull: true });
      
      // Fill to bufferSize
      for (let i = 0; i < 100; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const statsAfterFill = buffer.getStats();
      expect(statsAfterFill.queued).toBe(100);
      
      // Add more - should trigger expansion
      for (let i = 100; i < 150; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const statsAfterExpand = buffer.getStats();
      expect(statsAfterExpand.queued).toBe(150);
    });

    it('should respect maxExpandFactor limit', () => {
      const buffer = new LogBuffer({
        bufferSize: 10,
        expandOnFull: true,
        maxExpandFactor: 10, // max 100 entries
      });
      
      // Try to add more than max (10 * 10 = 100)
      for (let i = 0; i < 110; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      // Should drop entries after hitting max
      const stats = buffer.getStats();
      expect(stats.queued).toBe(100);
    });

    it('should not expand when expandOnFull is false', () => {
      const buffer = new LogBuffer({
        bufferSize: 50,
        expandOnFull: false,
      });
      
      // Try to add more than bufferSize
      for (let i = 0; i < 60; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      // Should drop entries after hitting bufferSize
      const stats = buffer.getStats();
      expect(stats.queued).toBe(50);
    });
  });

  describe('T8: LogBuffer.flush() + retry logic', () => {
    it('should flush all pending entries', async () => {
      const buffer = new LogBuffer({ bufferSize: 100 });
      
      // Add entries
      for (let i = 0; i < 50; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const result = await buffer.flush();
      
      expect(result.flushed).toBe(50);
      expect(result.failed).toBe(0);
      expect(result.retries).toBe(0);
      
      const stats = buffer.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.flushed).toBe(50);
    });

    it('should return empty result when no entries', async () => {
      const buffer = new LogBuffer();
      
      const result = await buffer.flush();
      
      expect(result.flushed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.retries).toBe(0);
    });

    it('should retry on flush failure', async () => {
      // Mock a failing flush handler that fails 1 time then succeeds
      const flushHandler = vi.fn()
        .mockRejectedValueOnce(new Error('Flush failed 1'))
        .mockResolvedValueOnce(50);
      
      const buffer = new LogBuffer({
        bufferSize: 100,
        maxRetries: 5,
        retryDelay: 100,
      });
      buffer.setFlushHandler(flushHandler);
      
      // Add entries
      for (let i = 0; i < 50; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const result = await buffer.flush();
      
      expect(result.flushed).toBe(50);
      expect(result.retries).toBe(1); // 1 retry performed
      expect(flushHandler).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it('should mark entries as failed after max retries', async () => {
      // Mock a consistently failing flush handler
      const flushHandler = vi.fn()
        .mockRejectedValue(new Error('Flush always fails'));
      
      const buffer = new LogBuffer({
        bufferSize: 100,
        maxRetries: 5,
        retryDelay: 10,
      });
      buffer.setFlushHandler(flushHandler);
      
      // Add entries
      for (let i = 0; i < 30; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const result = await buffer.flush();
      
      expect(result.flushed).toBe(0);
      expect(result.failed).toBe(30);
      expect(result.retries).toBe(5);
      
      // Queue should be preserved after failure
      const stats = buffer.getStats();
      expect(stats.pending).toBe(30);
      expect(stats.failed).toBe(30);
    });
  });

  describe('T9: Timer-based flush + threshold trigger', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start flush timer', () => {
      const buffer = new LogBuffer({
        bufferSize: 100,
        flushIntervalMs: 5000,
      });
      
      buffer.startFlushTimer();
      
      // Timer should be running
      expect(buffer.isTimerRunning()).toBe(true);
      
      buffer.stopFlushTimer();
    });

    it('should flush on interval', async () => {
      const flushHandler = vi.fn().mockResolvedValue(10);
      
      const buffer = new LogBuffer({
        bufferSize: 100,
        flushIntervalMs: 5000,
      });
      buffer.setFlushHandler(flushHandler);
      
      // Add entries
      for (let i = 0; i < 10; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      buffer.startFlushTimer();
      
      // Advance time to trigger interval flush
      vi.advanceTimersByTime(5000);
      
      // Wait for async flush to complete
      await Promise.resolve();
      await Promise.resolve();
      
      expect(flushHandler).toHaveBeenCalled();
      
      buffer.stopFlushTimer();
    });

    it('should stop flush timer', () => {
      const buffer = new LogBuffer({
        bufferSize: 100,
        flushIntervalMs: 5000,
      });
      
      buffer.startFlushTimer();
      expect(buffer.isTimerRunning()).toBe(true);
      
      buffer.stopFlushTimer();
      expect(buffer.isTimerRunning()).toBe(false);
    });

    it('should trigger flush at 80% threshold', async () => {
      const flushHandler = vi.fn().mockResolvedValue(80);
      
      const buffer = new LogBuffer({
        bufferSize: 100,
        flushIntervalMs: 5000,
        thresholdRatio: 0.8,
      });
      buffer.setFlushHandler(flushHandler);
      buffer.startFlushTimer();
      
      // Add entries up to 80% threshold
      for (let i = 0; i < 80; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      // Flush should have been triggered automatically
      // Wait for async flush to complete
      await Promise.resolve();
      await Promise.resolve();
      
      expect(flushHandler).toHaveBeenCalled();
      
      buffer.stopFlushTimer();
    });

    it('should not trigger threshold flush when disabled', async () => {
      const flushHandler = vi.fn().mockResolvedValue(80);
      
      const buffer = new LogBuffer({
        bufferSize: 100,
        thresholdRatio: 0, // disabled
      });
      buffer.setFlushHandler(flushHandler);
      
      // Add entries up to 80
      for (let i = 0; i < 80; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      // Flush should not have been triggered
      expect(flushHandler).not.toHaveBeenCalled();
    });
  });

  describe('T10: shutdown() + graceful flush', () => {
    it('should flush all pending entries on shutdown', async () => {
      const flushHandler = vi.fn().mockResolvedValue(100);
      
      const buffer = new LogBuffer({
        bufferSize: 200,
        flushIntervalMs: 5000,
      });
      buffer.setFlushHandler(flushHandler);
      
      // Add entries
      for (let i = 0; i < 100; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const result = await buffer.shutdown();
      
      expect(result.flushed).toBe(100);
      expect(result.dropped).toBe(0);
      expect(result.timeout).toBe(false);
      expect(buffer.isTimerRunning()).toBe(false);
    });

    it('should timeout when flush takes too long', async () => {
      vi.useFakeTimers();
      
      // Mock a slow flush handler
      const flushHandler = vi.fn().mockImplementation(async () => {
        // This will take > 2s timeout
        await new Promise(resolve => setTimeout(resolve, 3000));
        return 50;
      });
      
      const buffer = new LogBuffer({
        bufferSize: 100,
        shutdownTimeoutMs: 2000,
      });
      buffer.setFlushHandler(flushHandler);
      
      // Add entries
      for (let i = 0; i < 50; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      // Start shutdown (will race with timeout)
      const shutdownPromise = buffer.shutdown();
      
      // Advance time past timeout threshold
      vi.advanceTimersByTime(2500);
      
      const result = await shutdownPromise;
      
      expect(result.timeout).toBe(true);
      expect(result.dropped).toBe(50);
      
      vi.useRealTimers();
    });

    it('should stop timer on shutdown', async () => {
      const buffer = new LogBuffer({
        bufferSize: 100,
        flushIntervalMs: 5000,
      });
      
      buffer.startFlushTimer();
      expect(buffer.isTimerRunning()).toBe(true);
      
      await buffer.shutdown();
      expect(buffer.isTimerRunning()).toBe(false);
    });

    it('should handle shutdown with empty queue', async () => {
      const buffer = new LogBuffer();
      
      const result = await buffer.shutdown();
      
      expect(result.flushed).toBe(0);
      expect(result.dropped).toBe(0);
      expect(result.timeout).toBe(false);
    });
  });

  describe('T11: getLogBuffer() singleton', () => {
    it('should return same instance on multiple calls', async () => {
      const module1 = await import('../../src/utils/log_buffer');
      const module2 = await import('../../src/utils/log_buffer');
      
      const buffer1 = module1.getLogBuffer();
      const buffer2 = module2.getLogBuffer();
      
      expect(buffer1).toBe(buffer2);
    });

    it('should use default config for singleton', async () => {
      const module = await import('../../src/utils/log_buffer');
      const buffer = module.getLogBuffer();
      
      const stats = buffer.getStats();
      expect(stats).toBeDefined();
    });

    it('should allow resetting singleton', async () => {
      const module = await import('../../src/utils/log_buffer');
      
      const buffer1 = module.getLogBuffer();
      buffer1.enqueue({
        level: LogLevel.INFO,
        message: 'test',
        timestamp: Date.now(),
      });
      
      // Reset singleton
      module.resetLogBuffer();
      
      const buffer2 = module.getLogBuffer();
      expect(buffer2).not.toBe(buffer1);
      
      const stats = buffer2.getStats();
      expect(stats.queued).toBe(0);
    });
  });

  describe('T12-T14: Integration tests', () => {
    it('should handle full workflow: enqueue, timer flush, shutdown', async () => {
      vi.useFakeTimers();
      
      // Mock returns actual entry count flushed
      const flushHandler = vi.fn().mockImplementation(async (entries: unknown[]) => entries.length);
      
      const buffer = new LogBuffer({
        bufferSize: 100,
        flushIntervalMs: 5000,
        maxRetries: 3,
      });
      buffer.setFlushHandler(flushHandler);
      
      // Enqueue entries
      for (let i = 0; i < 30; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      buffer.startFlushTimer();
      
      // Advance time to trigger flush
      vi.advanceTimersByTime(5000);
      
      // Wait for async flush
      await Promise.resolve();
      await Promise.resolve();
      
      expect(flushHandler).toHaveBeenCalled();
      
      // Enqueue more
      for (let i = 30; i < 50; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      vi.useRealTimers();
      
      // Shutdown
      const result = await buffer.shutdown();
      
      expect(result.flushed).toBe(20); // 50 - 30 already flushed
      expect(buffer.isTimerRunning()).toBe(false);
    });

    it('should track stats correctly through operations', async () => {
      const flushHandler = vi.fn().mockResolvedValue(25);
      
      const buffer = new LogBuffer({
        bufferSize: 100,
      });
      buffer.setFlushHandler(flushHandler);
      
      // Initial stats
      let stats = buffer.getStats();
      expect(stats.queued).toBe(0);
      expect(stats.flushed).toBe(0);
      
      // Enqueue 25
      for (let i = 0; i < 25; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      stats = buffer.getStats();
      expect(stats.queued).toBe(25);
      expect(stats.pending).toBe(25);
      
      // Flush
      await buffer.flush();
      
      stats = buffer.getStats();
      expect(stats.flushed).toBe(25);
      expect(stats.pending).toBe(0);
      
      // Enqueue 10 more
      for (let i = 0; i < 10; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `more ${i}`,
          timestamp: Date.now(),
        });
      }
      
      stats = buffer.getStats();
      expect(stats.queued).toBe(35); // cumulative queued
      expect(stats.pending).toBe(10);
      expect(stats.flushed).toBe(25);
    });

    it('should handle concurrent enqueue operations', () => {
      const buffer = new LogBuffer({ bufferSize: 1000 });
      
      // Simulate concurrent enqueue
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            buffer.enqueue({
              level: LogLevel.INFO,
              message: `concurrent ${i}`,
              timestamp: Date.now(),
            });
          })
        );
      }
      
      return Promise.all(promises).then(() => {
        const stats = buffer.getStats();
        expect(stats.queued).toBe(100);
      });
    });
  });
});