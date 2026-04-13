/**
 * @file tests/utils/config.test.ts
 * @description Logger configuration tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LogLevel } from '../../src/utils/logger';

describe('parseLoggerConfig', () => {
  // Store original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Global vi.resetModules() already in tests/setup.ts
    // Clear all LOG-related env vars
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_BUFFER_SIZE;
    delete process.env.FLUSH_INTERVAL_MS;
    delete process.env.LOG_OUTPUT;
    delete process.env.LOG_FILE_PATH;
    delete process.env.LOG_FORMAT;
    delete process.env.AUDIT_ENABLED;
    delete process.env.LOG_SAMPLING_RATE;
    delete process.env.LOG_MAX_FILE_SIZE;
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    // vi.restoreAllMocks() already in tests/setup.ts globally
  });

  describe('defaults', () => {
    it('should return default config when no env vars set', async () => {
      const { parseLoggerConfig, getDefaultConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      const defaults = getDefaultConfig();
      
      expect(config.level).toBe(defaults.level);
      expect(config.bufferSize).toBe(defaults.bufferSize);
      expect(config.flushIntervalMs).toBe(defaults.flushIntervalMs);
      expect(config.output).toBe(defaults.output);
      expect(config.format).toBe(defaults.format);
      expect(config.auditEnabled).toBe(defaults.auditEnabled);
      expect(config.samplingRate).toBe(defaults.samplingRate);
      expect(config.maxFileSize).toBe(defaults.maxFileSize);
    });

    it('should use INFO as default log level', async () => {
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.level).toBe(LogLevel.INFO);
    });
  });

  describe('env override', () => {
    it('should parse LOG_LEVEL from env', async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.level).toBe(LogLevel.DEBUG);
    });

    it('should parse LOG_BUFFER_SIZE from env', async () => {
      process.env.LOG_BUFFER_SIZE = '500';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.bufferSize).toBe(500);
    });

    it('should parse FLUSH_INTERVAL_MS from env', async () => {
      process.env.FLUSH_INTERVAL_MS = '10000';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.flushIntervalMs).toBe(10000);
    });

    it('should parse LOG_OUTPUT from env', async () => {
      process.env.LOG_OUTPUT = 'file';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.output).toBe('file');
    });

    it('should parse LOG_FORMAT from env', async () => {
      process.env.LOG_FORMAT = 'json';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.format).toBe('json');
    });

    it('should parse AUDIT_ENABLED=true from env', async () => {
      process.env.AUDIT_ENABLED = 'true';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.auditEnabled).toBe(true);
    });

    it('should parse AUDIT_ENABLED=false from env', async () => {
      process.env.AUDIT_ENABLED = 'false';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.auditEnabled).toBe(false);
    });

    it('should parse LOG_SAMPLING_RATE from env', async () => {
      process.env.LOG_SAMPLING_RATE = '0.1';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.samplingRate).toBe(0.1);
    });

    it('should parse LOG_MAX_FILE_SIZE from env', async () => {
      process.env.LOG_MAX_FILE_SIZE = '50000000';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.maxFileSize).toBe(50000000);
    });
  });

  describe('validation', () => {
    it('should fallback to default for invalid LOG_LEVEL', async () => {
      process.env.LOG_LEVEL = 'INVALID';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.level).toBe(LogLevel.INFO);
    });

    it('should enforce minimum buffer size (100)', async () => {
      process.env.LOG_BUFFER_SIZE = '50';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.bufferSize).toBe(100);
    });

    it('should enforce minimum flush interval (1000ms)', async () => {
      process.env.FLUSH_INTERVAL_MS = '500';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.flushIntervalMs).toBe(1000);
    });

    it('should clamp sampling rate between 0 and 1', async () => {
      process.env.LOG_SAMPLING_RATE = '2.0';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.samplingRate).toBe(1);
    });

    it('should clamp sampling rate to 0 for negative values', async () => {
      process.env.LOG_SAMPLING_RATE = '-0.5';
      const { parseLoggerConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.samplingRate).toBe(0);
    });

    it('should fallback for invalid numeric values', async () => {
      process.env.LOG_BUFFER_SIZE = 'not-a-number';
      const { parseLoggerConfig, getDefaultConfig } = await import('../../src/utils/config');
      const config = parseLoggerConfig();
      expect(config.bufferSize).toBe(getDefaultConfig().bufferSize);
    });
  });
});