/**
 * @file src/core/interfaces.ts
 * @description Service interfaces for dependency injection
 */

import type { Database } from 'bun:sqlite';

/**
 * Database connection interface
 */
export interface IDatabaseConnection {
  isOpen(): boolean;
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  query<T>(sql: string, params?: unknown[]): T[];
  queryOne<T>(sql: string, params?: unknown[]): T | undefined;
  transaction(fn: () => void): void;
  close(): void;
  prepare(sql: string): { run: (...args: unknown[]) => { changes: number; lastInsertRowid: number | bigint }; all: (...args: unknown[]) => unknown[]; get: (...args: unknown[]) => unknown | undefined };
  getRaw(): Database;
  clearCache(): void;
}

/**
 * OpenViking HTTP client interface
 */
export interface IOpenVikingClient {
  healthCheck(): Promise<{ status: 'ok' | 'error'; message?: string }>;
  addResource(params: AddResourceParams): Promise<AddResourceResult>;
  find(params: SearchParams): Promise<FindResult>;
  getAbstract(uri: string): Promise<string>;
  getOverview(uri: string): Promise<string>;
  read(uri: string): Promise<ContentResult>;
  write(uri: string, content: string): Promise<{ success: boolean }>;
  delete(uri: string): Promise<{ success: boolean }>;
  ls(uri: string): Promise<{ uri: string; name: string; isDir: boolean }[]>;
  uploadMultimodal(data: ArrayBuffer, mimeType: string, targetUri: string): Promise<{ uri: string; taskId?: string }>;
  getTask(taskId: string): Promise<{ status: string; result?: Record<string, unknown>; error?: string }>;
}

/**
 * Embedder interface
 */
export interface IEmbedder {
  getEmbedding(text: string): Promise<Float32Array>;
  getEmbeddings(texts: string[]): Promise<Float32Array[]>;
  getModel(): string;
  getDimension(): number;
}

/**
 * LLM client interface
 */
export interface ILLMClient {
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  generateJSON<T>(prompt: string, fallback: T): Promise<T>;
  getModel(): string;
  getURL(): string;
  getMaxRetries(): number;
  getTimeout(): number;
}

/**
 * Tiered content generator interface
 */
export interface ITieredGenerator {
  generateL0(content: string): Promise<string>;
  generateL1(content: string): Promise<string>;
  generateBoth(content: string): Promise<{ abstract: string; overview: string }>;
}

/**
 * Fact extractor interface
 */
export interface IFactExtractor {
  extract(content: string): Promise<ExtractedFact[]>;
  extractAndSave(input: { userId: string; sourceType: string; sourceId: string; content: string }): Promise<string[]>;
}

/**
 * URI adapter interface
 */
export interface IURIAdapter {
  toVikingURI(memURI: string, scope: Record<string, unknown>, account?: string): string;
  toMemURI(vikingURI: string, scope: Record<string, unknown>): string;
  extractIdFromVikingURI(vikingURI: string): string;
  buildTargetUri(scope: Record<string, unknown>, entityType: string, account?: string): string;
}

/**
 * Scope mapper interface
 */
export interface IScopeMapper {
  mapToVikingScope(scope: Record<string, unknown>): { account: string; user: string; agent?: string };
  mapToVikingTarget(scope: Record<string, unknown>): string;
  buildTargetForType(scope: Record<string, unknown>, resourceType: string): string;
  mapToOpenVikingHeaders(scope: Record<string, unknown>): Record<string, string>;
  extractScopeFromUri(vikingUri: string): Partial<Record<string, unknown>>;
  validateScope(scope: Record<string, unknown>): { valid: boolean; errors: string[] };
}

/**
 * Audit logger interface
 */
export interface IAuditLogger {
  log(entry: AuditLogInput): void;
}

/**
 * Log buffer interface
 */
export interface ILogBuffer {
  enqueue(entry: LogEntry): void;
  flush(): Promise<FlushResult>;
  getStats(): LogBufferStats;
  startFlushTimer(): void;
  stopFlushTimer(): void;
  shutdown(): Promise<ShutdownResult>;
  isTimerRunning(): boolean;
}

// ============================================================================
// Type imports from existing modules (for interface completeness)
// ============================================================================

export interface AddResourceParams {
  content: string;
  targetUri: string;
  reason: string;
  wait?: boolean;
  contentType?: string;
}

export interface AddResourceResult {
  rootUri: string;
  taskId?: string;
  status?: string;
}

export interface SearchParams {
  query: string;
  targetUri?: string;
  limit?: number;
  mode?: string;
  tier?: string;
}

export interface FindResult {
  memories: unknown[];
  resources: unknown[];
  skills: unknown[];
  total: number;
}

export interface ContentResult {
  content: string;
  abstract?: string;
  overview?: string;
  metadata?: { title?: string; path?: string; size?: number; createdAt?: number; updatedAt?: number };
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface ExtractedFact {
  content: string;
  factType: string;
  entities: string[];
  confidence: number;
}

export interface AuditLogInput {
  userId: string;
  agentId?: string;
  teamId?: string;
  memoryType: 'document' | 'asset' | 'conversation' | 'message' | 'fact' | 'team';
  memoryId: string;
  action: 'create' | 'read' | 'update' | 'delete';
  scope: { agentId?: string; teamId?: string };
  success: boolean;
  reason?: string;
}

export interface LogEntry {
  level: number;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface FlushResult {
  flushed: number;
  failed: number;
  retries: number;
}

export interface LogBufferStats {
  queued: number;
  flushed: number;
  failed: number;
  pending: number;
}

export interface ShutdownResult {
  flushed: number;
  dropped: number;
  timeout: boolean;
}
