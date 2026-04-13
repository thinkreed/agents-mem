/**
 * @file src/openviking/types.ts
 * @description OpenViking integration type definitions
 */

import type { Scope } from '../core/types';

/**
 * OpenViking configuration
 */
export interface OpenVikingConfig {
  /** Enable OpenViking integration */
  enabled: boolean;
  
  /** OpenViking HTTP server base URL */
  baseUrl: string;
  
  /** API key for authentication (optional for local deployment) */
  apiKey?: string;
  
  /** Account ID for multi-tenant isolation */
  account?: string;
  
  /** Default user context */
  defaultUser?: string;
  
  /** Request timeout in milliseconds */
  timeout: number;
  
  /** Maximum retries for failed requests */
  maxRetries: number;
  
  /** Embedding model configuration */
  embedding: {
    /** Embedding provider: 'vikingdb' | 'volcengine' | 'ollama' | 'openai' */
    provider: string;
    /** Model name: 'bge_large_zh' | 'doubao-embedding-vision-250615' | 'nomic-embed-text' */
    model: string;
    /** Vector dimension */
    dimension: number;
  };
  
  /** Rerank configuration */
  rerank?: {
    provider: string;
    model: string;
    threshold: number;
  };
}

/**
 * Default OpenViking configuration
 */
export const DEFAULT_OPENVIKING_CONFIG: OpenVikingConfig = {
  enabled: true,
  baseUrl: 'http://localhost:1933',
  timeout: 30000,
  maxRetries: 3,
  embedding: {
    provider: 'vikingdb',
    model: 'bge_large_zh',  // Matches Ollama bge-m3, 1024 dim
    dimension: 1024,
  },
};

/**
 * OpenViking resource types (maps to agents-mem EntityType)
 */
export type VikingResourceType = 'resources' | 'memories' | 'skills';

/**
 * Viking URI components
 */
export interface VikingURI {
  scheme: 'viking';
  /** Account context */
  account: string;
  /** User context */
  user: string;
  /** Agent context */
  agent?: string;
  /** Resource type */
  resourceType: VikingResourceType;
  /** Path segments */
  path: string[];
}

/**
 * OpenViking add resource parameters
 */
export interface AddResourceParams {
  /** Content to add (text, URL, or file path) */
  content: string;
  /** Target URI directory */
  targetUri: string;
  /** Reason/description for adding */
  reason: string;
  /** Wait for processing to complete */
  wait?: boolean;
  /** Content type hint */
  contentType?: 'text' | 'url' | 'file';
}

/**
 * OpenViking add resource result
 */
export interface AddResourceResult {
  /** Root URI of added resource */
  rootUri: string;
  /** Processing task ID */
  taskId?: string;
  /** Processing status */
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * OpenViking search parameters
 */
export interface SearchParams {
  /** Search query text */
  query: string;
  /** Target URI scope */
  targetUri?: string;
  /** Maximum results */
  limit?: number;
  /** Search mode: 'hybrid' | 'vector' | 'fts' */
  mode?: 'hybrid' | 'vector' | 'fts';
  /** Tier filter: 'L0' | 'L1' | 'L2' */
  tier?: 'L0' | 'L1' | 'L2';
  /** Scope filter */
  scope?: Scope;
}

/**
 * OpenViking matched context (search result)
 */
export interface MatchedContext {
  /** Viking URI */
  uri: string;
  /** Context type */
  contextType: 'memory' | 'resource' | 'skill';
  /** Is leaf (file vs directory) */
  isLeaf: boolean;
  /** L0 abstract */
  abstract: string;
  /** Relevance score */
  score: number;
}

/**
 * OpenViking find result
 */
export interface FindResult {
  /** Memory matches */
  memories: MatchedContext[];
  /** Resource matches */
  resources: MatchedContext[];
  /** Skill matches */
  skills: MatchedContext[];
  /** Total match count */
  total: number;
}

/**
 * OpenViking content read result
 */
export interface ContentResult {
  /** Full content (L2) */
  content: string;
  /** L0 abstract */
  abstract?: string;
  /** L1 overview */
  overview?: string;
  /** Content metadata */
  metadata?: {
    title?: string;
    path?: string;
    size?: number;
    createdAt?: number;
    updatedAt?: number;
  };
}

/**
 * OpenViking API error
 */
export interface VikingError {
  /** Error type */
  type: 'connection' | 'auth' | 'not_found' | 'invalid' | 'server' | 'timeout';
  /** Error message */
  message: string;
  /** HTTP status code */
  statusCode?: number;
  /** Original error */
  original?: Error;
}