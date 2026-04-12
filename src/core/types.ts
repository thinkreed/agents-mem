/**
 * @file src/core/types.ts
 * @description Core type definitions for agents-mem
 */

// ============================================================================
// URI Types
// ============================================================================

export interface MaterialURI {
  scheme: 'mem';
  userId: string;
  agentId?: string;
  teamId?: string;
  type: EntityType;
  id: string;
}

export function createURI(config: {
  userId: string;
  agentId?: string;
  teamId?: string;
  type: EntityType;
  id: string;
}): MaterialURI & { toString(): string } {
  const uri: MaterialURI = {
    scheme: 'mem',
    userId: config.userId,
    agentId: config.agentId,
    teamId: config.teamId,
    type: config.type,
    id: config.id,
  };
  
  return {
    ...uri,
    toString(): string {
      const agentPath = uri.agentId ?? '_';
      const teamPath = uri.teamId ?? '_';
      return `mem://${uri.userId}/${agentPath}/${teamPath}/${uri.type}/${uri.id}`;
    },
  };
}

// ============================================================================
// Scope Types
// ============================================================================

export interface Scope {
  userId: string;
  agentId?: string;
  teamId?: string;
  isGlobal?: boolean;
}

// ============================================================================
// Entity Types
// ============================================================================

export type EntityType = 
  | 'documents'
  | 'assets'
  | 'conversations'
  | 'messages'
  | 'facts'
  | 'tiered'
  | 'entity_nodes';

// ============================================================================
// Fact Types
// ============================================================================

export type FactType = 'preference' | 'decision' | 'observation' | 'conclusion';

export interface Fact {
  id: string;
  userId: string;
  agentId?: string;
  teamId?: string;
  isGlobal: boolean;
  sourceType: EntityType;
  sourceId: string;
  sourceUri?: string;
  content: string;
  factType: FactType;
  entities: string[];
  importance: number;
  confidence: number;
  verified: boolean;
  extractionMode?: 'async_batch' | 'on_demand' | 'realtime';
  extractedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Search Types
// ============================================================================

export interface HybridSearchResult {
  id: string;
  content: string;
  score: number;
  sourceType: EntityType;
  sourceId: string;
  originalUri?: string;
}

// ============================================================================
// Tiered Content Types
// ============================================================================

export interface TieredContent {
  id: string;
  userId: string;
  agentId?: string;
  teamId?: string;
  sourceType: EntityType;
  sourceId: string;
  abstract: string;       // L0: ~50-100 tokens
  overview?: string;      // L1: ~500-2000 tokens
  originalUri?: string;   // L2 reference
  importance: number;
  lanceIdL0?: string;
  lanceIdL1?: string;
  l0GeneratedAt?: number;
  l1GeneratedAt?: number;
  generationMode?: 'realtime' | 'async_batch' | 'on_demand';
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// User & Agent Types
// ============================================================================

export type UserRole = 'owner' | 'admin' | 'member' | 'guest';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

// ============================================================================
// Document Types
// ============================================================================

export type DocType = 'article' | 'note' | 'url' | 'file' | 'conversation';

export interface Document {
  id: string;
  userId: string;
  agentId?: string;
  teamId?: string;
  isGlobal: boolean;
  docType: DocType;
  sourceUrl?: string;
  sourcePath?: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  lanceId?: string;
  createdAt: number;
  updatedAt: number;
  contentLength: number;
  tokenCount?: number;
}