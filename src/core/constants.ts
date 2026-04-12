/**
 * @file src/core/constants.ts
 * @description Core constants for agents-mem
 */

import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Embedding Configuration
// ============================================================================

export const EMBED_DIMENSION = 768;
export const DEFAULT_EMBED_MODEL = 'nomic-embed-text';

// ============================================================================
// Tiered Content Configuration
// ============================================================================

export const L0_TOKEN_BUDGET = 100;
export const L1_TOKEN_BUDGET = 2000;

// ============================================================================
// Entity Tree Thresholds
// ============================================================================

export const BASE_THRESHOLD = 0.7;  // θ₀
export const DEPTH_FACTOR = 0.1;    // λ

/**
 * Calculate threshold for given depth
 * θ(d) = θ₀ × e^(λd)
 */
export function calculateThreshold(depth: number): number {
  return BASE_THRESHOLD * Math.exp(DEPTH_FACTOR * depth);
}

// ============================================================================
// Storage Paths
// ============================================================================

export const URI_SCHEME = 'mem';

export const SQLITE_DB_NAME = 'agents_mem.db';
export const SQLITE_WAL_MODE = true;

export function getStoragePath(customBase?: string): string {
  const base = customBase ?? os.homedir();
  return path.join(base, '.agents_mem');
}

export function getLanceDBPath(customBase?: string): string {
  return path.join(getStoragePath(customBase), 'vectors');
}

// ============================================================================
// Concurrency Settings
// ============================================================================

export const MAX_EMBED_CONCURRENT = 10;
export const MAX_LLM_CONCURRENT = 10;

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_IMPORTANCE = 0.5;
export const DEFAULT_CONFIDENCE = 0.8;
export const DEFAULT_SEARCH_LIMIT = 10;