/**
 * @file src/llm/ollama.ts
 * @description Ollama LLM client for text generation
 */

/**
 * Default LLM model
 */
export const DEFAULT_LLM_MODEL = 'llama3';

/**
 * Default Ollama URL (same as embedder)
 */
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Default max retries
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Default retry delay (ms)
 */
export const DEFAULT_RETRY_DELAY = 1000;

/**
 * Default timeout (ms)
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * LLM client configuration
 */
export interface LLMClientConfig {
  model?: string;
  url?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Generate options
 */
export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Ollama LLM client class
 */
export class OllamaLLMClient {
  private model: string;
  private url: string;
  private maxRetries: number;
  private retryDelay: number;
  private timeout: number;

  constructor(config?: LLMClientConfig) {
    this.model = config?.model ?? DEFAULT_LLM_MODEL;
    this.url = config?.url ?? DEFAULT_OLLAMA_URL;
    this.maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = config?.retryDelay ?? DEFAULT_RETRY_DELAY;
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Generate text from prompt
   */
  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    // Handle empty/whitespace prompt
    if (!prompt || prompt.trim() === '') {
      return '';
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(`${this.url}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt: prompt,
            stream: false,
            options: {
              temperature: options?.temperature ?? 0.7,
              num_predict: options?.maxTokens ?? 256
            }
          })
        });

        if (!response.ok) {
          throw new Error(`LLM generation failed: ${response.statusText}`);
        }

        const data = await response.json() as { response: string };
        return data.response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on non-transient errors (like timeout)
        if (lastError.message.includes('timeout')) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error('Max retries exhausted');
  }

  /**
   * Generate and parse JSON response
   */
  async generateJSON<T>(prompt: string, fallback: T): Promise<T> {
    // Use lower temperature for more deterministic JSON output
    const response = await this.generate(prompt, { temperature: 0.3 });

    if (!response) {
      return fallback;
    }

    try {
      // Try to extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();

      // Remove markdown code block wrapper if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }

      return JSON.parse(jsonStr.trim()) as T;
    } catch {
      // Return fallback if parsing fails
      return fallback;
    }
  }

  /**
   * Get model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get URL
   */
  getURL(): string {
    return this.url;
  }

  /**
   * Get max retries
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * Get timeout
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('LLM request timeout');
      }
      throw error;
    }
  }
}

/**
 * Singleton LLM client instance
 */
let llmClientInstance: OllamaLLMClient | null = null;

/**
 * Create/get singleton LLM client
 */
export function createLLMClient(config?: LLMClientConfig): OllamaLLMClient {
  if (!llmClientInstance) {
    llmClientInstance = new OllamaLLMClient(config);
  }
  return llmClientInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetLLMClient(): void {
  llmClientInstance = null;
}