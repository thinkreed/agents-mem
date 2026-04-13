/**
 * @file src/utils/log_buffer.ts
 * @description Async log buffer for non-blocking log output
 */

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
 * Default buffer configuration (High-throughput per user choice)
 */
export const DEFAULT_BUFFER_CONFIG: LogBufferConfig = {
  bufferSize: 1000,
  flushIntervalMs: 5000,
  maxRetries: 5,
  expandOnFull: true,
  maxExpandFactor: 10,
};

// LogBuffer class will be implemented in Wave 2