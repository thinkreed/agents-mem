/**
 * @file src/utils/log_buffer.ts
 * @description Async log buffer for non-blocking log output
 */

import 'reflect-metadata';
import { singleton } from 'tsyringe';
import { LogLevel } from './logger';

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log buffer configuration
 */
export interface LogBufferConfig {
  bufferSize: number;
  flushIntervalMs: number;
  maxRetries: number;
  expandOnFull: boolean;
  maxExpandFactor: number;
  retryDelay?: number;
  thresholdRatio?: number;
  shutdownTimeoutMs?: number;
}

/**
 * Log buffer statistics
 */
export interface LogBufferStats {
  queued: number;
  flushed: number;
  failed: number;
  pending: number;
}

/**
 * Flush result
 */
export interface FlushResult {
  flushed: number;
  failed: number;
  retries: number;
}

/**
 * Shutdown result
 */
export interface ShutdownResult {
  flushed: number;
  dropped: number;
  timeout: boolean;
}

/**
 * Flush handler function type
 */
type FlushHandler = (entries: LogEntry[]) => Promise<number>;

/**
 * Default buffer configuration (High-throughput per user choice)
 */
export const DEFAULT_BUFFER_CONFIG: LogBufferConfig = {
  bufferSize: 1000,
  flushIntervalMs: 5000,
  maxRetries: 5,
  expandOnFull: true,
  maxExpandFactor: 10,
  retryDelay: 100,
  thresholdRatio: 0.8,
  shutdownTimeoutMs: 2000,
};

/**
 * LogBuffer - Async queue for non-blocking log output
 * 
 * Features:
 * - Buffer expansion when full (with max limit)
 * - Timer-based flush (interval)
 * - Threshold trigger (80% capacity triggers immediate flush)
 * - Retry logic on flush failure
 * - Graceful shutdown with timeout
 */
@singleton()
export class LogBuffer {
  private config: LogBufferConfig;
  private queue: LogEntry[] = [];
  private stats: LogBufferStats = { queued: 0, flushed: 0, failed: 0, pending: 0 };
  private flushHandler: FlushHandler | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private currentBufferSize: number;
  private isShuttingDown: boolean = false;
  private flushInProgress: boolean = false;
  private pendingFlushPromise: Promise<FlushResult> | null = null;

  /**
   * Create a new LogBuffer instance
   */
  constructor() {
    this.config = DEFAULT_BUFFER_CONFIG;
    this.currentBufferSize = this.config.bufferSize;
  }

  /**
   * Set custom flush handler
   */
  setFlushHandler(handler: FlushHandler): void {
    this.flushHandler = handler;
  }

  /**
   * Enqueue a log entry
   * 
   * - Adds entry to queue
   * - Checks expansion if buffer is full
   * - Triggers threshold flush if queue reaches threshold ratio
   */
  enqueue(entry: LogEntry): void {
    if (this.isShuttingDown) {
      return; // Don't accept new entries during shutdown
    }

    // Check if buffer needs expansion or is at max capacity
    const atCapacity = this.queue.length >= this.currentBufferSize;
    
    if (atCapacity) {
      if (this.config.expandOnFull) {
        const maxBufferSize = this.config.bufferSize * this.config.maxExpandFactor;
        if (this.currentBufferSize < maxBufferSize) {
          // Expand by 100 entries
          this.currentBufferSize = Math.min(
            this.currentBufferSize + 100,
            maxBufferSize
          );
          // After expansion, we can add the entry normally
        } else {
          // At max capacity, drop oldest entry (FIFO)
          // New entry replaces old - don't increment queued stats
          this.queue.shift();
          // Add entry to queue (replacing, not new)
          this.queue.push(entry);
          // pending stays same (decrement+increment), queued not incremented
          // Check threshold trigger
          const thresholdRatio = this.config.thresholdRatio ?? 0.8;
          const thresholdSize = Math.floor(this.currentBufferSize * thresholdRatio);
          if (
            thresholdRatio > 0 &&
            this.queue.length >= thresholdSize &&
            !this.flushInProgress &&
            !this.isShuttingDown
          ) {
            this.flush().catch(() => {});
          }
          return; // Entry replaced, done
        }
      } else {
        // No expansion allowed, drop oldest entry (replacing)
        this.queue.shift();
        this.queue.push(entry);
        // pending stays same, queued not incremented
        const thresholdRatio = this.config.thresholdRatio ?? 0.8;
        const thresholdSize = Math.floor(this.currentBufferSize * thresholdRatio);
        if (
          thresholdRatio > 0 &&
          this.queue.length >= thresholdSize &&
          !this.flushInProgress &&
          !this.isShuttingDown
        ) {
          this.flush().catch(() => {});
        }
        return; // Entry replaced, done
      }
    }

    // Add entry to queue (new entry, not replacement)
    this.queue.push(entry);
    this.stats.queued++;
    this.stats.pending++;

    // Check threshold trigger
    const thresholdRatio = this.config.thresholdRatio ?? 0.8;
    const thresholdSize = Math.floor(this.currentBufferSize * thresholdRatio);
    if (
      thresholdRatio > 0 &&
      this.queue.length >= thresholdSize &&
      !this.flushInProgress &&
      !this.isShuttingDown
    ) {
      // Trigger async flush without blocking
      this.flush().catch(() => {
        // Ignore flush errors in threshold trigger
      });
    }
  }

  /**
   * Get current buffer statistics
   */
  getStats(): LogBufferStats {
    return {
      queued: this.stats.queued,
      flushed: this.stats.flushed,
      failed: this.stats.failed,
      pending: this.queue.length,
    };
  }

  /**
   * Flush all pending entries
   * 
   * - Batch write to flush handler
   * - Retry on failure (up to maxRetries)
   * - Return flush result
   */
  async flush(): Promise<FlushResult> {
    // If flush is already in progress, wait for it
    if (this.flushInProgress && this.pendingFlushPromise) {
      return this.pendingFlushPromise;
    }

    // No entries to flush
    if (this.queue.length === 0) {
      return { flushed: 0, failed: 0, retries: 0 };
    }

    this.flushInProgress = true;
    this.pendingFlushPromise = this.doFlush();
    
    try {
      const result = await this.pendingFlushPromise;
      return result;
    } finally {
      this.flushInProgress = false;
      this.pendingFlushPromise = null;
    }
  }

  /**
   * Internal flush implementation with retry logic
   */
  private async doFlush(): Promise<FlushResult> {
    const entries = [...this.queue];
    const entryCount = entries.length;
    let retries = 0;
    let success = false;

    // Default flush handler just clears the queue
    const handler = this.flushHandler ?? (async () => entryCount);

    // Initial attempt + retries (total attempts = maxRetries + 1)
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      // Count retries: attempt number is the retry count for attempts > 0
      retries = attempt;
      
      try {
        const flushedCount = await handler(entries);
        
        // Success - clear queue and update stats
        this.queue = [];
        this.stats.pending = 0;
        this.stats.flushed += flushedCount;
        success = true;
        
        // retries = number of retry attempts (attempt number)
        return { flushed: flushedCount, failed: 0, retries };
      } catch (error) {
        if (attempt < this.config.maxRetries) {
          // Wait before retry
          await this.delay(this.config.retryDelay ?? 100);
        }
      }
    }

    // All retries failed - preserve queue, update failed stats
    if (!success) {
      this.stats.failed += entryCount;
      return { flushed: 0, failed: entryCount, retries };
    }

    return { flushed: 0, failed: 0, retries };
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start automatic flush timer
   */
  startFlushTimer(): void {
    if (this.flushTimer) {
      return; // Timer already running
    }

    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0 && !this.flushInProgress && !this.isShuttingDown) {
        this.flush().catch(() => {
          // Ignore flush errors in timer
        });
      }
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop automatic flush timer
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Check if timer is running
   */
  isTimerRunning(): boolean {
    return this.flushTimer !== null;
  }

  /**
   * Graceful shutdown
   * 
   * - Stop timer
   * - Flush pending entries with timeout
   * - Drop remaining if timeout exceeded
   */
  async shutdown(): Promise<ShutdownResult> {
    this.isShuttingDown = true;
    this.stopFlushTimer();

    const pendingCount = this.queue.length;
    if (pendingCount === 0) {
      return { flushed: 0, dropped: 0, timeout: false };
    }

    const timeoutMs = this.config.shutdownTimeoutMs ?? 2000;

    try {
      // Attempt flush with timeout
      const flushPromise = this.flush();
      const timeoutPromise = this.delay(timeoutMs).then(() => ({
        timeout: true as const,
      }));

      const result = await Promise.race([
        flushPromise.then(r => ({ ...r, timeout: false })),
        timeoutPromise,
      ]);

      if (result.timeout) {
        // Timeout exceeded - drop remaining entries
        const dropped = this.queue.length;
        this.queue = [];
        this.stats.pending = 0;
        return { flushed: 0, dropped, timeout: true };
      }

      return {
        flushed: result.flushed,
        dropped: result.failed,
        timeout: false,
      };
    } catch (error) {
      // Flush error - drop remaining
      const dropped = this.queue.length;
      this.queue = [];
      this.stats.pending = 0;
      return { flushed: 0, dropped, timeout: false };
    }
  }
}

// ============================================================================
// Backward Compatibility Helpers
// ============================================================================

/**
 * @deprecated Use container.resolve(LogBuffer)
 */
export function getLogBuffer(): LogBuffer {
  const { container } = require('tsyringe');
  return container.resolve(LogBuffer);
}

/**
 * @deprecated Use container.reset()
 */
export function resetLogBuffer(): void {
  const { container } = require('tsyringe');
  container.reset();
}