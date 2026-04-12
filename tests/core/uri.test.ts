/**
 * @file tests/core/uri.test.ts
 * @description URI parsing and building tests (TDD)
 */

import { describe, it, expect } from 'vitest';
import {
  parseURI,
  buildURI,
  validateURI,
  isURI,
  URI_FORMAT,
  extractURIComponents
} from '../../src/core/uri';
import { EntityType } from '../../src/core/types';

describe('URI Utilities', () => {
  describe('URI_FORMAT', () => {
    it('should define URI format regex', () => {
      expect(URI_FORMAT).toBeDefined();
      expect(URI_FORMAT.test('mem://user123/_/_/documents/doc-456')).toBe(true);
      expect(URI_FORMAT.test('mem://user123/agent1/_/facts/fact-789')).toBe(true);
      expect(URI_FORMAT.test('mem://user123/_/team5/tiered/tiered-abc')).toBe(true);
    });

    it('should reject invalid URIs', () => {
      expect(URI_FORMAT.test('http://user123/documents/doc')).toBe(false);
      expect(URI_FORMAT.test('mem://invalid')).toBe(false);
      expect(URI_FORMAT.test('')).toBe(false);
    });
  });

  describe('buildURI', () => {
    it('should build URI with all components', () => {
      const uri = buildURI({
        userId: 'user123',
        agentId: 'agent1',
        teamId: 'team5',
        type: 'documents',
        id: 'doc-456'
      });
      
      expect(uri).toBe('mem://user123/agent1/team5/documents/doc-456');
    });

    it('should build URI without agentId', () => {
      const uri = buildURI({
        userId: 'user123',
        type: 'documents',
        id: 'doc-456'
      });
      
      expect(uri).toBe('mem://user123/_/_/documents/doc-456');
    });

    it('should build URI without teamId', () => {
      const uri = buildURI({
        userId: 'user123',
        agentId: 'agent1',
        type: 'facts',
        id: 'fact-789'
      });
      
      expect(uri).toBe('mem://user123/agent1/_/facts/fact-789');
    });

    it('should build URI with only userId', () => {
      const uri = buildURI({
        userId: 'user123',
        type: 'tiered',
        id: 'tiered-abc'
      });
      
      expect(uri).toBe('mem://user123/_/_/tiered/tiered-abc');
    });

    it('should handle all entity types', () => {
      const types: EntityType[] = ['documents', 'assets', 'conversations', 'messages', 'facts', 'tiered', 'entity_nodes'];
      
      for (const type of types) {
        const uri = buildURI({
          userId: 'user123',
          type,
          id: 'test-id'
        });
        
        expect(uri).toContain(type);
        expect(validateURI(uri)).toBe(true);
      }
    });
  });

  describe('parseURI', () => {
    it('should parse full URI', () => {
      const result = parseURI('mem://user123/agent1/team5/documents/doc-456');
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user123');
      expect(result?.agentId).toBe('agent1');
      expect(result?.teamId).toBe('team5');
      expect(result?.type).toBe('documents');
      expect(result?.id).toBe('doc-456');
    });

    it('should parse URI with placeholders', () => {
      const result = parseURI('mem://user123/_/_/facts/fact-789');
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user123');
      expect(result?.agentId).toBeUndefined();
      expect(result?.teamId).toBeUndefined();
      expect(result?.type).toBe('facts');
      expect(result?.id).toBe('fact-789');
    });

    it('should parse URI with only agentId', () => {
      const result = parseURI('mem://user123/agent1/_/messages/msg-123');
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user123');
      expect(result?.agentId).toBe('agent1');
      expect(result?.teamId).toBeUndefined();
      expect(result?.type).toBe('messages');
    });

    it('should parse URI with only teamId', () => {
      const result = parseURI('mem://user123/_/team5/documents/doc-456');
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user123');
      expect(result?.agentId).toBeUndefined();
      expect(result?.teamId).toBe('team5');
    });

    it('should return null for invalid URI', () => {
      expect(parseURI('invalid-uri')).toBeNull();
      expect(parseURI('http://user/documents/doc')).toBeNull();
      expect(parseURI('')).toBeNull();
    });
  });

  describe('validateURI', () => {
    it('should return true for valid URIs', () => {
      expect(validateURI('mem://user123/_/_/documents/doc-456')).toBe(true);
      expect(validateURI('mem://user123/agent1/team5/facts/fact-789')).toBe(true);
    });

    it('should return false for invalid URIs', () => {
      expect(validateURI('invalid')).toBe(false);
      expect(validateURI('mem://')).toBe(false);
      expect(validateURI('http://user/documents')).toBe(false);
    });
  });

  describe('isURI', () => {
    it('should return true for valid URI string', () => {
      expect(isURI('mem://user123/_/_/documents/doc-456')).toBe(true);
    });

    it('should return false for non-string', () => {
      expect(isURI(null)).toBe(false);
      expect(isURI(undefined)).toBe(false);
      expect(isURI(123)).toBe(false);
      expect(isURI({})).toBe(false);
    });

    it('should return false for invalid string', () => {
      expect(isURI('')).toBe(false);
      expect(isURI('not-a-uri')).toBe(false);
    });
  });

  describe('extractURIComponents', () => {
    it('should extract components from valid URI', () => {
      const components = extractURIComponents('mem://user123/agent1/team5/documents/doc-456');
      
      expect(components).not.toBeNull();
      expect(components?.userId).toBe('user123');
      expect(components?.agentId).toBe('agent1');
      expect(components?.teamId).toBe('team5');
      expect(components?.type).toBe('documents');
      expect(components?.id).toBe('doc-456');
    });

    it('should return null for invalid URI', () => {
      expect(extractURIComponents('invalid')).toBeNull();
    });
  });

  describe('URI round-trip', () => {
    it('should preserve URI through build and parse', () => {
      const original = {
        userId: 'user123',
        agentId: 'agent1',
        teamId: 'team5',
        type: 'documents' as EntityType,
        id: 'doc-456'
      };
      
      const uriString = buildURI(original);
      const parsed = parseURI(uriString);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.userId).toBe(original.userId);
      expect(parsed?.agentId).toBe(original.agentId);
      expect(parsed?.teamId).toBe(original.teamId);
      expect(parsed?.type).toBe(original.type);
      expect(parsed?.id).toBe(original.id);
    });

    it('should handle placeholder round-trip', () => {
      const original = {
        userId: 'user123',
        type: 'facts' as EntityType,
        id: 'fact-789'
      };
      
      const uriString = buildURI(original);
      const parsed = parseURI(uriString);
      
      expect(parsed?.userId).toBe(original.userId);
      expect(parsed?.agentId).toBeUndefined();
      expect(parsed?.teamId).toBeUndefined();
      expect(parsed?.type).toBe(original.type);
      expect(parsed?.id).toBe(original.id);
    });
  });
});