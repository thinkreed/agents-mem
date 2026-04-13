/**
 * @file tests/core/constants.test.ts
 * @description Test suite for core constants
 */

import { describe, it, expect } from 'vitest';

describe('Core Constants', () => {
  describe('Embedding Configuration', () => {
    it('should define EMBED_DIMENSION as 1024', async () => {
      const { EMBED_DIMENSION } = await import('../../src/core/constants.js');
      
      expect(EMBED_DIMENSION).toBe(1024);
    });

    it('should define DEFAULT_EMBED_MODEL', async () => {
      const { DEFAULT_EMBED_MODEL } = await import('../../src/core/constants.js');
      
      expect(DEFAULT_EMBED_MODEL).toBe('bge-m3');
    });
  });

  describe('Tiered Content Configuration', () => {
    it('should define L0 token budget (~100)', async () => {
      const { L0_TOKEN_BUDGET } = await import('../../src/core/constants.js');
      
      expect(L0_TOKEN_BUDGET).toBe(100);
    });

    it('should define L1 token budget (~2000)', async () => {
      const { L1_TOKEN_BUDGET } = await import('../../src/core/constants.js');
      
      expect(L1_TOKEN_BUDGET).toBe(2000);
    });
  });

  describe('Entity Tree Thresholds', () => {
    it('should define BASE_THRESHOLD (θ₀) as 0.7', async () => {
      const { BASE_THRESHOLD } = await import('../../src/core/constants.js');
      
      expect(BASE_THRESHOLD).toBe(0.7);
    });

    it('should define DEPTH_FACTOR (λ) as 0.1', async () => {
      const { DEPTH_FACTOR } = await import('../../src/core/constants.js');
      
      expect(DEPTH_FACTOR).toBe(0.1);
    });

    it('should calculate threshold for depth correctly', async () => {
      const { calculateThreshold } = await import('../../src/core/constants.js');
      
      // θ(d) = θ₀ × e^(λd)
      // θ(0) = 0.7 × e^0 = 0.7
      // θ(1) = 0.7 × e^0.1 ≈ 0.77
      // θ(2) = 0.7 × e^0.2 ≈ 0.85
      // θ(3) = 0.7 × e^0.3 ≈ 0.94 (corrected)
      expect(calculateThreshold(0)).toBeCloseTo(0.7, 2);
      expect(calculateThreshold(1)).toBeCloseTo(0.77, 2);
      expect(calculateThreshold(2)).toBeCloseTo(0.85, 2);
      expect(calculateThreshold(3)).toBeCloseTo(0.94, 2);
    });
  });

  describe('Storage Paths', () => {
    it('should get default storage path under home directory', async () => {
      const { getStoragePath } = await import('../../src/core/constants.js');
      
      const path = getStoragePath();
      
      expect(path).toContain('.agents_mem');
    });
  });

  describe('URI Scheme', () => {
    it('should define URI_SCHEME as "mem"', async () => {
      const { URI_SCHEME } = await import('../../src/core/constants.js');
      
      expect(URI_SCHEME).toBe('mem');
    });
  });

  describe('Database Configuration', () => {
    it('should define SQLITE_DB_NAME', async () => {
      const { SQLITE_DB_NAME } = await import('../../src/core/constants.js');
      
      expect(SQLITE_DB_NAME).toBe('agents_mem.db');
    });

    it('should define SQLITE_WAL_MODE as true', async () => {
      const { SQLITE_WAL_MODE } = await import('../../src/core/constants.js');
      
      expect(SQLITE_WAL_MODE).toBe(true);
    });
  });

  describe('Concurrency Settings', () => {
    it('should define MAX_EMBED_CONCURRENT', async () => {
      const { MAX_EMBED_CONCURRENT } = await import('../../src/core/constants.js');
      
      expect(MAX_EMBED_CONCURRENT).toBe(10);
    });

    it('should define MAX_LLM_CONCURRENT', async () => {
      const { MAX_LLM_CONCURRENT } = await import('../../src/core/constants.js');
      
      expect(MAX_LLM_CONCURRENT).toBe(10);
    });
  });

  describe('Default Values', () => {
    it('should define DEFAULT_IMPORTANCE as 0.5', async () => {
      const { DEFAULT_IMPORTANCE } = await import('../../src/core/constants.js');
      
      expect(DEFAULT_IMPORTANCE).toBe(0.5);
    });

    it('should define DEFAULT_CONFIDENCE as 0.8', async () => {
      const { DEFAULT_CONFIDENCE } = await import('../../src/core/constants.js');
      
      expect(DEFAULT_CONFIDENCE).toBe(0.8);
    });

    it('should define DEFAULT_SEARCH_LIMIT as 10', async () => {
      const { DEFAULT_SEARCH_LIMIT } = await import('../../src/core/constants.js');
      
      expect(DEFAULT_SEARCH_LIMIT).toBe(10);
    });
  });
});