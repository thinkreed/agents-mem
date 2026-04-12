/**
 * @file tests/tiered/generator.test.ts
 * @description Comprehensive tests for TieredGenerator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TieredGenerator, createTieredGenerator, resetTieredGenerator } from '../../src/tiered/generator';
import { L0_TOKEN_BUDGET, L1_TOKEN_BUDGET } from '../../src/core/constants';
import { truncateToTokens, estimateTokens } from '../../src/utils/token_estimate';
import { resetLLMClient } from '../../src/llm/ollama';

describe('TieredGenerator', () => {
  let generator: TieredGenerator;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    resetLLMClient();
    resetTieredGenerator();
    generator = new TieredGenerator();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
    resetLLMClient();
    resetTieredGenerator();
  });

  describe('generateL0', () => {
    it('should truncate content to L0_TOKEN_BUDGET', async () => {
      // Create content that exceeds L0 budget
      const longContent = 'This is a very long content that should be truncated to fit within the L0 token budget limit which is relatively small compared to L1 budget.';
      const result = await generator.generateL0(longContent);

      // Verify result is truncated using L0_TOKEN_BUDGET
      const expectedTruncated = truncateToTokens(longContent, L0_TOKEN_BUDGET);
      expect(result).toBe(expectedTruncated);
    });

    it('should call truncateToTokens with L0 budget', async () => {
      const testContent = 'Sample content for testing L0 truncation behavior.';
      const result = await generator.generateL0(testContent);

      // The result should match what truncateToTokens returns with L0_TOKEN_BUDGET
      expect(result).toBe(truncateToTokens(testContent, L0_TOKEN_BUDGET));
    });

    it('should handle empty content', async () => {
      const result = await generator.generateL0('');

      expect(result).toBe('');
    });

    it('should return content unchanged if within budget', async () => {
      const shortContent = 'Short text within budget';

      const result = await generator.generateL0(shortContent);

      // If within budget, truncateToTokens returns unchanged
      expect(result).toBe(shortContent);
    });
  });

  describe('generateL1', () => {
    it('should truncate content to L1_TOKEN_BUDGET', async () => {
      // Create content that exceeds L1 budget
      const veryLongContent = Array(100).fill('This is sample text for testing L1 truncation.').join(' ');
      const result = await generator.generateL1(veryLongContent);

      // Verify result is truncated using L1_TOKEN_BUDGET
      const expectedTruncated = truncateToTokens(veryLongContent, L1_TOKEN_BUDGET);
      expect(result).toBe(expectedTruncated);
    });

    it('should call truncateToTokens with L1 budget', async () => {
      const testContent = 'Sample content for testing L1 truncation behavior with more text.';
      const result = await generator.generateL1(testContent);

      // The result should match what truncateToTokens returns with L1_TOKEN_BUDGET
      expect(result).toBe(truncateToTokens(testContent, L1_TOKEN_BUDGET));
    });

    it('should handle empty content', async () => {
      const result = await generator.generateL1('');

      expect(result).toBe('');
    });

    it('should return content unchanged if within budget', async () => {
      const shortContent = 'Short L1 text within budget';

      const result = await generator.generateL1(shortContent);

      expect(result).toBe(shortContent);
    });
  });

  describe('generateBoth', () => {
    it('should return both abstract and overview', async () => {
      const testContent = 'This is test content for generating both tiers with sufficient length.';

      const result = await generator.generateBoth(testContent);

      expect(result).toHaveProperty('abstract');
      expect(result).toHaveProperty('overview');
      expect(typeof result.abstract).toBe('string');
      expect(typeof result.overview).toBe('string');
    });

    it('should call truncateToTokens with L0 and L1 budgets respectively', async () => {
      const testContent = 'Test content for both tiers with some text.';

      const result = await generator.generateBoth(testContent);

      // Verify abstract uses L0 budget
      expect(result.abstract).toBe(truncateToTokens(testContent, L0_TOKEN_BUDGET));
      // Verify overview uses L1 budget
      expect(result.overview).toBe(truncateToTokens(testContent, L1_TOKEN_BUDGET));
    });

    it('should handle empty content for both tiers', async () => {
      const result = await generator.generateBoth('');

      expect(result.abstract).toBe('');
      expect(result.overview).toBe('');
    });

    it('should correctly sequence L0 and L1 generation', async () => {
      const testContent = 'Content to generate for both tiers';

      const result = await generator.generateBoth(testContent);

      // Abstract should be truncated to L0 budget (smaller)
      // Overview should be truncated to L1 budget (larger)
      // L1 budget is larger, so overview may be longer than abstract
      const abstractTokens = estimateTokens(result.abstract);
      const overviewTokens = estimateTokens(result.overview);

      // Both should respect their respective budgets
      expect(abstractTokens).toBeLessThanOrEqual(L0_TOKEN_BUDGET);
      expect(overviewTokens).toBeLessThanOrEqual(L1_TOKEN_BUDGET);
    });
  });

  describe('Constants verification', () => {
    it('should use correct L0_TOKEN_BUDGET value', () => {
      expect(L0_TOKEN_BUDGET).toBe(100);
    });

    it('should use correct L1_TOKEN_BUDGET value', () => {
      expect(L1_TOKEN_BUDGET).toBe(2000);
    });

    it('should have L1 budget larger than L0', () => {
      expect(L1_TOKEN_BUDGET).toBeGreaterThan(L0_TOKEN_BUDGET);
    });
  });
});

describe('createTieredGenerator (singleton)', () => {
  it('should return a TieredGenerator instance', () => {
    const generator = createTieredGenerator();

    expect(generator).toBeDefined();
    expect(generator.constructor.name).toBe('TieredGenerator');
  });

  it('should return the same instance on multiple calls (singleton)', () => {
    const generator1 = createTieredGenerator();
    const generator2 = createTieredGenerator();
    const generator3 = createTieredGenerator();

    expect(generator1).toBe(generator2);
    expect(generator2).toBe(generator3);
    expect(generator1).toBe(generator3);
  });

  it('should maintain singleton across different invocations', () => {
    const instance1 = createTieredGenerator();
    const instance2 = createTieredGenerator();

    // Both should reference the exact same object
    expect(Object.is(instance1, instance2)).toBe(true);
  });

  it('should have generateL0 method', () => {
    const generator = createTieredGenerator();

    expect(typeof generator.generateL0).toBe('function');
  });

  it('should have generateL1 method', () => {
    const generator = createTieredGenerator();

    expect(typeof generator.generateL1).toBe('function');
  });

  it('should have generateBoth method', () => {
    const generator = createTieredGenerator();

    expect(typeof generator.generateBoth).toBe('function');
  });
});

describe('TieredGenerator with LLM mock', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    resetLLMClient();
    resetTieredGenerator();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
    resetLLMClient();
    resetTieredGenerator();
  });

  describe('generateL0 with LLM', () => {
    it('should call LLM for long content', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: 'LLM generated abstract' })
        } as Response;
      });

      // Create content that exceeds L0 budget
      const longContent = 'x'.repeat(500);  // Definitely exceeds 100 tokens
      const generator = new TieredGenerator();
      const result = await generator.generateL0(longContent);

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toBe('LLM generated abstract');
    });

    it('should fall back to truncation when LLM fails', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: false,
          statusText: 'Service unavailable'
        } as Response;
      });

      const longContent = 'x'.repeat(500);
      const generator = new TieredGenerator();
      const result = await generator.generateL0(longContent);

      // Should fall back to truncation
      expect(result).toBe(truncateToTokens(longContent, L0_TOKEN_BUDGET));
    });

    it('should truncate LLM result if too long', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: 'A very long response that exceeds budget' })
        } as Response;
      });

      const longContent = 'x'.repeat(500);
      const generator = new TieredGenerator();
      const result = await generator.generateL0(longContent);

      const tokens = estimateTokens(result);
      expect(tokens).toBeLessThanOrEqual(L0_TOKEN_BUDGET + 20);
    });

    it('should truncate LLM result that exceeds budget + 20', async () => {
      // Return content that definitely exceeds L0_TOKEN_BUDGET + 20
      const superLongResponse = 'word '.repeat(200);  // ~200 words, definitely exceeds 120 tokens
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: superLongResponse })
        } as Response;
      });

      const longContent = 'x'.repeat(500);
      const generator = new TieredGenerator();
      const result = await generator.generateL0(longContent);

      // Result should be truncated to L0_TOKEN_BUDGET
      const tokens = estimateTokens(result);
      expect(tokens).toBeLessThanOrEqual(L0_TOKEN_BUDGET);
    });
  });

  describe('generateL1 with LLM', () => {
    it('should call LLM for long content', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: 'LLM generated overview' })
        } as Response;
      });

      // Create content that exceeds L1 budget
      const longContent = 'x'.repeat(10000);  // Definitely exceeds 2000 tokens
      const generator = new TieredGenerator();
      const result = await generator.generateL1(longContent);

      expect(global.fetch).toHaveBeenCalled();
      expect(result).toBe('LLM generated overview');
    });

    it('should fall back to truncation when LLM fails', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: false,
          statusText: 'Service unavailable'
        } as Response;
      });

      const longContent = 'x'.repeat(10000);
      const generator = new TieredGenerator();
      const result = await generator.generateL1(longContent);

      expect(result).toBe(truncateToTokens(longContent, L1_TOKEN_BUDGET));
    });
  });

  describe('generateBoth with LLM', () => {
    it('should call LLM for both tiers', async () => {
      let callCount = 0;
      global.fetch = vi.fn(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({ response: `Result ${callCount}` })
        } as Response;
      });

      const longContent = 'x'.repeat(10000);
      const generator = new TieredGenerator();
      const result = await generator.generateBoth(longContent);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.abstract).toBeDefined();
      expect(result.overview).toBeDefined();
    });
  });
});