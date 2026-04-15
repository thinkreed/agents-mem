/**
 * @file tests/helpers/mocks.ts
 * @description Mock implementations for dependency injection testing
 */

import type {
  IDatabaseConnection,
  IOpenVikingClient,
  IEmbedder,
  ILLMClient,
  IAuditLogger,
  ILogBuffer,
} from '../../src/core/interfaces';
import type { Database } from 'bun:sqlite';

/**
 * Mock database connection
 */
export class MockDatabaseConnection implements IDatabaseConnection {
  private data: Map<string, unknown[]> = new Map();
  private _isOpen = true;

  isOpen() { return this._isOpen; }
  exec(_sql: string) {}
  run(_sql: string, _params?: unknown[]) {
    return { changes: 1, lastInsertRowid: 1 };
  }
  query<T>(_sql: string, _params?: unknown[]): T[] {
    return [] as T[];
  }
  queryOne<T>(_sql: string, _params?: unknown[]): T | undefined {
    return undefined;
  }
  transaction(fn: () => void) { fn(); }
  close() { this._isOpen = false; }
  prepare(_sql: string) {
    return {
      run: () => ({ changes: 1, lastInsertRowid: 1 }),
      all: () => [],
      get: () => undefined,
    };
  }
  getRaw(): Database {
    throw new Error('MockDatabaseConnection.getRaw() not implemented');
  }
  clearCache() {}

  // Test helper methods
  setMockData(sql: string, data: unknown[]): void {
    this.data.set(sql, data);
  }
}

/**
 * Mock OpenViking client
 */
export class MockOpenVikingClient implements IOpenVikingClient {
  async healthCheck() { return { status: 'ok' as const }; }
  async addResource(_params: unknown) { return { rootUri: 'mem://test', taskId: 'task-1' }; }
  async find(_params: unknown) { return { memories: [], resources: [], skills: [], total: 0 }; }
  async getAbstract(_uri: string) { return 'Mock abstract'; }
  async getOverview(_uri: string) { return 'Mock overview'; }
  async read(_uri: string) { return { content: 'Mock content' }; }
  async write(_uri: string, _content: string) { return { success: true }; }
  async delete(_uri: string) { return { success: true }; }
  async ls(_uri: string) { return []; }
  async uploadMultimodal(_data: ArrayBuffer, _mimeType: string, _targetUri: string) {
    return { uri: 'mem://test/upload' };
  }
  async getTask(_taskId: string) { return { status: 'completed' }; }
}

/**
 * Mock embedder
 */
export class MockEmbedder implements IEmbedder {
  async getEmbedding(_text: string) { return new Float32Array(1024).fill(0.1); }
  async getEmbeddings(texts: string[]) {
    return texts.map(() => new Float32Array(1024).fill(0.1));
  }
  getModel() { return 'mock-model'; }
  getDimension() { return 1024; }
}

/**
 * Mock LLM client
 */
export class MockLLMClient implements ILLMClient {
  async generate(prompt: string, _options?: unknown) { return `Mock response for: ${prompt.slice(0, 50)}`; }
  async generateJSON<T>(_prompt: string, fallback: T) { return fallback; }
  getModel() { return 'mock-llm'; }
  getURL() { return 'http://mock-ollama:11434'; }
  getMaxRetries() { return 3; }
  getTimeout() { return 30000; }
}

/**
 * Mock audit logger
 */
export class MockAuditLogger implements IAuditLogger {
  public logs: unknown[] = [];
  log(entry: unknown) { this.logs.push(entry); }
}

/**
 * Mock log buffer
 */
export class MockLogBuffer implements ILogBuffer {
  async enqueue(_entry: unknown) {}
  async flush() { return { flushed: 0, failed: 0, retries: 0 }; }
  getStats() { return { queued: 0, flushed: 0, failed: 0, pending: 0 }; }
  startFlushTimer() {}
  stopFlushTimer() {}
  async shutdown() { return { flushed: 0, dropped: 0, timeout: false }; }
  isTimerRunning() { return false; }
}
