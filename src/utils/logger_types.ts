/**
 * @file src/utils/logger_types.ts
 * @description Type definitions for logger utilities
 */

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Log formatter type
 */
export type LogFormat = 'text' | 'json';

/**
 * Log metadata type
 */
export interface LogMetadata {
  [key: string]: unknown;
}
