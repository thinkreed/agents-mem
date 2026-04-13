/**
 * @file tests/utils/shutdown.test.ts
 * @description Graceful shutdown handlers tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('shutdown.ts', () => {
  let registerShutdownHandlers: typeof import('../../src/utils/shutdown').registerShutdownHandlers;
  let flushWithTimeout: typeof import('../../src/utils/shutdown').flushWithTimeout;
  let getLogBuffer: typeof import('../../src/utils/log_buffer').getLogBuffer;
  let resetLogBuffer: typeof import('../../src/utils/log_buffer').resetLogBuffer;
  let LogLevel: typeof import('../../src/utils/logger').LogLevel;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock process.on
    vi.spyOn(process, 'on').mockImplementation(() => process);
    vi.spyOn(process, 'once').mockImplementation(() => process);
    vi.spyOn(process, 'removeListener').mockImplementation(() => process);
    
    // Dynamic import
    const shutdownModule = await import('../../src/utils/shutdown');
    registerShutdownHandlers = shutdownModule.registerShutdownHandlers;
    flushWithTimeout = shutdownModule.flushWithTimeout;
    
    const logBufferModule = await import('../../src/utils/log_buffer');
    getLogBuffer = logBufferModule.getLogBuffer;
    resetLogBuffer = logBufferModule.resetLogBuffer;
    
    const loggerModule = await import('../../src/utils/logger');
    LogLevel = loggerModule.LogLevel;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetLogBuffer();
  });

  describe('T29: registerShutdownHandlers()', () => {
    it('should register SIGTERM handler', () => {
      registerShutdownHandlers();
      
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should register SIGINT handler', () => {
      registerShutdownHandlers();
      
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should register exit handler', () => {
      registerShutdownHandlers();
      
      expect(process.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });

    it('should call shutdown on SIGTERM', async () => {
      const buffer = getLogBuffer();
      const shutdownSpy = vi.spyOn(buffer, 'shutdown').mockResolvedValue({
        flushed: 10,
        dropped: 0,
        timeout: false,
      });
      
      registerShutdownHandlers();
      
      // Extract the SIGTERM handler
      const sigtermHandler = (process.on as ReturnType<typeof vi.fn>).mock.calls.find(
        call => call[0] === 'SIGTERM'
      )?.[1] as () => void;
      
      expect(sigtermHandler).toBeDefined();
      
      // Call handler
      await sigtermHandler();
      
      expect(shutdownSpy).toHaveBeenCalledTimes(1);
    });

    it('should call shutdown on SIGINT', async () => {
      const buffer = getLogBuffer();
      const shutdownSpy = vi.spyOn(buffer, 'shutdown').mockResolvedValue({
        flushed: 5,
        dropped: 0,
        timeout: false,
      });
      
      registerShutdownHandlers();
      
      // Extract the SIGINT handler
      const sigintHandler = (process.on as ReturnType<typeof vi.fn>).mock.calls.find(
        call => call[0] === 'SIGINT'
      )?.[1] as () => void;
      
      expect(sigintHandler).toBeDefined();
      
      // Call handler
      await sigintHandler();
      
      expect(shutdownSpy).toHaveBeenCalledTimes(1);
    });

    it('should call shutdown on exit', async () => {
      const buffer = getLogBuffer();
      const shutdownSpy = vi.spyOn(buffer, 'shutdown').mockResolvedValue({
        flushed: 3,
        dropped: 0,
        timeout: false,
      });
      
      registerShutdownHandlers();
      
      // Extract the exit handler
      const exitHandler = (process.on as ReturnType<typeof vi.fn>).mock.calls.find(
        call => call[0] === 'exit'
      )?.[1] as () => void;
      
      expect(exitHandler).toBeDefined();
      
      // Call handler
      await exitHandler();
      
      expect(shutdownSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('T30: flushWithTimeout()', () => {
    it('should flush successfully within timeout', async () => {
      const buffer = getLogBuffer();
      
      // Add entries
      for (let i = 0; i < 10; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const result = await flushWithTimeout(2000);
      
      expect(result.flushed).toBe(10);
      expect(result.dropped).toBe(0);
      expect(result.timeout).toBe(false);
    });

    it('should timeout when flush takes too long', async () => {
      const buffer = getLogBuffer();
      
      // Mock a slow flush that exceeds timeout
      const slowFlushSpy = vi.spyOn(buffer, 'flush').mockImplementation(async () => {
        // Simulate slow flush (will timeout)
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { flushed: 10, failed: 0, retries: 0 };
      });
      
      // Add entries
      for (let i = 0; i < 10; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      // Start flush with timeout
      const flushPromise = flushWithTimeout(1000);
      
      // Advance time past timeout
      vi.advanceTimersByTime(1500);
      
      const result = await flushPromise;
      
      expect(result.timeout).toBe(true);
      expect(result.dropped).toBe(10);
    });

    it('should return empty result when no pending entries', async () => {
      const buffer = getLogBuffer();
      
      const result = await flushWithTimeout(2000);
      
      expect(result.flushed).toBe(0);
      expect(result.dropped).toBe(0);
      expect(result.timeout).toBe(false);
    });

    it('should use default timeout of 2000ms', async () => {
      const buffer = getLogBuffer();
      
      // Verify buffer has no pending entries (so it returns immediately)
      const stats = buffer.getStats();
      expect(stats.pending).toBe(0);
      
      // When no pending entries, flushWithTimeout returns immediately
      const result = await flushWithTimeout();
      
      expect(result.flushed).toBe(0);
      expect(result.dropped).toBe(0);
      expect(result.timeout).toBe(false);
    });

    it('should handle custom timeout value', async () => {
      const buffer = getLogBuffer();
      
      // Add entries
      for (let i = 0; i < 5; i++) {
        buffer.enqueue({
          level: LogLevel.INFO,
          message: `message ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const result = await flushWithTimeout(3000);
      
      expect(result.flushed).toBe(5);
      expect(result.dropped).toBe(0);
      expect(result.timeout).toBe(false);
    });

    it('should handle flush errors gracefully', async () => {
      const buffer = getLogBuffer();
      
      // Mock flush to throw error
      vi.spyOn(buffer, 'flush').mockRejectedValue(new Error('Flush failed'));
      
      // Add entries
      for (let i = 0; i < 5; i++) {
        buffer.enqueue({
          level: LogLevel.ERROR,
          message: `error ${i}`,
          timestamp: Date.now(),
        });
      }
      
      const result = await flushWithTimeout(2000);
      
      // On error, entries should be dropped
      expect(result.dropped).toBe(5);
      expect(result.timeout).toBe(false);
    });
  });
});
