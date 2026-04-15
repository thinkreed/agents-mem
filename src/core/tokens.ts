/**
 * @file src/core/tokens.ts
 * @description Dependency injection tokens for tsyringe
 */

/**
 * Service tokens for @inject() decorator
 */
export const TOKENS = {
  // Infrastructure layer
  DatabaseConnection: 'DatabaseConnection',
  OpenVikingClient: 'OpenVikingClient',
  Embedder: 'Embedder',
  LLMClient: 'LLMClient',

  // Service layer
  TieredGenerator: 'TieredGenerator',
  FactExtractor: 'FactExtractor',
  URIAdapter: 'URIAdapter',
  ScopeMapper: 'ScopeMapper',

  // Cross-cutting concerns
  AuditLogger: 'AuditLogger',
  LogBuffer: 'LogBuffer',
} as const;

/**
 * Token type for type-safe injection
 */
export type TokenKey = typeof TOKENS[keyof typeof TOKENS];
