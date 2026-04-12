/**
 * @file tests/utils/uuid.test.ts
 * @description Test suite for UUID generation utilities
 */

import { describe, it, expect } from 'vitest';

describe('UUID Utilities', () => {
  describe('generateUUID', () => {
    it('should generate valid UUID v4 format', async () => {
      const { generateUUID } = await import('../../src/utils/uuid.js');
      
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      
      expect(uuid).toMatch(uuidRegex);
    });

    it('should generate unique UUIDs', async () => {
      const { generateUUID } = await import('../../src/utils/uuid.js');
      
      const uuids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      
      expect(uuids.size).toBe(100);
    });

    it('should return string type', async () => {
      const { generateUUID } = await import('../../src/utils/uuid.js');
      
      const uuid = generateUUID();
      
      expect(typeof uuid).toBe('string');
    });

    it('should have correct length (36 characters with hyphens)', async () => {
      const { generateUUID } = await import('../../src/utils/uuid.js');
      
      const uuid = generateUUID();
      
      expect(uuid.length).toBe(36);
    });
  });

  describe('generateShortId', () => {
    it('should generate short ID with specified length', async () => {
      const { generateShortId } = await import('../../src/utils/uuid.js');
      
      const shortId = generateShortId(8);
      
      expect(shortId.length).toBe(8);
    });

    it('should generate alphanumeric short ID', async () => {
      const { generateShortId } = await import('../../src/utils/uuid.js');
      
      const shortId = generateShortId(16);
      
      expect(shortId).toMatch(/[a-z0-9]+/);
    });

    it('should generate unique short IDs', async () => {
      const { generateShortId } = await import('../../src/utils/uuid.js');
      
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateShortId(12));
      }
      
      expect(ids.size).toBe(100);
    });

    it('should default to 8 characters if no length specified', async () => {
      const { generateShortId } = await import('../../src/utils/uuid.js');
      
      const shortId = generateShortId();
      
      expect(shortId.length).toBe(8);
    });
  });

  describe('validateUUID', () => {
    it('should validate correct UUID format', async () => {
      const { validateUUID, generateUUID } = await import('../../src/utils/uuid.js');
      
      const uuid = generateUUID();
      
      expect(validateUUID(uuid)).toBe(true);
    });

    it('should reject invalid UUID format', async () => {
      const { validateUUID } = await import('../../src/utils/uuid.js');
      
      expect(validateUUID('invalid-uuid')).toBe(false);
      expect(validateUUID('12345')).toBe(false);
      expect(validateUUID('')).toBe(false);
    });

    it('should reject UUID with wrong version', async () => {
      const { validateUUID } = await import('../../src/utils/uuid.js');
      
      const v1Uuid = '123e4567-e89b-12d3-a456-426614174000';
      
      expect(validateUUID(v1Uuid)).toBe(false);
    });
  });

  describe('isUUID', () => {
    it('should return true for valid UUID', async () => {
      const { isUUID, generateUUID } = await import('../../src/utils/uuid.js');
      
      const uuid = generateUUID();
      
      expect(isUUID(uuid)).toBe(true);
    });

    it('should return false for invalid UUID', async () => {
      const { isUUID } = await import('../../src/utils/uuid.js');
      
      expect(isUUID('not-a-uuid')).toBe(false);
      expect(isUUID(null)).toBe(false);
      expect(isUUID(undefined)).toBe(false);
      expect(isUUID(123)).toBe(false);
    });
  });
});