/**
 * @file src/openviking/http_client.ts
 * @description OpenViking HTTP Client SDK
 */

import 'reflect-metadata';
import { singleton } from 'tsyringe';
import type {
  OpenVikingConfig,
  AddResourceParams,
  AddResourceResult,
  SearchParams,
  FindResult,
  ContentResult,
  VikingError,
  MatchedContext,
} from './types';
import { getConfig } from './config';

/**
 * OpenViking HTTP Client
 */
@singleton()
export class OpenVikingHTTPClient {
  private config: OpenVikingConfig;
  private baseUrl: string;

  constructor() {
    this.config = getConfig();
    this.baseUrl = this.config.baseUrl;
  }
  
  /**
   * Health check - verify server is running
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      const response = await this.request('GET', '/health');
      return { status: 'ok' };
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Health check failed',
      };
    }
  }
  
  /**
   * Add resource to OpenViking
   */
  async addResource(params: AddResourceParams): Promise<AddResourceResult> {
    const body = {
      content: params.content,
      target: params.targetUri,
      reason: params.reason,
      wait: params.wait ?? false,
      content_type: params.contentType ?? 'text',
    };
    
    const response = await this.request('POST', '/api/v1/resources', body) as {
      root_uri?: string;
      task_id?: string;
      status?: 'pending' | 'processing' | 'completed' | 'failed';
    };
    
    return {
      rootUri: response.root_uri ?? '',
      taskId: response.task_id,
      status: response.status,
    };
  }
  
  /**
   * Search/find resources
   */
  async find(params: SearchParams): Promise<FindResult> {
    const body = {
      query: params.query,
      target_uri: params.targetUri,
      limit: params.limit,
      mode: params.mode,
      tier: params.tier,
    };
    
    const response = await this.request(
      'POST',
      '/api/v1/search/find',
      body
    ) as {
      memories?: MatchedContext[];
      resources?: MatchedContext[];
      skills?: MatchedContext[];
      total?: number;
    };
    
    return {
      memories: response.memories ?? [],
      resources: response.resources ?? [],
      skills: response.skills ?? [],
      total: response.total ?? 0,
    };
  }
  
  /**
   * Get L0 abstract for URI
   */
  async getAbstract(uri: string): Promise<string> {
    const response = await this.request('GET', `/api/v1/content/abstract?uri=${encodeURIComponent(uri)}`) as { abstract?: string };
    return response.abstract ?? '';
  }
  
  /**
   * Get L1 overview for URI
   */
  async getOverview(uri: string): Promise<string> {
    const response = await this.request('GET', `/api/v1/content/overview?uri=${encodeURIComponent(uri)}`) as { overview?: string };
    return response.overview ?? '';
  }
  
  /**
   * Read full content (L2) for URI
   */
  async read(uri: string): Promise<ContentResult> {
    const response = await this.request('GET', `/api/v1/content/read?uri=${encodeURIComponent(uri)}`) as {
      content?: string;
      abstract?: string;
      overview?: string;
      metadata?: { title?: string; path?: string; size?: number; createdAt?: number; updatedAt?: number };
    };
    
    return {
      content: response.content ?? '',
      abstract: response.abstract,
      overview: response.overview,
      metadata: response.metadata,
    };
  }
  
  /**
   * Write/update content for URI
   */
  async write(uri: string, content: string): Promise<{ success: boolean }> {
    const response = await this.request('POST', '/api/v1/content/write', {
      uri,
      content,
    }) as { success?: boolean };
    
    return { success: response.success ?? false };
  }
  
  /**
   * Delete resource at URI
   */
  async delete(uri: string): Promise<{ success: boolean }> {
    const response = await this.request('DELETE', `/api/v1/fs?uri=${encodeURIComponent(uri)}`) as { success?: boolean };
    
    return { success: response.success ?? false };
  }
  
  /**
   * List directory contents
   */
  async ls(uri: string): Promise<{ uri: string; name: string; isDir: boolean }[]> {
    const response = await this.request('GET', `/api/v1/fs/ls?uri=${encodeURIComponent(uri)}`) as { items?: { uri: string; name: string; isDir: boolean }[] };
    
    return response.items ?? [];
  }
  
  /**
   * Upload multimodal file (image/video/audio)
   */
  async uploadMultimodal(
    data: ArrayBuffer,
    mimeType: string,
    targetUri: string
  ): Promise<{ uri: string; taskId?: string }> {
    // For multimodal upload, we need to use temp_upload API
    const formData = new FormData();
    formData.append('file', new Blob([data], { type: mimeType }));
    formData.append('target', targetUri);
    
    const response = await this.request('POST', '/api/v1/resources/temp_upload', formData) as {
      uri?: string;
      task_id?: string;
    };
    
    return {
      uri: response.uri ?? '',
      taskId: response.task_id,
    };
  }
  
  /**
   * Get task status (for async operations)
   */
  async getTask(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: Record<string, unknown>;
    error?: string;
  }> {
    const response = await this.request('GET', `/api/v1/tasks/${taskId}`) as {
      status?: 'pending' | 'processing' | 'completed' | 'failed';
      result?: Record<string, unknown>;
      error?: string;
    };
    
    return {
      status: response.status ?? 'pending',
      result: response.result,
      error: response.error,
    };
  }
  
/**
 * Core request method with retry logic
 */
private async request(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown
): Promise<Record<string, unknown>> {
  const url = `${this.baseUrl}${path}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (this.config.apiKey) {
    headers['Authorization'] = `Bearer ${this.config.apiKey}`;
  }
  
  // Retry logic
  let lastError: VikingError | null = null;
  
  for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeout),
      });
      
      if (!response.ok) {
        throw this.createError(response.status, response.statusText);
      }
      
      const data = await response.json() as Record<string, unknown>;
      return data;
    } catch (err) {
      lastError = this.handleError(err);
      
      // Don't retry on auth or not_found errors
      if (lastError.type === 'auth' || lastError.type === 'not_found') {
        throw lastError;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < this.config.maxRetries - 1) {
        await this.delay(100 * Math.pow(2, attempt));
      }
    }
  }
  
  throw lastError ?? this.createError(500, 'Max retries exceeded');
}
  
  /**
   * Create error from HTTP status
   */
  private createError(statusCode: number, message: string): VikingError {
    let type: VikingError['type'];
    
    switch (statusCode) {
      case 401:
      case 403:
        type = 'auth';
        break;
      case 404:
        type = 'not_found';
        break;
      case 400:
        type = 'invalid';
        break;
      case 503:
        type = 'server';
        break;
      default:
        type = 'server';
    }
    
    return { type, message, statusCode };
  }
  
  /**
   * Handle fetch error
   */
  private handleError(err: unknown): VikingError {
    if (err instanceof Error) {
      if (err.name === 'AbortError' || err.message.includes('timeout')) {
        return { type: 'timeout', message: 'Request timeout' };
      }
      if (err.message.includes('fetch') || err.message.includes('network')) {
        return { type: 'connection', message: 'Connection failed' };
      }
      return { type: 'server', message: err.message, original: err };
    }
    
    return { type: 'server', message: 'Unknown error' };
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Backward Compatibility Helpers
// ============================================================================

/**
 * @deprecated Use container.resolve(OpenVikingHTTPClient)
 */
export function getOpenVikingClient(): OpenVikingHTTPClient {
  const { container } = require('tsyringe');
  return container.resolve(OpenVikingHTTPClient);
}

/**
 * @deprecated Use container.register with custom config
 */
export function initClient(config?: Partial<OpenVikingConfig>): OpenVikingHTTPClient {
  const { container } = require('tsyringe');
  container.register('OpenVikingClient', { useValue: new OpenVikingHTTPClient(config) });
  return container.resolve(OpenVikingHTTPClient);
}

/**
 * @deprecated Use container.reset()
 */
export function resetClient(): void {
  const { container } = require('tsyringe');
  container.reset();
}