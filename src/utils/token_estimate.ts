/**
 * @file src/utils/token_estimate.ts
 * @description Token estimation utilities
 */

/**
 * Estimate tokens for text
 * English: ~4 chars per token
 * Chinese: ~1.5 chars per token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  // Detect CJK characters
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const nonCJKCount = text.length - cjkCount;
  
  // CJK: ~1.5 chars per token, non-CJK: ~4 chars per token
  return Math.ceil(cjkCount / 1.5 + nonCJKCount / 4);
}

/**
 * Truncate text to max tokens
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return '';
  
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return text;
  
  // Approximate truncation
  const maxChars = maxTokens * 3;
  if (text.length <= maxChars) return text;
  
  return text.slice(0, maxChars) + '...';
}

/**
 * Check if text is within token budget
 */
export function isWithinBudget(text: string, budget: number): boolean {
  return estimateTokens(text) <= budget;
}

/**
 * Count tokens for content object
 */
export function countContentTokens(content: Record<string, string | undefined | null>): number {
  let total = 0;
  for (const value of Object.values(content)) {
    if (value) {
      total += estimateTokens(value);
    }
  }
  return total;
}

/**
 * Format token count with k suffix for large numbers
 */
export function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(count);
}