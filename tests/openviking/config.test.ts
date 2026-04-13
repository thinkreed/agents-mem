/**
 * @file tests/openviking/config.test.ts
 * @description Tests for OpenViking configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadConfigFromEnv,
  getEffectiveConfig,
  getConfig,
  initConfig,
  resetConfig,
  validateConfig,
} from '../../src/openviking/config';
import { DEFAULT_OPENVIKING_CONFIG } from '../../src/openviking/types';

describe('OpenViking Config', () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  describe('loadConfigFromEnv', () => {
    it('should return empty config when no env vars set', () => {
      const config = loadConfigFromEnv();
      expect(config.enabled).toBeUndefined();
      expect(config.baseUrl).toBeUndefined();
    });

    it('should load enabled from env', () => {
      process.env.OPENVIKING_ENABLED = 'true';
      const config = loadConfigFromEnv();
      expect(config.enabled).toBe(true);
      delete process.env.OPENVIKING_ENABLED;
    });

    it('should load baseUrl from env', () => {
      process.env.OPENVIKING_BASE_URL = 'http://custom:1933';
      const config = loadConfigFromEnv();
      expect(config.baseUrl).toBe('http://custom:1933');
      delete process.env.OPENVIKING_BASE_URL;
    });
  });

  describe('getEffectiveConfig', () => {
    it('should return default config with no overrides', () => {
      const config = getEffectiveConfig();
      expect(config.enabled).toBe(DEFAULT_OPENVIKING_CONFIG.enabled);
      expect(config.baseUrl).toBe(DEFAULT_OPENVIKING_CONFIG.baseUrl);
      expect(config.timeout).toBe(DEFAULT_OPENVIKING_CONFIG.timeout);
    });

    it('should merge overrides with defaults', () => {
      const config = getEffectiveConfig({ timeout: 5000 });
      expect(config.timeout).toBe(5000);
      expect(config.baseUrl).toBe(DEFAULT_OPENVIKING_CONFIG.baseUrl);
    });

    it('should merge embedding config', () => {
      const config = getEffectiveConfig({
        embedding: { provider: 'custom', model: 'custom-model', dimension: 512 },
      });
      expect(config.embedding.model).toBe('custom-model');
      expect(config.embedding.dimension).toBe(512);
      expect(config.embedding.provider).toBe('custom');
    });
  });

  describe('getConfig', () => {
    it('should return singleton config', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toBe(config2);
    });

    it('should initialize with default config', () => {
      const config = getConfig();
      expect(config.enabled).toBe(true);
    });
  });

  describe('initConfig', () => {
    it('should initialize with overrides', () => {
      const config = initConfig({ baseUrl: 'http://test:1933' });
      expect(config.baseUrl).toBe('http://test:1933');
    });

    it('should override singleton', () => {
      initConfig({ baseUrl: 'http://first:1933' });
      const config1 = getConfig();
      expect(config1.baseUrl).toBe('http://first:1933');

      initConfig({ baseUrl: 'http://second:1933' });
      const config2 = getConfig();
      expect(config2.baseUrl).toBe('http://second:1933');
    });
  });

  describe('validateConfig', () => {
    it('should validate default config', () => {
      const result = validateConfig(DEFAULT_OPENVIKING_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail on invalid baseUrl', () => {
      const result = validateConfig({
        ...DEFAULT_OPENVIKING_CONFIG,
        baseUrl: 'not-a-url',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('baseUrl must be a valid URL');
    });

    it('should fail on negative timeout', () => {
      const result = validateConfig({
        ...DEFAULT_OPENVIKING_CONFIG,
        timeout: -1,
      });
      expect(result.valid).toBe(false);
    });

    it('should pass on disabled config without baseUrl', () => {
      const result = validateConfig({
        ...DEFAULT_OPENVIKING_CONFIG,
        enabled: false,
        baseUrl: '',
      });
      expect(result.valid).toBe(true);
    });
  });
});