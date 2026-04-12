/**
 * @file tests/entity_tree/threshold.test.ts
 * @description Entity tree threshold tests
 */

import { describe, it, expect } from 'vitest';
import {
  getThresholdForDepth,
  meetsThreshold,
  getMergeThreshold,
  getThresholdConfig
} from '../../src/entity_tree/threshold';
import { BASE_THRESHOLD, DEPTH_FACTOR, calculateThreshold } from '../../src/core/constants';

describe('Entity Tree Threshold', () => {

  describe('getThresholdForDepth', () => {
    it('should return base threshold for depth 0', () => {
      expect(getThresholdForDepth(0)).toBeCloseTo(0.7, 4);
    });

    it('should return correct threshold for depth 1', () => {
      expect(getThresholdForDepth(1)).toBeCloseTo(0.7735, 2);
    });

    it('should return correct threshold for depth 2', () => {
      expect(getThresholdForDepth(2)).toBeCloseTo(0.855, 2);
    });

    it('should increase threshold with depth', () => {
      const threshold0 = getThresholdForDepth(0);
      const threshold1 = getThresholdForDepth(1);
      const threshold2 = getThresholdForDepth(2);
      
      expect(threshold1).toBeGreaterThan(threshold0);
      expect(threshold2).toBeGreaterThan(threshold1);
    });

    it('should match calculateThreshold function', () => {
      expect(getThresholdForDepth(0)).toBeCloseTo(calculateThreshold(0), 4);
      expect(getThresholdForDepth(1)).toBeCloseTo(calculateThreshold(1), 4);
      expect(getThresholdForDepth(2)).toBeCloseTo(calculateThreshold(2), 4);
    });
  });

  describe('meetsThreshold', () => {
    it('should return true when similarity equals threshold at depth 0', () => {
      expect(meetsThreshold(0.7, 0)).toBe(true);
    });

    it('should return true when similarity exceeds threshold at depth 0', () => {
      expect(meetsThreshold(0.8, 0)).toBe(true);
    });

    it('should return false when similarity is below threshold at depth 0', () => {
      expect(meetsThreshold(0.69, 0)).toBe(false);
    });

    it('should return true when similarity exceeds threshold at depth 1', () => {
      expect(meetsThreshold(0.8, 1)).toBe(true);
    });

    it('should return false when similarity is below threshold at depth 1', () => {
      expect(meetsThreshold(0.77, 1)).toBe(false);
    });
  });

  describe('getMergeThreshold', () => {
    it('should return false when child similarity below threshold', () => {
      expect(getMergeThreshold(0, 0.7)).toBe(false);
    });

    it('should return true when child similarity meets threshold', () => {
      expect(getMergeThreshold(0, 0.78)).toBe(true);
    });

    it('should calculate child depth as parentDepth + 1', () => {
      const childThreshold = getThresholdForDepth(3);
      expect(getMergeThreshold(2, childThreshold)).toBe(true);
    });
  });

  describe('getThresholdConfig', () => {
    it('should return threshold config', () => {
      const config = getThresholdConfig();
      
      expect(config).toBeDefined();
      expect(config.baseThreshold).toBe(BASE_THRESHOLD);
      expect(config.depthFactor).toBe(DEPTH_FACTOR);
    });

    it('should have correct base threshold', () => {
      const config = getThresholdConfig();
      expect(config.baseThreshold).toBe(0.7);
    });

    it('should have correct depth factor', () => {
      const config = getThresholdConfig();
      expect(config.depthFactor).toBe(0.1);
    });
  });
});