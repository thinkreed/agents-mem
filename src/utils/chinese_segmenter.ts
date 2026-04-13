/**
 * @file src/utils/chinese_segmenter.ts
 * @description Chinese text segmentation using jieba-wasm for FTS indexing
 * 
 * LanceDB/Tantivy doesn't support Chinese word segmentation natively.
 * This module provides preprocessing to segment Chinese text before FTS indexing.
 */

import { cut } from 'jieba-wasm';

/**
 * Unicode ranges for CJK (Chinese, Japanese, Korean) characters
 * - U+4E00-U+9FFF: CJK Unified Ideographs (common Chinese characters)
 * - U+3400-U+4DBF: CJK Unified Ideographs Extension A
 * - U+3000-U+303F: CJK Symbols and Punctuation
 */
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f]/;

/**
 * Check if text contains Chinese/CJK characters
 * 
 * @param text - Text to check
 * @returns true if text contains CJK characters
 */
export function detectChineseContent(text: string): boolean {
  if (!text || text.length === 0) {
    return false;
  }
  return CJK_REGEX.test(text);
}

/**
 * Segment Chinese text into words using jieba
 * 
 * Uses jieba's accurate mode (cutAll=false) for precise word segmentation.
 * For pure English text, returns unchanged.
 * 
 * @param text - Chinese text to segment
 * @returns Space-separated segmented text
 */
export async function segmentChinese(text: string): Promise<string> {
  if (!text || text.length === 0) {
    return text;
  }

  // Skip segmentation if no Chinese content
  if (!detectChineseContent(text)) {
    return text;
  }

  // Use jieba cut (accurate mode: cutAll=false)
  // Returns array of tokens
  try {
    const tokens = cut(text, false);
    return tokens.join(' ');
  } catch {
    // If jieba fails, return original text
    console.error('jieba segmentation failed, returning original text');
    return text;
  }
}

/**
 * Segment mixed content - handles both Chinese and English
 * 
 * For mixed Chinese-English content:
 * - Chinese parts are segmented with jieba
 * - English parts are preserved unchanged
 * - Numbers are preserved
 * 
 * @param text - Mixed language content to segment
 * @returns Segmented text ready for FTS indexing
 */
export async function segmentMixedContent(text: string): Promise<string> {
  // Same logic as segmentChinese for now
  // jieba handles mixed content well - preserves English words
  return segmentChinese(text);
}

/**
 * Batch segment multiple texts
 * 
 * @param texts - Array of texts to segment
 * @returns Array of segmented texts
 */
export async function batchSegment(texts: string[]): Promise<string[]> {
  return Promise.all(texts.map(segmentChinese));
}

/**
 * Get segmentation statistics for debugging
 * 
 * @param original - Original text
 * @param segmented - Segmented text
 * @returns Statistics object
 */
export function getSegmentationStats(original: string, segmented: string): {
  originalLength: number;
  segmentedLength: number;
  tokenCount: number;
  hasChinese: boolean;
} {
  return {
    originalLength: original.length,
    segmentedLength: segmented.length,
    tokenCount: segmented.split(' ').filter(t => t.length > 0).length,
    hasChinese: detectChineseContent(original)
  };
}