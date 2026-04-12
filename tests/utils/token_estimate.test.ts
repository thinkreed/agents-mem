/**
 * @file tests/utils/token_estimate.test.ts
 * @description Test suite for token estimation utilities
 */

import { describe, it, expect } from 'vitest';

describe('Token Estimate Utilities', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', async () => {
      const { estimateTokens } = await import('../../src/utils/token_estimate.js');
      
      const text = 'This is a test sentence with multiple words.';
      const tokens = estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('should handle empty string', async () => {
      const { estimateTokens } = await import('../../src/utils/token_estimate.js');
      
      expect(estimateTokens('')).toBe(0);
    });

    it('should handle Chinese text with different ratio', async () => {
      const { estimateTokens } = await import('../../src/utils/token_estimate.js');
      
      const chineseText = '这是一个中文测试句子';
      const tokens = estimateTokens(chineseText);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle mixed language text', async () => {
      const { estimateTokens } = await import('../../src/utils/token_estimate.js');
      
      const mixedText = 'Hello 世界 this is mixed 测试';
      const tokens = estimateTokens(mixedText);
      
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('truncateToTokens', () => {
    it('should truncate text to max tokens', async () => {
      const { truncateToTokens } = await import('../../src/utils/token_estimate.js');
      
      const longText = 'This is a very long sentence that should be truncated to fit within a specific token budget limit.';
      const truncated = truncateToTokens(longText, 10);
      
      expect(truncated.length).toBeLessThanOrEqual(longText.length);
    });

    it('should add ellipsis when truncated', async () => {
      const { truncateToTokens } = await import('../../src/utils/token_estimate.js');
      
      const longText = 'This is a long text that will be truncated.';
      const truncated = truncateToTokens(longText, 5);
      
      expect(truncated).toContain('...');
    });

    it('should not truncate if within budget', async () => {
      const { truncateToTokens } = await import('../../src/utils/token_estimate.js');
      
      const shortText = 'Short text';
      const truncated = truncateToTokens(shortText, 100);
      
      expect(truncated).toBe(shortText);
    });

    it('should handle empty string', async () => {
      const { truncateToTokens } = await import('../../src/utils/token_estimate.js');
      
      expect(truncateToTokens('', 10)).toBe('');
    });
  });

  describe('isWithinBudget', () => {
    it('should return true if text within token budget', async () => {
      const { isWithinBudget } = await import('../../src/utils/token_estimate.js');
      
      const shortText = 'Short text here';
      
      expect(isWithinBudget(shortText, 100)).toBe(true);
    });

    it('should return false if text exceeds budget', async () => {
      const { isWithinBudget } = await import('../../src/utils/token_estimate.js');
      
      const longText = 'This is a much longer text that exceeds the budget limit specified.';
      
      expect(isWithinBudget(longText, 5)).toBe(false);
    });
  });

  describe('countContentTokens', () => {
    it('should count tokens for content object', async () => {
      const { countContentTokens } = await import('../../src/utils/token_estimate.js');
      
      const content = {
        abstract: 'Short abstract',
        overview: 'Longer overview with more content',
        fullContent: 'Full content with even more text',
      };
      
      const totalTokens = countContentTokens(content);
      
      expect(totalTokens).toBeGreaterThan(0);
    });

    it('should handle undefined fields', async () => {
      const { countContentTokens } = await import('../../src/utils/token_estimate.js');
      
      const content = {
        abstract: 'Short abstract',
        overview: undefined,
        fullContent: null,
      };
      
      const totalTokens = countContentTokens(content);
      
      expect(totalTokens).toBeGreaterThan(0);
    });

    it('should return 0 for empty content', async () => {
      const { countContentTokens } = await import('../../src/utils/token_estimate.js');
      
      expect(countContentTokens({})).toBe(0);
    });
  });

  describe('formatTokenCount', () => {
    it('should format token count with k suffix for large numbers', async () => {
      const { formatTokenCount } = await import('../../src/utils/token_estimate.js');
      
      expect(formatTokenCount(1500)).toBe('1.5k');
      expect(formatTokenCount(1000)).toBe('1k');
      expect(formatTokenCount(2000)).toBe('2k');
    });

    it('should return number string for small counts', async () => {
      const { formatTokenCount } = await import('../../src/utils/token_estimate.js');
      
      expect(formatTokenCount(100)).toBe('100');
      expect(formatTokenCount(500)).toBe('500');
    });

    it('should handle zero', async () => {
      const { formatTokenCount } = await import('../../src/utils/token_estimate.js');
      
      expect(formatTokenCount(0)).toBe('0');
    });
  });
});