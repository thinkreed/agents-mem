/**
 * @file tests/lance/schema_suffix.test.ts
 * @description Schema suffix naming tests (TDD RED phase)
 * 
 * Tests verify that getSchemaForTable handles _vec suffix correctly.
 * These tests will FAIL until the feature is implemented.
 */

import { describe, it, expect } from 'vitest';
import { Schema } from 'apache-arrow';
import { getSchemaForTable } from '../../src/lance/schema';

describe('LanceDB Schema Suffix', () => {
  describe('getSchemaForTable with _vec suffix', () => {
    it('should return valid schema for documents (base table)', () => {
      const schema = getSchemaForTable('documents');
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should return SAME schema for documents_vec as documents', () => {
      const baseSchema = getSchemaForTable('documents');
      const suffixSchema = getSchemaForTable('documents_vec');
      
      expect(suffixSchema).toBeDefined();
      expect(suffixSchema).toBeInstanceOf(Schema);
      
      // Schemas should be identical
      expect(suffixSchema?.fields.length).toBe(baseSchema?.fields.length);
      const baseFields = baseSchema?.fields.map(f => f.name).sort();
      const suffixFields = suffixSchema?.fields.map(f => f.name).sort();
      expect(suffixFields).toEqual(baseFields);
    });

    it('should return schema for messages_vec', () => {
      const schema = getSchemaForTable('messages_vec');
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
      
      // Should match messages schema
      const baseSchema = getSchemaForTable('messages');
      expect(schema?.fields.length).toBe(baseSchema?.fields.length);
    });

    it('should return schema for facts_vec', () => {
      const schema = getSchemaForTable('facts_vec');
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
      
      // Should match facts schema
      const baseSchema = getSchemaForTable('facts');
      expect(schema?.fields.length).toBe(baseSchema?.fields.length);
    });

    it('should return schema for assets_vec', () => {
      const schema = getSchemaForTable('assets_vec');
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
      
      // Should match assets schema
      const baseSchema = getSchemaForTable('assets');
      expect(schema?.fields.length).toBe(baseSchema?.fields.length);
    });

    it('should return schema for tiered_vec', () => {
      const schema = getSchemaForTable('tiered_vec');
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
      
      // Should match tiered schema
      const baseSchema = getSchemaForTable('tiered');
      expect(schema?.fields.length).toBe(baseSchema?.fields.length);
    });

    it('should return null for unknown table', () => {
      expect(getSchemaForTable('unknown')).toBeNull();
    });

    it('should return identical schema fields for _vec suffix vs base', () => {
      const tableNames = ['documents', 'messages', 'facts', 'tiered'];
      
      for (const tableName of tableNames) {
        const baseSchema = getSchemaForTable(tableName);
        const vecSchema = getSchemaForTable(`${tableName}_vec`);
        
        expect(vecSchema).toBeDefined();
        
        // Compare all field names
        const baseFieldNames = baseSchema?.fields.map(f => f.name).sort();
        const vecFieldNames = vecSchema?.fields.map(f => f.name).sort();
        expect(vecFieldNames).toEqual(baseFieldNames);
      }
    });
  });
});