/**
 * @file tests/tiered/config.test.ts
 */

import { describe, it, expect } from 'vitest';
import { getTieredConfig, getMaxLengthForTier, TieredConfig } from '../../src/tiered/config';

describe('Tiered Config', () => {
  it('should return config', () => {
    const config = getTieredConfig();
    expect(config.l0TokenBudget).toBe(100);
    expect(config.l1TokenBudget).toBe(2000);
  });

  it('should get max length for tier', () => {
    expect(getMaxLengthForTier(0)).toBe(500);
    expect(getMaxLengthForTier(1)).toBe(8000);
    expect(getMaxLengthForTier(2)).toBe(Infinity);
  });
});