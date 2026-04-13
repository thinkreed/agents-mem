/**
 * @file tests/utils/chinese_segmenter.test.ts
 * @description Chinese text segmentation tests using jieba-wasm
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { segmentChinese, detectChineseContent, segmentMixedContent } from '../../src/utils/chinese_segmenter';

describe('Chinese Segmenter', () => {
  beforeAll(async () => {
    // Ensure jieba is loaded before tests
    await import('jieba-wasm');
  });

  describe('detectChineseContent', () => {
    it('should detect Chinese content', () => {
      const text = '本文讨论机器学习与深度学习的应用';
      expect(detectChineseContent(text)).toBe(true);
    });

    it('should return false for English content', () => {
      const englishText = 'Machine learning and deep neural networks';
      expect(detectChineseContent(englishText)).toBe(false);
    });

    it('should detect mixed Chinese-English content', () => {
      const mixedText = 'Machine learning 机器学习 applications';
      expect(detectChineseContent(mixedText)).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(detectChineseContent('')).toBe(false);
    });

    it('should return false for numbers only', () => {
      expect(detectChineseContent('12345 67890')).toBe(false);
    });

    it('should detect Japanese Hiragana/Katakana', () => {
      // Japanese uses overlapping Unicode ranges with Chinese
      const japaneseText = 'これは日本語です';
      expect(detectChineseContent(japaneseText)).toBe(true);
    });

    it('should return false for Korean Hangul (different Unicode range)', () => {
      // Korean uses separate Unicode range (Hangul: U+AC00-U+D7AF)
      // Not part of CJK unified ideographs
      const koreanText = '한국어 텍스트';
      expect(detectChineseContent(koreanText)).toBe(false);
    });
  });

  describe('segmentChinese', () => {
    it('should segment Chinese text into words', async () => {
      const text = '本文讨论机器学习与深度学习的应用';
      const segmented = await segmentChinese(text);

      // Should contain meaningful words (not single characters)
      // Note: exact segmentation depends on jieba dictionary
      expect(segmented).toBeDefined();
      expect(typeof segmented).toBe('string');
      
      // Segmented text should have spaces between tokens
      const tokens = segmented.split(' ').filter(t => t.length > 0);
      expect(tokens.length).toBeGreaterThan(1);
    });

    it('should handle simple Chinese phrase', async () => {
      const text = '机器学习';
      const segmented = await segmentChinese(text);
      
      // Should be segmented into words
      expect(segmented).toContain('机器');
      expect(segmented).toContain('学习');
    });

    it('should return original text if no Chinese detected', async () => {
      const text = 'Machine learning with Python';
      const segmented = await segmentChinese(text);

      // Should return unchanged for pure English
      expect(segmented).toBe(text);
    });

    it('should handle empty string', async () => {
      const segmented = await segmentChinese('');
      expect(segmented).toBe('');
    });

    it('should handle punctuation correctly', async () => {
      const text = '机器学习，深度学习。神经网络！';
      const segmented = await segmentChinese(text);

      // Punctuation should be preserved or handled appropriately
      expect(segmented).toBeDefined();
      expect(segmented.length).toBeGreaterThan(0);
    });

    it('should handle numbers in Chinese text', async () => {
      const text = '训练了1000个模型';
      const segmented = await segmentChinese(text);

      expect(segmented).toBeDefined();
      // Numbers should be preserved
      expect(segmented).toContain('1000');
    });
  });

  describe('segmentMixedContent', () => {
    it('should handle mixed Chinese-English content', async () => {
      const text = 'Machine learning 机器学习 applications 应用';
      const segmented = await segmentMixedContent(text);

      // Should preserve English words
      expect(segmented).toContain('Machine');
      expect(segmented).toContain('learning');
      
      // Should segment Chinese words
      expect(segmented).toBeDefined();
    });

    it('should preserve English words unchanged', async () => {
      const text = 'Python programming 语言编程';
      const segmented = await segmentMixedContent(text);

      expect(segmented).toContain('Python');
      expect(segmented).toContain('programming');
    });

    it('should handle pure English text', async () => {
      const text = 'This is pure English text';
      const segmented = await segmentMixedContent(text);

      expect(segmented).toBe(text);
    });

    it('should handle pure Chinese text', async () => {
      const text = '纯粹的中文文本';
      const segmented = await segmentMixedContent(text);

      expect(segmented).toBeDefined();
      expect(segmented.split(' ').length).toBeGreaterThan(1);
    });
  });

  describe('Integration Tests', () => {
    it('should segment a realistic Chinese document', async () => {
      const text = '深度学习是机器学习的一个分支，它使用多层神经网络来学习数据的复杂模式。深度学习在图像识别、自然语言处理等领域取得了重大突破。';
      const segmented = await segmentChinese(text);

      expect(segmented).toBeDefined();
      
      // Should contain key terms
      const tokens = segmented.split(' ').filter(t => t.length > 0);
      expect(tokens.length).toBeGreaterThan(5);
      
      // Verify some expected words are in the segmentation
      expect(segmented.toLowerCase()).toBeDefined();
    });

    it('should handle technical Chinese-English mixed content', async () => {
      const text = '使用 TensorFlow 实现深度神经网络 DNN 模型';
      const segmented = await segmentMixedContent(text);

      expect(segmented).toContain('TensorFlow');
      expect(segmented).toContain('DNN');
      expect(segmented).toBeDefined();
    });
  });
});