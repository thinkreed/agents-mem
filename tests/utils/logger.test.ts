/**
 * @file tests/utils/logger.test.ts
 * @description Logger utility tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  Logger, 
  LogTimer,
  createLogger, 
  LogLevel, 
  setGlobalLogLevel,
  getGlobalLogLevel,
  formatTimestamp
} from '../../src/utils/logger';

describe('Logger', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    // Mock console methods
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    // Reset global log level
    setGlobalLogLevel(LogLevel.INFO);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LogLevel', () => {
    it('should have correct level ordering', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.SILENT).toBe(4);
    });
  });

  describe('createLogger', () => {
    it('should create logger with default name', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(logger.level).toBe(LogLevel.INFO);
    });

    it('should create logger with custom name', () => {
      const logger = createLogger('test-module');
      expect(logger.name).toBe('test-module');
    });

    it('should create logger with custom level', () => {
      const logger = createLogger('test', LogLevel.DEBUG);
      expect(logger.level).toBe(LogLevel.DEBUG);
    });
  });

  describe('Logger methods', () => {
    it('should log info message', () => {
      const logger = createLogger('test');
      logger.info('Test message');
      
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0];
      expect(call[0]).toContain('[INFO]');
      expect(call[0]).toContain('test');
      expect(call[0]).toContain('Test message');
    });

    it('should log warn message', () => {
      const logger = createLogger('test');
      logger.warn('Warning message');
      
      expect(consoleSpy.warn).toHaveBeenCalled();
      const call = consoleSpy.warn.mock.calls[0];
      expect(call[0]).toContain('[WARN]');
    });

    it('should log error message', () => {
      const logger = createLogger('test');
      logger.error('Error message');
      
      expect(consoleSpy.error).toHaveBeenCalled();
      const call = consoleSpy.error.mock.calls[0];
      expect(call[0]).toContain('[ERROR]');
    });

    it('should log debug message when level is DEBUG', () => {
      const logger = createLogger('test', LogLevel.DEBUG);
      logger.debug('Debug message');
      
      expect(consoleSpy.debug).toHaveBeenCalled();
      const call = consoleSpy.debug.mock.calls[0];
      expect(call[0]).toContain('[DEBUG]');
    });

    it('should not log debug message when level is INFO', () => {
      const logger = createLogger('test', LogLevel.INFO);
      logger.debug('Debug message');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it('should not log any message when level is SILENT', () => {
      const logger = createLogger('test', LogLevel.SILENT);
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe('Logger with metadata', () => {
    it('should log with additional metadata', () => {
      const logger = createLogger('test');
      logger.info('Message with data', { userId: '123', action: 'test' });
      
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0];
      expect(call.length).toBeGreaterThan(1);
    });

    it('should handle Error objects', () => {
      const logger = createLogger('test');
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp correctly', () => {
      const timestamp = formatTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should format specific date', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const timestamp = formatTimestamp(date);
      expect(timestamp).toContain('2024-01-15');
    });
  });

  describe('Global log level', () => {
    it('should get global log level', () => {
      setGlobalLogLevel(LogLevel.WARN);
      expect(getGlobalLogLevel()).toBe(LogLevel.WARN);
    });

    it('should use global level when not specified', () => {
      setGlobalLogLevel(LogLevel.WARN);
      const logger = createLogger('test');
      
      // INFO is below WARN, should not log
      logger.info('Should not log');
      expect(consoleSpy.info).not.toHaveBeenCalled();
      
      // WARN is at level, should log
      logger.warn('Should log');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });
  });

  describe('Logger.child', () => {
    it('should create child logger with sub-name', () => {
      const parent = createLogger('parent');
      const child = parent.child('sub');
      
      child.info('Child message');
      
      expect(consoleSpy.info).toHaveBeenCalled();
      const call = consoleSpy.info.mock.calls[0];
      expect(call[0]).toContain('parent:sub');
    });

    it('should inherit parent level', () => {
      const parent = createLogger('parent', LogLevel.WARN);
      const child = parent.child('sub');
      
      expect(child.level).toBe(LogLevel.WARN);
    });
  });

  describe('Performance logging', () => {
    it('should support timed operation', async () => {
      const logger = createLogger('perf', LogLevel.DEBUG);
      
      const timer = logger.startTimer('operation');
      expect(timer).toBeInstanceOf(LogTimer);
      await new Promise(resolve => setTimeout(resolve, 50));
      timer.end();
      
      expect(consoleSpy.debug).toHaveBeenCalled();
      const call = consoleSpy.debug.mock.calls[consoleSpy.debug.mock.calls.length - 1];
      expect(call[0]).toContain('operation');
      expect(call[0]).toContain('ms');
    });
  });
});