/**
 * @file src/lance/schema.ts
 * @description LanceDB schema definitions using Apache Arrow format
 */

import { Schema, Field, Utf8, Float64, Bool, FixedSizeList, Float32, Int64 } from 'apache-arrow';
import { EMBED_DIMENSION } from '../core/constants';

// Re-export EMBED_DIMENSION for external use
export { EMBED_DIMENSION };

// ============================================================================
// Helper Functions for Arrow Schema Creation
// ============================================================================

/**
 * Create a string field (Utf8)
 */
function stringField(name: string, nullable: boolean = true): Field<Utf8> {
  return new Field(name, new Utf8(), nullable);
}

/**
 * Create a number field (Float64 for general numbers, Int64 for timestamps)
 */
function numberField(name: string, nullable: boolean = true): Field<Float64> {
  return new Field(name, new Float64(), nullable);
}

/**
 * Create a timestamp field (Int64)
 */
function timestampField(name: string, nullable: boolean = true): Field<Int64> {
  return new Field(name, new Int64(), nullable);
}

/**
 * Create a boolean field
 */
function booleanField(name: string, nullable: boolean = true): Field<Bool> {
  return new Field(name, new Bool(), nullable);
}

/**
 * Create a vector field (FixedSizeList of Float32)
 */
function vectorField(name: string, dimension: number, nullable: boolean = true): Field<FixedSizeList<Float32>> {
  return new Field(name, new FixedSizeList(dimension, new Field('item', new Float32())), nullable);
}

// ============================================================================
// Documents Vector Schema
// ============================================================================

/**
 * Documents vector table schema for LanceDB
 * Stores document embeddings with metadata
 */
export function createDocumentsVecSchema(): Schema {
  return new Schema([
    stringField('id', false),           // Primary key
    stringField('content', false),      // Document content
    vectorField('vector', EMBED_DIMENSION, false), // Embedding vector
    stringField('title'),
    stringField('user_id'),
    stringField('agent_id'),
    stringField('team_id'),
    booleanField('is_global'),
    stringField('topic'),
    stringField('entity'),
    stringField('category'),
    numberField('importance'),
    timestampField('created_at')
  ]);
}

// ============================================================================
// Messages Vector Schema
// ============================================================================

/**
 * Messages vector table schema for LanceDB
 * Stores conversation message embeddings
 */
export function createMessagesVecSchema(): Schema {
  return new Schema([
    stringField('id', false),           // Primary key
    stringField('content', false),      // Message content
    vectorField('vector', EMBED_DIMENSION, false), // Embedding vector
    stringField('user_id'),
    stringField('agent_id'),
    stringField('team_id'),
    stringField('conversation_id'),
    stringField('role'),
    timestampField('timestamp')
  ]);
}

// ============================================================================
// Facts Vector Schema
// ============================================================================

/**
 * Facts vector table schema for LanceDB
 * Stores extracted fact embeddings
 */
export function createFactsVecSchema(): Schema {
  return new Schema([
    stringField('id', false),           // Primary key
    stringField('content', false),      // Fact content
    vectorField('vector', EMBED_DIMENSION, false), // Embedding vector
    stringField('user_id'),
    stringField('agent_id'),
    stringField('team_id'),
    booleanField('is_global'),
    stringField('fact_type'),
    numberField('importance'),
    numberField('confidence'),
    stringField('source_type'),
    stringField('source_id')
  ]);
}

// ============================================================================
// Tiered Vector Schema
// ============================================================================

/**
 * Tiered vector table schema for LanceDB
 * Stores tiered content embeddings (L0, L1, etc.)
 */
export function createTieredVecSchema(): Schema {
  return new Schema([
    stringField('id', false),           // Primary key
    stringField('content', false),      // Content
    vectorField('vector', EMBED_DIMENSION, false), // Embedding vector
    numberField('tier', false),         // Tier level (0, 1, etc.)
    stringField('user_id'),
    stringField('agent_id'),
    stringField('team_id'),
    stringField('source_type'),
    stringField('source_id'),
    stringField('original_uri')
  ]);
}

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Get schema by table name
 */
export function getSchemaForTable(tableName: string): Schema | null {
  switch (tableName) {
    case 'documents':
      return createDocumentsVecSchema();
    case 'messages':
      return createMessagesVecSchema();
    case 'facts':
      return createFactsVecSchema();
    case 'tiered':
      return createTieredVecSchema();
    default:
      return null;
  }
}

/**
 * Get all table schemas
 */
export function getTableSchemas(): Record<string, Schema> {
  return {
    documents: createDocumentsVecSchema(),
    messages: createMessagesVecSchema(),
    facts: createFactsVecSchema(),
    tiered: createTieredVecSchema()
  };
}

// ============================================================================
// Legacy Interface Types (for backwards compatibility)
// ============================================================================

/**
 * LanceDB field type (legacy interface, kept for type hints)
 */
export interface LanceField {
  type: 'string' | 'number' | 'boolean' | 'vector';
  dimension?: number;
}

/**
 * LanceDB schema definition (legacy interface)
 */
export interface LanceSchema {
  [fieldName: string]: LanceField;
}

// ============================================================================
// Schema Validation Helpers
// ============================================================================

/**
 * Get field names from Arrow schema
 */
export function getSchemaFields(schema: Schema): string[] {
  return schema.fields.map(f => f.name);
}

/**
 * Get vector field name
 */
export function getVectorFieldName(): string {
  return 'vector';
}

/**
 * Check if schema has required fields
 */
export function schemaHasFields(schema: Schema, requiredFields: string[]): boolean {
  const fieldNames = getSchemaFields(schema);
  return requiredFields.every(name => fieldNames.includes(name));
}