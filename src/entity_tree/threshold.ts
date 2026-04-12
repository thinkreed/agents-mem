/**
 * @file src/entity_tree/threshold.ts
 * @description Entity tree threshold calculations
 */

import { calculateThreshold, BASE_THRESHOLD, DEPTH_FACTOR } from '../core/constants';

/**
 * Get threshold for depth
 */
export function getThresholdForDepth(depth: number): number {
  return calculateThreshold(depth);
}

/**
 * Check if similarity meets threshold
 */
export function meetsThreshold(similarity: number, depth: number): boolean {
  return similarity >= getThresholdForDepth(depth);
}

/**
 * Calculate merge threshold for parent-child
 */
export function getMergeThreshold(parentDepth: number, childSimilarity: number): boolean {
  const childDepth = parentDepth + 1;
  const threshold = getThresholdForDepth(childDepth);
  
  return childSimilarity >= threshold;
}

/**
 * Threshold configuration
 */
export interface ThresholdConfig {
  baseThreshold: number;
  depthFactor: number;
}

/**
 * Get threshold config
 */
export function getThresholdConfig(): ThresholdConfig {
  return {
    baseThreshold: BASE_THRESHOLD,
    depthFactor: DEPTH_FACTOR
  };
}