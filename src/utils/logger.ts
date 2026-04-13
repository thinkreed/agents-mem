/**
 * @file src/utils/logger.ts
 * @description Structured logging utility for agents-mem
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
 * Global log level (default: INFO)
 */
let globalLogLevel: LogLevel = LogLevel.INFO;

/**
 * Set global log level
 */
export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

/**
 * Get global log level
 */
export function getGlobalLogLevel(): LogLevel {
  return globalLogLevel;
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
 * Log metadata type
 */
export interface LogMetadata {
  [key: string]: unknown;
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
  
  constructor(name: string, logger: Logger) {
    this.name = name;
    this.startTime = Date.now();
    this.logger = logger;
  }
  
  /**
   * End timer and log duration
   */
  end(): void {
    const duration = Date.now() - this.startTime;
    this.logger.debug(`${this.name} completed in ${duration}ms`);
  }
}

/**
 * Logger class
 */
export class Logger {
  readonly name: string;
  level: LogLevel;
  
  constructor(name: string = 'default', level?: LogLevel) {
    this.name = name;
    this.level = level ?? globalLogLevel;
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
  private formatMessage(level: string, message: string, metadata?: LogMetadata): string {
    const timestamp = formatTimestamp();
    return `${timestamp} [${level}] [${this.name}] ${message}`;
  }
  
  /**
   * Log debug message
   */
  debug(message: string, metadata?: LogMetadata | Error): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const formatted = this.formatMessage('DEBUG', message);
    if (metadata instanceof Error) {
      console.debug(formatted, metadata.message, metadata.stack);
    } else if (metadata) {
      console.debug(formatted, metadata);
    } else {
      console.debug(formatted);
    }
  }
  
  /**
   * Log info message
   */
  info(message: string, metadata?: LogMetadata | Error): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const formatted = this.formatMessage('INFO', message);
    if (metadata instanceof Error) {
      console.info(formatted, metadata.message, metadata.stack);
    } else if (metadata) {
      console.info(formatted, metadata);
    } else {
      console.info(formatted);
    }
  }
  
  /**
   * Log warn message
   */
  warn(message: string, metadata?: LogMetadata | Error): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const formatted = this.formatMessage('WARN', message);
    if (metadata instanceof Error) {
      console.warn(formatted, metadata.message, metadata.stack);
    } else if (metadata) {
      console.warn(formatted, metadata);
    } else {
      console.warn(formatted);
    }
  }
  
  /**
   * Log error message
   */
  error(message: string, metadata?: LogMetadata | Error): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const formatted = this.formatMessage('ERROR', message);
    if (metadata instanceof Error) {
      console.error(formatted, metadata.message, metadata.stack);
    } else if (metadata) {
      console.error(formatted, metadata);
    } else {
      console.error(formatted);
    }
  }
  
  /**
   * Create child logger with sub-name
   */
  child(subName: string): Logger {
    return new Logger(`${this.name}:${subName}`, this.level);
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
export function createLogger(name: string = 'default', level?: LogLevel): Logger {
  return new Logger(name, level);
}