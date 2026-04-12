/**
 * @file tests/lance/schema.test.ts
 * @description LanceDB schema tests (TDD)
 */

import { describe, it, expect } from 'vitest';
import { Schema, FixedSizeList } from 'apache-arrow';
import {
  EMBED_DIMENSION,
  createDocumentsVecSchema,
  createMessagesVecSchema,
  createFactsVecSchema,
  createTieredVecSchema,
  getTableSchemas,
  getSchemaForTable,
  getSchemaFields,
  schemaHasFields,
  getVectorFieldName
} from '../../src/lance/schema';

describe('LanceDB Schema', () => {
  describe('Embedding Dimension', () => {
    it('should define EMBED_DIMENSION as 768', () => {
      expect(EMBED_DIMENSION).toBe(768);
    });
  });

  describe('createDocumentsVecSchema', () => {
    it('should return Arrow Schema', () => {
      const schema = createDocumentsVecSchema();
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should have required fields', () => {
      const schema = createDocumentsVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('id');
      expect(fields).toContain('content');
      expect(fields).toContain('vector');
      expect(fields).toContain('user_id');
    });

    it('should have vector field with dimension 768', () => {
      const schema = createDocumentsVecSchema();
      const vectorField = schema.fields.find(f => f.name === 'vector');
      
      expect(vectorField).toBeDefined();
      expect(vectorField?.type).toBeInstanceOf(FixedSizeList);
      // Check dimension - FixedSizeList has listSize property
      const vectorType = vectorField?.type as FixedSizeList;
      expect(vectorType.listSize).toBe(768);
    });

    it('should have scope fields', () => {
      const schema = createDocumentsVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('user_id');
      expect(fields).toContain('agent_id');
      expect(fields).toContain('team_id');
      expect(fields).toContain('is_global');
    });
  });

  describe('createMessagesVecSchema', () => {
    it('should return Arrow Schema', () => {
      const schema = createMessagesVecSchema();
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should have conversation_id', () => {
      const schema = createMessagesVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('conversation_id');
    });

    it('should have role field', () => {
      const schema = createMessagesVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('role');
    });

    it('should have timestamp', () => {
      const schema = createMessagesVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('timestamp');
    });
  });

  describe('createFactsVecSchema', () => {
    it('should return Arrow Schema', () => {
      const schema = createFactsVecSchema();
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should have fact_type field', () => {
      const schema = createFactsVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('fact_type');
    });

    it('should have confidence field', () => {
      const schema = createFactsVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('confidence');
    });

    it('should have source fields', () => {
      const schema = createFactsVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('source_type');
      expect(fields).toContain('source_id');
    });
  });

  describe('createTieredVecSchema', () => {
    it('should return Arrow Schema', () => {
      const schema = createTieredVecSchema();
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should have tier field', () => {
      const schema = createTieredVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('tier');
    });

    it('should have original_uri field', () => {
      const schema = createTieredVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(fields).toContain('original_uri');
    });
  });

  describe('getTableSchemas', () => {
    it('should return all schemas as Arrow Schemas', () => {
      const schemas = getTableSchemas();
      
      expect(schemas.documents).toBeDefined();
      expect(schemas.documents).toBeInstanceOf(Schema);
      expect(schemas.messages).toBeDefined();
      expect(schemas.messages).toBeInstanceOf(Schema);
      expect(schemas.facts).toBeDefined();
      expect(schemas.facts).toBeInstanceOf(Schema);
      expect(schemas.tiered).toBeDefined();
      expect(schemas.tiered).toBeInstanceOf(Schema);
    });
  });

  describe('getSchemaForTable', () => {
    it('should return schema for documents', () => {
      const schema = getSchemaForTable('documents');
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should return schema for messages', () => {
      const schema = getSchemaForTable('messages');
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should return schema for facts', () => {
      const schema = getSchemaForTable('facts');
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should return schema for tiered', () => {
      const schema = getSchemaForTable('tiered');
      expect(schema).toBeDefined();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should return null for invalid table name', () => {
      const schema = getSchemaForTable('invalid');
      expect(schema).toBeNull();
    });
  });

  describe('getVectorFieldName', () => {
    it('should return vector', () => {
      expect(getVectorFieldName()).toBe('vector');
    });
  });

  describe('schemaHasFields', () => {
    it('should return true when all fields exist', () => {
      const schema = createDocumentsVecSchema();
      expect(schemaHasFields(schema, ['id', 'content', 'vector', 'user_id'])).toBe(true);
    });

    it('should return false for missing fields', () => {
      const schema = createDocumentsVecSchema();
      expect(schemaHasFields(schema, ['missing_field'])).toBe(false);
    });
  });

  describe('getSchemaFields', () => {
    it('should return array of field names', () => {
      const schema = createDocumentsVecSchema();
      const fields = getSchemaFields(schema);
      
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });
  });
});