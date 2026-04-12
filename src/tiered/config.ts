/**
 * @file src/tiered/config.ts
 * @description Tiered content configuration
 */

import { L0_TOKEN_BUDGET, L1_TOKEN_BUDGET } from '../core/constants';

/**
 * Tiered configuration
 */
export interface TieredConfig {
  l0TokenBudget: number;
  l1TokenBudget: number;
  l0MaxLength: number;
  l1MaxLength: number;
}

/**
 * Default tiered config
 */
export const DEFAULT_TIERED_CONFIG: TieredConfig = {
  l0TokenBudget: L0_TOKEN_BUDGET,
  l1TokenBudget: L1_TOKEN_BUDGET,
  l0MaxLength: 500,
  l1MaxLength: 8000
};

/**
 * Get tiered config
 */
export function getTieredConfig(): TieredConfig {
  return DEFAULT_TIERED_CONFIG;
}

/**
 * Calculate max length for tier
 */
export function getMaxLengthForTier(tier: number): number {
  if (tier === 0) {
    return DEFAULT_TIERED_CONFIG.l0MaxLength;
  } else if (tier === 1) {
    return DEFAULT_TIERED_CONFIG.l1MaxLength;
  }
  return Infinity; // L2 = full content
}