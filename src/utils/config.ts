/**
 * @file src/utils/config.ts
 * @description Logger configuration from environment variables
 */

import { LogLevel } from './logger_types';

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level: LogLevel;
  bufferSize: number;
  flushIntervalMs: number;
  output: 'console' | 'file' | 'both';
  filePath: string;
  format: 'text' | 'json';
  auditEnabled: boolean;
  samplingRate: number;
  maxFileSize: number;
}

/**
 * Default configuration values (High-throughput config per user choice)
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  bufferSize: 1000,
  flushIntervalMs: 5000,
  output: 'console',
  filePath: '~/.agents_mem/logs/',
  format: 'text',
  auditEnabled: true,
  samplingRate: 1.0,
  maxFileSize: 10485760, // 10MB
};

/**
 * Parse log level string to LogLevel enum
 */
function parseLogLevel(levelStr: string): LogLevel {
  const upper = levelStr.toUpperCase();
  switch (upper) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    case 'SILENT':
      return LogLevel.SILENT;
    default:
      return DEFAULT_CONFIG.level;
  }
}

/**
 * Parse output mode string
 */
function parseOutputMode(outputStr: string): 'console' | 'file' | 'both' {
  const lower = outputStr.toLowerCase();
  if (lower === 'console' || lower === 'file' || lower === 'both') {
    return lower;
  }
  return DEFAULT_CONFIG.output;
}

/**
 * Parse format string
 */
function parseFormat(formatStr: string): 'text' | 'json' {
  const lower = formatStr.toLowerCase();
  if (lower === 'text' || lower === 'json') {
    return lower;
  }
  return DEFAULT_CONFIG.format;
}

/**
 * Parse number with validation and default fallback
 */
function parseNumber(value: string | undefined, defaultValue: number, min?: number, max?: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  if (min !== undefined && parsed < min) {
    return min;
  }
  if (max !== undefined && parsed > max) {
    return max;
  }
  return parsed;
}

/**
 * Parse float with validation and default fallback
 */
function parseFloatValue(value: string | undefined, defaultValue: number, min?: number, max?: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  if (min !== undefined && parsed < min) {
    return min;
  }
  if (max !== undefined && parsed > max) {
    return max;
  }
  return parsed;
}

/**
 * Parse boolean string
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return true;
  }
  if (lower === 'false' || lower === '0' || lower === 'no') {
    return false;
  }
  return defaultValue;
}

/**
 * Parse logger configuration from environment variables
 * 
 * Environment variables:
 * - LOG_LEVEL: DEBUG/INFO/WARN/ERROR/SILENT
 * - LOG_BUFFER_SIZE: Queue capacity (default: 1000)
 * - FLUSH_INTERVAL_MS: Flush interval in ms (default: 5000)
 * - LOG_OUTPUT: console/file/both
 * - LOG_FILE_PATH: Log file path (default: ~/.agents_mem/logs/)
 * - LOG_FORMAT: text/json
 * - AUDIT_ENABLED: true/false
 * - LOG_SAMPLING_RATE: 0.0-1.0 (default: 1.0)
 * - LOG_MAX_FILE_SIZE: Max file size in bytes (default: 10MB)
 */
export function parseLoggerConfig(): LoggerConfig {
  const env = process.env;
  
  return {
    level: parseLogLevel(env.LOG_LEVEL ?? ''),
    bufferSize: parseNumber(env.LOG_BUFFER_SIZE, DEFAULT_CONFIG.bufferSize, 100),
    flushIntervalMs: parseNumber(env.FLUSH_INTERVAL_MS, DEFAULT_CONFIG.flushIntervalMs, 1000),
    output: parseOutputMode(env.LOG_OUTPUT ?? ''),
    filePath: env.LOG_FILE_PATH ?? DEFAULT_CONFIG.filePath,
    format: parseFormat(env.LOG_FORMAT ?? ''),
    auditEnabled: parseBoolean(env.AUDIT_ENABLED, DEFAULT_CONFIG.auditEnabled),
    samplingRate: parseFloatValue(env.LOG_SAMPLING_RATE, DEFAULT_CONFIG.samplingRate, 0, 1),
    maxFileSize: parseNumber(env.LOG_MAX_FILE_SIZE, DEFAULT_CONFIG.maxFileSize, 1000000),
  };
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): LoggerConfig {
  return { ...DEFAULT_CONFIG };
}