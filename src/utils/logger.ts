/**
 * @file src/utils/logger.ts
 * @description Structured logging utility for agents-mem
 */

import { parseLoggerConfig } from './config';
import { getLogBuffer, LogEntry } from './log_buffer';
import { LogLevel, LogFormat, LogMetadata } from './logger_types';

// Re-export types for backward compatibility (LogLevel is enum, others are types)
export { LogLevel };
export type { LogFormat, LogMetadata };

/**
 * Logger configuration from environment
 */
interface LoggerEnvConfig {
  level: LogLevel;
  format: LogFormat;
}

/**
 * Log entry for JSON format
 */
interface JsonLogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  metadata?: LogMetadata;
}

/**
 * Global log level for explicit override
 */
let cachedGlobalLogLevel: LogLevel | null = null;

/**
 * Get environment config with fresh parsing
 */
function getEnvConfig(): LoggerEnvConfig {
  const config = parseLoggerConfig();
  return {
    level: config.level,
    format: config.format,
  };
}

/**
 * Set global log level
 */
export function setGlobalLogLevel(level: LogLevel): void {
  cachedGlobalLogLevel = level;
}

/**
 * Get global log level - returns config level or cached override
 */
export function getGlobalLogLevel(): LogLevel {
  if (cachedGlobalLogLevel !== null) {
    return cachedGlobalLogLevel;
  }
  const config = getEnvConfig();
  return config.level;
}

/**
 * Reset cached global log level (for testing)
 */
export function resetGlobalLogLevel(): void {
  cachedGlobalLogLevel = null;
}

/**
 * Format timestamp for log output
 */
export function formatTimestamp(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Audit metadata for CRUD operations
 * Records only metadata (no sensitive content)
 */
export interface AuditMetadata {
  userId: string;
  agentId?: string;
  teamId?: string;
  resourceType: 'document' | 'asset' | 'conversation' | 'message' | 'fact' | 'team';
  resourceId: string;
  operation: 'create' | 'read' | 'update' | 'delete';
  success: boolean;
  reason?: string;
}

/**
 * Timer class for performance logging
 */
export class LogTimer {
  private name: string;
  private startTime: number;
  private logger: Logger;
  private pausedTime: number | null = null;
  private accumulatedPauseTime: number = 0;
  
  constructor(name: string, logger: Logger) {
    this.name = name;
    this.startTime = Date.now();
    this.logger = logger;
  }
  
  /**
   * Pause the timer
   */
  pause(): void {
    if (this.pausedTime === null) {
      this.pausedTime = Date.now();
    }
  }
  
  /**
   * Resume the timer
   */
  resume(): void {
    if (this.pausedTime !== null) {
      this.accumulatedPauseTime += Date.now() - this.pausedTime;
      this.pausedTime = null;
    }
  }
  
  /**
   * End timer and log duration
   * @returns Duration in milliseconds
   */
  end(): number {
    const now = Date.now();
    // Account for any accumulated pause time
    const actualPauseTime = this.pausedTime !== null 
      ? this.accumulatedPauseTime + (now - this.pausedTime)
      : this.accumulatedPauseTime;
    const duration = (now - this.startTime) - actualPauseTime;
    this.logger.debug(`${this.name} completed in ${duration}ms`);
    return duration;
  }
}

/**
 * Logger class
 */
export class Logger {
  readonly name: string;
  level: LogLevel;
  format: LogFormat;
  
  constructor(name: string = 'default', level?: LogLevel, format?: LogFormat) {
    this.name = name;
    // Use provided level, or cached global level, or config level
    if (level !== undefined) {
      this.level = level;
    } else if (cachedGlobalLogLevel !== null) {
      this.level = cachedGlobalLogLevel;
    } else {
      const config = getEnvConfig();
      this.level = config.level;
    }
    this.format = format ?? getEnvConfig().format;
  }
  
  /**
   * Get effective log level
   */
  private getEffectiveLevel(): LogLevel {
    return this.level;
  }
  
  /**
   * Check if should log at given level
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.getEffectiveLevel();
  }
  
  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, levelStr: string, message: string, metadata?: LogMetadata): { text: string; json?: string } {
    const timestamp = formatTimestamp();
    
    if (this.format === 'json') {
      const jsonEntry: JsonLogEntry = {
        timestamp,
        level: levelStr,
        logger: this.name,
        message,
        ...(metadata && { metadata }),
      };
      return {
        text: JSON.stringify(jsonEntry),
        json: JSON.stringify(jsonEntry),
      };
    }
    
    return {
      text: `${timestamp} [${levelStr}] [${this.name}] ${message}`,
    };
  }
  
  /**
   * Output log to console and buffer
   */
  private outputLog(level: LogLevel, levelStr: string, message: string, metadata?: LogMetadata | Error): void {
    if (!this.shouldLog(level)) return;
    
    const formatted = this.formatMessage(level, levelStr, message, metadata instanceof Error ? { error: metadata.message, stack: metadata.stack } : metadata);
    
    // Synchronous console output
    if (metadata instanceof Error) {
      if (level === LogLevel.DEBUG) console.debug(formatted.text, metadata.message, metadata.stack);
      else if (level === LogLevel.INFO) console.info(formatted.text, metadata.message, metadata.stack);
      else if (level === LogLevel.WARN) console.warn(formatted.text, metadata.message, metadata.stack);
      else if (level === LogLevel.ERROR) console.error(formatted.text, metadata.message, metadata.stack);
    } else if (metadata) {
      if (level === LogLevel.DEBUG) console.debug(formatted.text, metadata);
      else if (level === LogLevel.INFO) console.info(formatted.text, metadata);
      else if (level === LogLevel.WARN) console.warn(formatted.text, metadata);
      else if (level === LogLevel.ERROR) console.error(formatted.text, metadata);
    } else {
      if (level === LogLevel.DEBUG) console.debug(formatted.text);
      else if (level === LogLevel.INFO) console.info(formatted.text);
      else if (level === LogLevel.WARN) console.warn(formatted.text);
      else if (level === LogLevel.ERROR) console.error(formatted.text);
    }
    
    // Async buffered output (don't block)
    const buffer = getLogBuffer();
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      metadata: metadata instanceof Error ? { error: metadata.message } : metadata,
    };
    buffer.enqueue(entry);
  }
  
  /**
   * Log debug message
   */
  debug(message: string, metadata?: LogMetadata | Error): void {
    this.outputLog(LogLevel.DEBUG, 'DEBUG', message, metadata);
  }
  
  /**
   * Log info message
   */
  info(message: string, metadata?: LogMetadata | Error): void {
    this.outputLog(LogLevel.INFO, 'INFO', message, metadata);
  }
  
  /**
   * Log warn message
   */
  warn(message: string, metadata?: LogMetadata | Error): void {
    this.outputLog(LogLevel.WARN, 'WARN', message, metadata);
  }
  
  /**
   * Log error message
   */
  error(message: string, metadata?: LogMetadata | Error): void {
    this.outputLog(LogLevel.ERROR, 'ERROR', message, metadata);
  }
  
  /**
   * Create child logger with sub-name
   */
  child(subName: string): Logger {
    return new Logger(`${this.name}:${subName}`, this.level, this.format);
  }
  
  /**
   * Start timer for performance logging
   */
  startTimer(name: string): LogTimer {
    return new LogTimer(name, this);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(name: string = 'default', level?: LogLevel, format?: LogFormat): Logger {
  return new Logger(name, level, format);
}