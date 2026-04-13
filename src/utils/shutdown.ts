/**
 * @file src/utils/shutdown.ts
 * @description Graceful shutdown handlers for process termination
 */

import { getLogBuffer } from './log_buffer';
import type { ShutdownResult } from './log_buffer';

/**
 * Flush result with timeout indicator
 */
export interface FlushTimeoutResult {
  flushed: number;
  dropped: number;
  timeout: boolean;
}

/**
 * Register shutdown handlers for graceful termination
 * 
 * Handles:
 * - SIGTERM: Kill signal from process manager
 * - SIGINT: Ctrl+C from terminal
 * - exit: Process exit event
 * 
 * Each handler flushes the log buffer before exit
 */
export function registerShutdownHandlers(): void {
  const shutdown = async (): Promise<void> => {
    await getLogBuffer().shutdown();
  };

  // Handle kill signals
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  // Handle process exit
  process.on('exit', shutdown);
}

/**
 * Flush log buffer with timeout protection
 * 
 * Uses Promise.race to ensure shutdown doesn't block indefinitely
 * 
 * @param maxWaitMs - Maximum time to wait for flush (default: 2000ms)
 * @returns Flush result with dropped count and timeout indicator
 */
export async function flushWithTimeout(maxWaitMs: number = 2000): Promise<FlushTimeoutResult> {
  const buffer = getLogBuffer();
  const pendingCount = buffer.getStats().pending;
  
  // No pending entries to flush
  if (pendingCount === 0) {
    return { flushed: 0, dropped: 0, timeout: false };
  }

  try {
    // Race between flush and timeout
    const flushPromise = buffer.shutdown();
    const timeoutPromise = new Promise<ShutdownResult>(resolve => {
      setTimeout(() => {
        resolve({
          flushed: 0,
          dropped: pendingCount,
          timeout: true,
        });
      }, maxWaitMs);
    });

    const result = await Promise.race([flushPromise, timeoutPromise]);

    return {
      flushed: result.flushed,
      dropped: result.dropped,
      timeout: result.timeout,
    };
  } catch (error) {
    // Flush error - drop all pending
    return {
      flushed: 0,
      dropped: pendingCount,
      timeout: false,
    };
  }
}
