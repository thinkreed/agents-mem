/**
 * @file src/utils/uuid.ts
 * @description UUID generation utilities
 */

import { randomBytes } from 'crypto';

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  const bytes = randomBytes(16);
  
  // Set version to 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant to RFC 4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Generate short alphanumeric ID
 */
export function generateShortId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Validate UUID format (v4)
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  return uuidRegex.test(uuid);
}

/**
 * Type guard for UUID
 */
export function isUUID(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return validateUUID(value);
}