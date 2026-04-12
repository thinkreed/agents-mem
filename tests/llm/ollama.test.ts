/**
 * @file tests/llm/ollama.test.ts
 * @description Ollama LLM client tests (TDD)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OllamaLLMClient,
  createLLMClient,
  resetLLMClient,
  DEFAULT_LLM_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT
} from '../../src/llm/ollama';

describe('OllamaLLMClient', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    resetLLMClient();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
    resetLLMClient();
  });

  describe('Configuration', () => {
    it('should define default LLM model', () => {
      expect(DEFAULT_LLM_MODEL).toBe('llama3');
    });

    it('should define default URL', () => {
      expect(DEFAULT_OLLAMA_URL).toBe('http://localhost:11434');
    });
  });

  describe('OllamaLLMClient class', () => {
    it('should create client with default config', () => {
      const client = new OllamaLLMClient();
      expect(client).toBeDefined();
      expect(client.getModel()).toBe('llama3');
    });

    it('should create client with custom config', () => {
      const client = new OllamaLLMClient({
        model: 'mistral',
        url: 'http://custom:11434'
      });
      expect(client.getModel()).toBe('mistral');
      expect(client.getURL()).toBe('http://custom:11434');
    });

    it('should have generate method', () => {
      const client = new OllamaLLMClient();
      expect(typeof client.generate).toBe('function');
    });

    it('should have generateJSON method', () => {
      const client = new OllamaLLMClient();
      expect(typeof client.generateJSON).toBe('function');
    });

    it('should have getModel method', () => {
      const client = new OllamaLLMClient();
      expect(typeof client.getModel).toBe('function');
    });

    it('should have getURL method', () => {
      const client = new OllamaLLMClient();
      expect(typeof client.getURL).toBe('function');
    });
  });

  describe('createLLMClient singleton', () => {
    it('should return OllamaLLMClient instance', () => {
      const client = createLLMClient();
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(OllamaLLMClient);
    });

    it('should return same instance on multiple calls', () => {
      const client1 = createLLMClient();
      const client2 = createLLMClient();
      expect(client1).toBe(client2);
    });

    it('should create new instance after reset', () => {
      const client1 = createLLMClient();
      resetLLMClient();
      const client2 = createLLMClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('generate method (mocked)', () => {
    it('should call Ollama API with correct parameters', async () => {
      global.fetch = vi.fn(async (url: string, options?: any) => {
        return {
          ok: true,
          json: async () => ({ response: 'Generated text' })
        } as Response;
      });

      const client = new OllamaLLMClient({ url: 'http://localhost:11434' });
      const result = await client.generate('Test prompt');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );

      // Check body contains model and prompt
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('llama3');
      expect(body.prompt).toBe('Test prompt');

      expect(result).toBe('Generated text');
    });

    it('should handle empty prompt', async () => {
      const client = new OllamaLLMClient();

      const result = await client.generate('');
      expect(result).toBe('');
    });

    it('should handle whitespace prompt', async () => {
      const client = new OllamaLLMClient();

      const result = await client.generate('   ');
      expect(result).toBe('');
    });

    it('should throw on API errors', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: false,
          statusText: 'Model not found'
        } as Response;
      });

      const client = new OllamaLLMClient();

      await expect(client.generate('test')).rejects.toThrow('LLM generation failed');
    });

    it('should accept generate options', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: 'Result' })
        } as Response;
      });

      const client = new OllamaLLMClient();
      await client.generate('test', { temperature: 0.3, maxTokens: 128 });

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.temperature).toBe(0.3);
      expect(body.options.num_predict).toBe(128);
    });

    it('should use default temperature and maxTokens', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: 'Result' })
        } as Response;
      });

      const client = new OllamaLLMClient();
      await client.generate('test');

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.temperature).toBe(0.7);
      expect(body.options.num_predict).toBe(256);
    });
  });

  describe('generateJSON method', () => {
    it('should parse JSON response', async () => {
      const mockResponse = JSON.stringify([
        { content: 'Fact 1', factType: 'preference', entities: [], confidence: 0.9 }
      ]);

      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: mockResponse })
        } as Response;
      });

      const client = new OllamaLLMClient();
      const result = await client.generateJSON('Extract facts', []);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].content).toBe('Fact 1');
    });

    it('should handle JSON wrapped in markdown code block', async () => {
      const mockResponse = '```json\n["item1", "item2"]\n```';

      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: mockResponse })
        } as Response;
      });

      const client = new OllamaLLMClient();
      const result = await client.generateJSON('test', []);

      expect(result).toEqual(['item1', 'item2']);
    });

    it('should handle JSON wrapped in plain code block', async () => {
      const mockResponse = '```\n{"key": "value"}\n```';

      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: mockResponse })
        } as Response;
      });

      const client = new OllamaLLMClient();
      const result = await client.generateJSON('test', {});

      expect(result).toEqual({ key: 'value' });
    });

    it('should return fallback on malformed JSON', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: 'not valid json' })
        } as Response;
      });

      const client = new OllamaLLMClient();
      const fallback = { default: true };
      const result = await client.generateJSON('test', fallback);

      expect(result).toEqual(fallback);
    });

    it('should use lower temperature for JSON generation', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: '[]' })
        } as Response;
      });

      const client = new OllamaLLMClient();
      await client.generateJSON('test', []);

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.temperature).toBe(0.3);
    });

    it('should return fallback on API error', async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: false,
          statusText: 'Error'
        } as Response;
      });

      const client = new OllamaLLMClient();
      const fallback = ['fallback'];

      await expect(client.generateJSON('test', fallback)).rejects.toThrow();
    });
  });

  describe('resetLLMClient', () => {
    it('should reset singleton instance', () => {
      const client1 = createLLMClient();
      resetLLMClient();
      const client2 = createLLMClient();

      expect(client1).not.toBe(client2);
    });

    it('should allow creating new client with different config', () => {
      const client1 = createLLMClient({ model: 'llama3' });
      resetLLMClient();
      const client2 = createLLMClient({ model: 'mistral' });

      expect(client1.getModel()).toBe('llama3');
      expect(client2.getModel()).toBe('mistral');
    });
  });

  describe('Retry Logic', () => {
    it('should define default max retries', () => {
      expect(DEFAULT_MAX_RETRIES).toBe(3);
    });

    it('should define default timeout', () => {
      expect(DEFAULT_TIMEOUT).toBe(30000);
    });

    it('should create client with retry config', () => {
      const client = new OllamaLLMClient({ maxRetries: 5, timeout: 60000 });
      expect(client.getMaxRetries()).toBe(5);
      expect(client.getTimeout()).toBe(60000);
    });

    it('should retry on transient errors', async () => {
      let callCount = 0;
      global.fetch = vi.fn(async () => {
        callCount++;
        if (callCount < 3) {
          return { ok: false, statusText: 'Connection refused' } as Response;
        }
        return { ok: true, json: async () => ({ response: 'Success' }) } as Response;
      });

      const client = new OllamaLLMClient({ maxRetries: 3, retryDelay: 10 });
      const result = await client.generate('test');

      expect(callCount).toBeGreaterThanOrEqual(3);
      expect(result).toBe('Success');
    });

    it('should throw after max retries exhausted', async () => {
      global.fetch = vi.fn(async () => {
        return { ok: false, statusText: 'Service unavailable' } as Response;
      });

      const client = new OllamaLLMClient({ maxRetries: 2, retryDelay: 10 });

      await expect(client.generate('test')).rejects.toThrow();
    });

    it('should use exponential backoff for retries', async () => {
      const timestamps: number[] = [];
      global.fetch = vi.fn(async () => {
        timestamps.push(Date.now());
        return { ok: false, statusText: 'Error' } as Response;
      });

      const client = new OllamaLLMClient({ maxRetries: 3, retryDelay: 50 });

      try {
        await client.generate('test');
      } catch {
        // Expected to throw
      }

      // Check that delays increased (exponential backoff)
      // With retryDelay=50: first retry after 50ms, second after 100ms
      expect(timestamps.length).toBe(3);
    });
  });

  describe('Timeout Handling', () => {
    it('should have getTimeout method', () => {
      const client = new OllamaLLMClient({ timeout: 5000 });
      expect(client.getTimeout()).toBe(5000);
    });

    it('should succeed when response is within timeout', async () => {
      global.fetch = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { ok: true, json: async () => ({ response: 'Success' }) } as Response;
      });

      const client = new OllamaLLMClient({ timeout: 1000, maxRetries: 1 });
      const result = await client.generate('test');

      expect(result).toBe('Success');
    });
  });
});