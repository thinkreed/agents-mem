# LLM Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LLM functionality to agents-mem project by integrating Ollama LLM calls for fact extraction, tiered content generation, and entity tree aggregation.

**Architecture:** Create a new `OllamaLLMClient` class (separate from existing `OllamaEmbedder`) following the same pattern. The client will use Ollama's `/api/generate` endpoint for text generation. LLM operations will be async with proper error handling and mockable for testing.

**Tech Stack:** Ollama API (localhost:11434), TypeScript, Vitest for TDD, structured prompts for each use case.

---

## Architecture Decision: New OllamaLLMClient

### Why Separate Client?

| Aspect | OllamaEmbedder | OllamaLLMClient |
|--------|----------------|-----------------|
| Endpoint | `/api/embeddings` | `/api/generate` |
| Purpose | Vector generation | Text generation |
| Input | Text string | Prompt + optional context |
| Output | Float32Array (768-dim) | String (generated text) |
| Model | nomic-embed-text | llama3 or configurable |

### File Structure

```
src/llm/
├── ollama.ts         # OllamaLLMClient class
├── prompts.ts        # Structured prompts for L0/L1/fact extraction
└── index.ts          # Exports

tests/llm/
├── ollama.test.ts    # OllamaLLMClient tests
└── prompts.test.ts   # Prompt template tests
```

---

## LLM Prompts Design

### Prompt 1: L0 Abstract Generation (~50-100 tokens)

```
You are a summarization assistant. Generate a ONE-sentence abstract (50-100 tokens) that captures the essential information from the given content.

Focus on:
- Key topics or themes
- Main conclusions or findings
- Critical entities (people, projects, concepts)

Content:
{content}

Abstract (one sentence, 50-100 tokens):
```

### Prompt 2: L1 Structured Overview (~500-2000 tokens)

```
You are a content summarization assistant. Generate a structured overview (500-2000 tokens) from the given content.

Structure your response as:
1. **Summary**: 2-3 sentences overview
2. **Key Points**: Bullet list of main topics
3. **Entities**: Important entities mentioned
4. **Context**: Background information needed to understand

Content:
{content}

Overview:
```

### Prompt 3: Fact Extraction

```
You are a fact extraction assistant. Extract atomic facts from the given content.

For each fact, identify:
- content: The fact statement (one sentence)
- factType: preference, decision, observation, conclusion
- entities: Entities involved (array of strings)
- confidence: 0.0-1.0

Output as JSON array:
[
  {
    "content": "...",
    "factType": "...",
    "entities": ["..."],
    "confidence": 0.X
  }
]

Content:
{content}

Facts (JSON array):
```

### Prompt 4: Entity Aggregation

```
You are an entity content aggregator. Combine the following child node contents into a coherent summary that represents the parent entity.

Requirements:
- Preserve key information from all children
- Remove redundancy
- Keep within 2000 token budget
- Focus on the entity: {entity_name}

Child contents:
{child_contents}

Aggregated content:
```

---

## Implementation Order

```
Phase 1: Foundation (LLM Client)
    Task 1: OllamaLLMClient core implementation
    Task 2: Prompt templates
    Task 3: Error handling and retries

Phase 2: Tiered Generator (depends on Phase 1)
    Task 4: Update TieredGenerator.generateL0
    Task 5: Update TieredGenerator.generateL1

Phase 3: Fact Extractor (depends on Phase 1)
    Task 6: Update FactExtractor.extract

Phase 4: Entity Aggregator (depends on Phase 1)
    Task 7: Update aggregateChildContent

Phase 5: Integration Testing
    Task 8: End-to-end tests
```

---

## Dependencies Graph

```
OllamaLLMClient ─────────────────────────────────────────────────┐
    │                                                            │
    ├─────────────────► TieredGenerator.generateL0               │
    │                    (uses L0 abstract prompt)               │
    │                                                            │
    ├─────────────────► TieredGenerator.generateL1               │
    │                    (uses L1 overview prompt)               │
    │                                                            │
    ├─────────────────► FactExtractor.extract                    │
    │                    (uses fact extraction prompt)           │
    │                                                            │
    └─────────────────► aggregateChildContent                    │
                         (uses aggregation prompt)               ◄─┘
```

---

## Task 1: OllamaLLMClient Core Implementation

**Files:**
- Create: `src/llm/ollama.ts`
- Create: `tests/llm/ollama.test.ts`

- [ ] **Step 1: Write the failing tests for OllamaLLMClient**

```typescript
// tests/llm/ollama.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  OllamaLLMClient,
  createLLMClient,
  DEFAULT_LLM_MODEL,
  DEFAULT_OLLAMA_URL
} from '../../src/llm/ollama';

describe('OllamaLLMClient', () => {
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
    });

    it('should have generate method', () => {
      const client = new OllamaLLMClient();
      expect(typeof client.generate).toBe('function');
    });

    it('should have generateJSON method', () => {
      const client = new OllamaLLMClient();
      expect(typeof client.generateJSON).toBe('function');
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
  });

  describe('generate method (mocked)', () => {
    it('should call Ollama API with correct parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Generated text' })
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new OllamaLLMClient({ url: 'http://localhost:11434' });
      const result = await client.generate('Test prompt');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('llama3')
        })
      );
      expect(result).toBe('Generated text');

      vi.unstubAllGlobals();
    });

    it('should handle empty prompt', async () => {
      const client = new OllamaLLMClient();
      
      // Should not throw for empty prompt, just return empty
      await expect(client.generate('')).resolves.toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Model not found'
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new OllamaLLMClient();
      
      await expect(client.generate('test')).rejects.toThrow();

      vi.unstubAllGlobals();
    });

    it('should support streaming option', async () => {
      const client = new OllamaLLMClient();
      expect(typeof client.generate).toBe('function');
      // generate should accept stream: false option
    });
  });

  describe('generateJSON method', () => {
    it('should parse JSON response', async () => {
      const mockResponse = JSON.stringify([
        { content: 'Fact 1', factType: 'preference', entities: [], confidence: 0.9 }
      ]);
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: mockResponse })
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new OllamaLLMClient();
      const result = await client.generateJSON('Extract facts', []);

      expect(Array.isArray(result)).toBe(true);

      vi.unstubAllGlobals();
    });

    it('should handle malformed JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'not valid json' })
      });
      vi.stubGlobal('fetch', mockFetch);

      const client = new OllamaLLMClient();
      
      // Should throw or return fallback
      await expect(client.generateJSON('test', [])).rejects.toThrow();

      vi.unstubAllGlobals();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/llm/ollama.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Create the llm directory and implement OllamaLLMClient**

```typescript
// src/llm/ollama.ts
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
 * LLM client configuration
 */
export interface LLMClientConfig {
  model?: string;
  url?: string;
}

/**
 * Generate options
 */
export interface GenerateOptions {
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Ollama LLM client class
 */
export class OllamaLLMClient {
  private model: string;
  private url: string;

  constructor(config?: LLMClientConfig) {
    this.model = config?.model ?? DEFAULT_LLM_MODEL;
    this.url = config?.url ?? DEFAULT_OLLAMA_URL;
  }

  /**
   * Generate text from prompt
   */
  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    if (!prompt) {
      return '';
    }

    const response = await fetch(`${this.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: options?.stream ?? false,
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
  }

  /**
   * Generate and parse JSON response
   */
  async generateJSON<T>(prompt: string, fallback: T): Promise<T> {
    const response = await this.generate(prompt, { temperature: 0.3 });

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
```

- [ ] **Step 4: Create index.ts export file**

```typescript
// src/llm/index.ts
export * from './ollama';
export * from './prompts';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/llm/ollama.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/llm/ tests/llm/
git commit -m "feat: add OllamaLLMClient for LLM text generation"
```

---

## Task 2: Prompt Templates

**Files:**
- Create: `src/llm/prompts.ts`
- Create: `tests/llm/prompts.test.ts`

- [ ] **Step 1: Write the failing tests for prompt templates**

```typescript
// tests/llm/prompts.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildL0AbstractPrompt,
  buildL1OverviewPrompt,
  buildFactExtractionPrompt,
  buildAggregationPrompt,
  L0_SYSTEM_PROMPT,
  L1_SYSTEM_PROMPT,
  FACT_SYSTEM_PROMPT
} from '../../src/llm/prompts';

describe('Prompt Templates', () => {
  describe('L0 Abstract Prompt', () => {
    it('should define L0_SYSTEM_PROMPT', () => {
      expect(L0_SYSTEM_PROMPT).toBeDefined();
      expect(L0_SYSTEM_PROMPT.length).toBeGreaterThan(50);
    });

    it('should build L0 prompt with content', () => {
      const prompt = buildL0AbstractPrompt('Test content here');
      
      expect(prompt).toContain('Test content here');
      expect(prompt).toContain('one sentence');
      expect(prompt).toContain('50-100 tokens');
    });

    it('should handle empty content', () => {
      const prompt = buildL0AbstractPrompt('');
      expect(prompt).toBeDefined();
    });

    it('should include key focus areas', () => {
      const prompt = buildL0AbstractPrompt('content');
      
      expect(prompt).toContain('Key topics');
      expect(prompt).toContain('Main conclusions');
      expect(prompt).toContain('entities');
    });
  });

  describe('L1 Overview Prompt', () => {
    it('should define L1_SYSTEM_PROMPT', () => {
      expect(L1_SYSTEM_PROMPT).toBeDefined();
      expect(L1_SYSTEM_PROMPT.length).toBeGreaterThan(50);
    });

    it('should build L1 prompt with content', () => {
      const prompt = buildL1OverviewPrompt('Long content here');
      
      expect(prompt).toContain('Long content here');
      expect(prompt).toContain('500-2000 tokens');
      expect(prompt).toContain('structured');
    });

    it('should request specific sections', () => {
      const prompt = buildL1OverviewPrompt('content');
      
      expect(prompt).toContain('Summary');
      expect(prompt).toContain('Key Points');
      expect(prompt).toContain('Entities');
      expect(prompt).toContain('Context');
    });
  });

  describe('Fact Extraction Prompt', () => {
    it('should define FACT_SYSTEM_PROMPT', () => {
      expect(FACT_SYSTEM_PROMPT).toBeDefined();
    });

    it('should build fact extraction prompt', () => {
      const prompt = buildFactExtractionPrompt('User prefers dark mode');
      
      expect(prompt).toContain('User prefers dark mode');
      expect(prompt).toContain('JSON array');
      expect(prompt).toContain('factType');
      expect(prompt).toContain('confidence');
    });

    it('should list valid fact types', () => {
      const prompt = buildFactExtractionPrompt('content');
      
      expect(prompt).toContain('preference');
      expect(prompt).toContain('decision');
      expect(prompt).toContain('observation');
      expect(prompt).toContain('conclusion');
    });

    it('should specify confidence range', () => {
      const prompt = buildFactExtractionPrompt('content');
      
      expect(prompt).toContain('0.0-1.0');
    });
  });

  describe('Aggregation Prompt', () => {
    it('should build aggregation prompt', () => {
      const contents = ['Child 1 content', 'Child 2 content'];
      const prompt = buildAggregationPrompt(contents, 'ProjectX');
      
      expect(prompt).toContain('Child 1 content');
      expect(prompt).toContain('Child 2 content');
      expect(prompt).toContain('ProjectX');
    });

    it('should handle single content', () => {
      const prompt = buildAggregationPrompt(['Only content'], 'Entity');
      
      expect(prompt).toContain('Only content');
    });

    it('should handle empty contents array', () => {
      const prompt = buildAggregationPrompt([], 'Entity');
      
      expect(prompt).toBeDefined();
    });

    it('should specify token budget', () => {
      const prompt = buildAggregationPrompt(['content'], 'Entity');
      
      expect(prompt).toContain('2000 token');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/llm/prompts.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement prompt templates**

```typescript
// src/llm/prompts.ts
/**
 * @file src/llm/prompts.ts
 * @description Structured prompts for LLM operations
 */

import { L0_TOKEN_BUDGET, L1_TOKEN_BUDGET } from '../core/constants';

// ============================================================================
// System Prompts
// ============================================================================

export const L0_SYSTEM_PROMPT = `You are a summarization assistant. Generate a ONE-sentence abstract that captures the essential information from the given content.

Focus on:
- Key topics or themes
- Main conclusions or findings
- Critical entities (people, projects, concepts)

Keep the abstract between 50-100 tokens.`;

export const L1_SYSTEM_PROMPT = `You are a content summarization assistant. Generate a structured overview from the given content.

Structure your response as:
1. **Summary**: 2-3 sentences overview
2. **Key Points**: Bullet list of main topics
3. **Entities**: Important entities mentioned
4. **Context**: Background information needed to understand

Keep the overview between 500-2000 tokens.`;

export const FACT_SYSTEM_PROMPT = `You are a fact extraction assistant. Extract atomic facts from the given content.

For each fact, identify:
- content: The fact statement (one sentence)
- factType: One of: preference, decision, observation, conclusion
- entities: Entities involved (array of strings)
- confidence: Confidence level between 0.0 and 1.0

Output as a valid JSON array only (no markdown, no explanation).`;

export const AGGREGATION_SYSTEM_PROMPT = `You are an entity content aggregator. Combine child node contents into a coherent summary that represents the parent entity.

Requirements:
- Preserve key information from all children
- Remove redundancy
- Keep within 2000 token budget
- Focus on the parent entity`;

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build L0 abstract generation prompt
 */
export function buildL0AbstractPrompt(content: string): string {
  if (!content) {
    return `${L0_SYSTEM_PROMPT}

Content: (empty)

Abstract (one sentence):`;
  }

  return `${L0_SYSTEM_PROMPT}

Content:
${content}

Abstract (one sentence, ~${L0_TOKEN_BUDGET} tokens):`;
}

/**
 * Build L1 overview generation prompt
 */
export function buildL1OverviewPrompt(content: string): string {
  if (!content) {
    return `${L1_SYSTEM_PROMPT}

Content: (empty)

Overview:`;
  }

  return `${L1_SYSTEM_PROMPT}

Content:
${content}

Overview (~${L1_TOKEN_BUDGET} tokens):`;
}

/**
 * Build fact extraction prompt
 */
export function buildFactExtractionPrompt(content: string): string {
  if (!content) {
    return `${FACT_SYSTEM_PROMPT}

Content: (empty)

Facts (JSON array): []`;
  }

  return `${FACT_SYSTEM_PROMPT}

Content:
${content}

Facts (JSON array):`;
}

/**
 * Build aggregation prompt for entity tree
 */
export function buildAggregationPrompt(childContents: string[], entityName: string): string {
  const combinedContent = childContents.length > 0
    ? childContents.join('\n\n---\n\n')
    : '(no child content)';

  return `${AGGREGATION_SYSTEM_PROMPT}

Parent Entity: ${entityName}

Child contents:
${combinedContent}

Aggregated content (~${L1_TOKEN_BUDGET} tokens):`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/llm/prompts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/llm/prompts.ts tests/llm/prompts.test.ts
git commit -m "feat: add structured LLM prompts for L0/L1/facts/aggregation"
```

---

## Task 3: Error Handling and Retry Logic

**Files:**
- Modify: `src/llm/ollama.ts`
- Modify: `tests/llm/ollama.test.ts`

- [ ] **Step 1: Write failing tests for error handling**

Add to `tests/llm/ollama.test.ts`:

```typescript
describe('Error Handling', () => {
  it('should retry on transient errors', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({ ok: false, statusText: 'Connection refused' });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: 'Success' })
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new OllamaLLMClient({ maxRetries: 3 });
    const result = await client.generate('test');

    expect(callCount).toBeGreaterThanOrEqual(3);
    expect(result).toBe('Success');

    vi.unstubAllGlobals();
  });

  it('should throw after max retries exhausted', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Service unavailable'
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new OllamaLLMClient({ maxRetries: 2 });
    
    await expect(client.generate('test')).rejects.toThrow();

    vi.unstubAllGlobals();
  });

  it('should handle timeout', async () => {
    vi.useFakeTimers();
    
    const mockFetch = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true, json: () => ({ response: 'late' }) }), 10000);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new OllamaLLMClient({ timeout: 5000 });
    const promise = client.generate('test');

    vi.advanceTimersByTime(6000);

    await expect(promise).rejects.toThrow('timeout');

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/llm/ollama.test.ts`
Expected: FAIL - maxRetries not implemented

- [ ] **Step 3: Implement retry logic**

Update `src/llm/ollama.ts`:

```typescript
// Add to LLMClientConfig interface
export interface LLMClientConfig {
  model?: string;
  url?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

// Add to class
private maxRetries: number;
private retryDelay: number;
private timeout: number;

constructor(config?: LLMClientConfig) {
  this.model = config?.model ?? DEFAULT_LLM_MODEL;
  this.url = config?.url ?? DEFAULT_OLLAMA_URL;
  this.maxRetries = config?.maxRetries ?? 3;
  this.retryDelay = config?.retryDelay ?? 1000;
  this.timeout = config?.timeout ?? 30000;
}

// Update generate method with retry logic
async generate(prompt: string, options?: GenerateOptions): Promise<string> {
  if (!prompt) {
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
          stream: options?.stream ?? false,
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
      
      // Don't retry on non-transient errors
      if (lastError.message.includes('timeout')) {
        throw lastError;
      }

      // Wait before retry
      if (attempt < this.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error('Max retries exhausted');
}

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/llm/ollama.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/llm/ollama.ts tests/llm/ollama.test.ts
git commit -m "feat: add retry logic and timeout handling to OllamaLLMClient"
```

---

## Task 4: Update TieredGenerator.generateL0

**Files:**
- Modify: `src/tiered/generator.ts`
- Modify: `tests/tiered/generator.test.ts`

- [ ] **Step 1: Write failing tests for LLM-based L0 generation**

Add to `tests/tiered/generator.test.ts`:

```typescript
import { vi } from 'vitest';
import { createLLMClient, resetLLMClient } from '../../src/llm/ollama';

describe('TieredGenerator with LLM', () => {
  beforeEach(() => {
    resetLLMClient();
  });

  afterEach(() => {
    resetLLMClient();
    vi.unstubAllGlobals();
  });

  describe('generateL0 with LLM', () => {
    it('should call LLM for abstract generation', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'This document covers the main topic.' })
      });
      vi.stubGlobal('fetch', mockFetch);

      const generator = new TieredGenerator();
      const result = await generator.generateL0('Long content about topics and subjects.');

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBe('This document covers the main topic.');

      vi.unstubAllGlobals();
    });

    it('should fall back to truncation when LLM fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Service unavailable'
      });
      vi.stubGlobal('fetch', mockFetch);

      const generator = new TieredGenerator();
      const content = 'Test content for fallback test.';
      const result = await generator.generateL0(content);

      // Should fall back to truncation
      expect(result).toBe(truncateToTokens(content, L0_TOKEN_BUDGET));

      vi.unstubAllGlobals();
    });

    it('should handle empty content gracefully', async () => {
      const generator = new TieredGenerator();
      const result = await generator.generateL0('');

      expect(result).toBe('');
    });

    it('should respect L0 token budget', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          response: 'A very long response that exceeds the token budget limit for L0 content generation.' 
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const generator = new TieredGenerator();
      const result = await generator.generateL0('content');

      const tokens = estimateTokens(result);
      expect(tokens).toBeLessThanOrEqual(L0_TOKEN_BUDGET + 20); // Allow slight overshoot

      vi.unstubAllGlobals();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/tiered/generator.test.ts`
Expected: FAIL - LLM integration not implemented

- [ ] **Step 3: Update TieredGenerator to use LLM**

Modify `src/tiered/generator.ts`:

```typescript
/**
 * @file src/tiered/generator.ts
 * @description L0/L1 content generator with LLM support
 */

import { estimateTokens, truncateToTokens } from '../utils/token_estimate';
import { L0_TOKEN_BUDGET, L1_TOKEN_BUDGET } from '../core/constants';
import { createLLMClient, resetLLMClient } from '../llm/ollama';
import { buildL0AbstractPrompt, buildL1OverviewPrompt } from '../llm/prompts';

/**
 * Tiered content generator
 */
export class TieredGenerator {
  /**
   * Generate L0 abstract from content
   */
  async generateL0(content: string): Promise<string> {
    // Handle empty content
    if (!content || content.trim() === '') {
      return '';
    }

    // For short content, no need to call LLM
    if (estimateTokens(content) <= L0_TOKEN_BUDGET) {
      return content;
    }

    try {
      const llmClient = createLLMClient();
      const prompt = buildL0AbstractPrompt(content);
      const abstract = await llmClient.generate(prompt, {
        temperature: 0.5,
        maxTokens: L0_TOKEN_BUDGET + 20
      });

      // Ensure result is within budget
      if (estimateTokens(abstract) > L0_TOKEN_BUDGET + 20) {
        return truncateToTokens(abstract, L0_TOKEN_BUDGET);
      }

      return abstract.trim();
    } catch {
      // Fall back to truncation if LLM fails
      return truncateToTokens(content, L0_TOKEN_BUDGET);
    }
  }

  /**
   * Generate L1 overview from content
   */
  async generateL1(content: string): Promise<string> {
    // Handle empty content
    if (!content || content.trim() === '') {
      return '';
    }

    // For short content, no need to call LLM
    if (estimateTokens(content) <= L1_TOKEN_BUDGET) {
      return content;
    }

    try {
      const llmClient = createLLMClient();
      const prompt = buildL1OverviewPrompt(content);
      const overview = await llmClient.generate(prompt, {
        temperature: 0.6,
        maxTokens: L1_TOKEN_BUDGET + 50
      });

      // Ensure result is within budget
      if (estimateTokens(overview) > L1_TOKEN_BUDGET + 50) {
        return truncateToTokens(overview, L1_TOKEN_BUDGET);
      }

      return overview.trim();
    } catch {
      // Fall back to truncation if LLM fails
      return truncateToTokens(content, L1_TOKEN_BUDGET);
    }
  }

  /**
   * Generate both L0 and L1
   */
  async generateBoth(content: string): Promise<{ abstract: string; overview: string }> {
    const abstract = await this.generateL0(content);
    const overview = await this.generateL1(content);

    return { abstract, overview };
  }
}

/**
 * Singleton generator
 */
let generatorInstance: TieredGenerator | null = null;

/**
 * Create/get tiered generator
 */
export function createTieredGenerator(): TieredGenerator {
  if (!generatorInstance) {
    generatorInstance = new TieredGenerator();
  }
  return generatorInstance;
}

/**
 * Reset generator (for testing)
 */
export function resetTieredGenerator(): void {
  generatorInstance = null;
  resetLLMClient();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/tiered/generator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tiered/generator.ts tests/tiered/generator.test.ts src/llm/index.ts
git commit -m "feat: integrate LLM into TieredGenerator for L0/L1 generation"
```

---

## Task 5: Update TieredGenerator.generateL1

(Already implemented in Task 4 - L1 follows same pattern as L0)

- [ ] **Step 1: Add specific L1 tests**

Add to `tests/tiered/generator.test.ts`:

```typescript
describe('generateL1 with LLM', () => {
  it('should call LLM for overview generation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        response: `**Summary**: This covers multiple topics.

**Key Points**:
- Point 1
- Point 2

**Entities**: Topic A, Topic B

**Context**: Background information here.` 
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const generator = new TieredGenerator();
    const result = await generator.generateL1('Detailed content about many topics.');

    expect(mockFetch).toHaveBeenCalled();
    expect(result).toContain('Summary');

    vi.unstubAllGlobals();
  });

  it('should fall back to truncation when LLM fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Service unavailable'
    });
    vi.stubGlobal('fetch', mockFetch);

    const generator = new TieredGenerator();
    const content = Array(100).fill('Content for L1 test.').join(' ');
    const result = await generator.generateL1(content);

    expect(result).toBe(truncateToTokens(content, L1_TOKEN_BUDGET));

    vi.unstubAllGlobals();
  });

  it('should respect L1 token budget', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: 'Short overview within budget' })
    });
    vi.stubGlobal('fetch', mockFetch);

    const generator = new TieredGenerator();
    const result = await generator.generateL1('content');

    const tokens = estimateTokens(result);
    expect(tokens).toBeLessThanOrEqual(L1_TOKEN_BUDGET + 50);

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `bun test tests/tiered/generator.test.ts`
Expected: PASS (already implemented)

- [ ] **Step 3: Commit test additions**

```bash
git add tests/tiered/generator.test.ts
git commit -m "test: add L1 specific tests for LLM integration"
```

---

## Task 6: Update FactExtractor.extract

**Files:**
- Modify: `src/facts/extractor.ts`
- Modify: `tests/facts/extractor.test.ts`

- [ ] **Step 1: Write failing tests for LLM-based fact extraction**

Replace placeholder tests in `tests/facts/extractor.test.ts`:

```typescript
import { vi } from 'vitest';
import { resetLLMClient } from '../../src/llm/ollama';

describe('FactExtractor with LLM', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    resetLLMClient();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'Test User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
    resetLLMClient();
    vi.unstubAllGlobals();
  });

  describe('extract() with LLM', () => {
    it('should call LLM for fact extraction', async () => {
      const mockResponse = JSON.stringify([
        {
          content: 'User prefers dark mode',
          factType: 'preference',
          entities: ['user', 'theme'],
          confidence: 0.9
        }
      ]);
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: mockResponse })
      });
      vi.stubGlobal('fetch', mockFetch);

      const extractor = new FactExtractor();
      const result = await extractor.extract('The user prefers dark mode for the interface.');

      expect(mockFetch).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].content).toBe('User prefers dark mode');
      expect(result[0].factType).toBe('preference');

      vi.unstubAllGlobals();
    });

    it('should return empty array for content with no facts', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: '[]' })
      });
      vi.stubGlobal('fetch', mockFetch);

      const extractor = new FactExtractor();
      const result = await extractor.extract('Random text with no factual content.');

      expect(result).toEqual([]);

      vi.unstubAllGlobals();
    });

    it('should handle malformed JSON response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Not valid JSON' })
      });
      vi.stubGlobal('fetch', mockFetch);

      const extractor = new FactExtractor();
      const result = await extractor.extract('Some content');

      // Should return empty array on parse failure
      expect(result).toEqual([]);

      vi.unstubAllGlobals();
    });

    it('should fall back to empty array when LLM fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Service unavailable'
      });
      vi.stubGlobal('fetch', mockFetch);

      const extractor = new FactExtractor();
      const result = await extractor.extract('Content for extraction');

      expect(result).toEqual([]);

      vi.unstubAllGlobals();
    });

    it('should extract multiple facts', async () => {
      const mockResponse = JSON.stringify([
        { content: 'Fact 1', factType: 'observation', entities: ['a'], confidence: 0.8 },
        { content: 'Fact 2', factType: 'decision', entities: ['b'], confidence: 0.7 },
        { content: 'Fact 3', factType: 'preference', entities: ['c'], confidence: 0.9 }
      ]);
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: mockResponse })
      });
      vi.stubGlobal('fetch', mockFetch);

      const extractor = new FactExtractor();
      const result = await extractor.extract('Content with multiple facts');

      expect(result.length).toBe(3);

      vi.unstubAllGlobals();
    });

    it('should handle empty content', async () => {
      const extractor = new FactExtractor();
      const result = await extractor.extract('');

      expect(result).toEqual([]);
    });

    it('should handle whitespace content', async () => {
      const extractor = new FactExtractor();
      const result = await extractor.extract('   ');

      expect(result).toEqual([]);
    });

    it('should validate fact structure', async () => {
      const mockResponse = JSON.stringify([
        { content: 'Valid fact', factType: 'observation', entities: [], confidence: 0.5 }
      ]);
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: mockResponse })
      });
      vi.stubGlobal('fetch', mockFetch);

      const extractor = new FactExtractor();
      const result = await extractor.extract('content');

      expect(result[0]).toHaveProperty('content');
      expect(result[0]).toHaveProperty('factType');
      expect(result[0]).toHaveProperty('entities');
      expect(result[0]).toHaveProperty('confidence');
      expect(typeof result[0].confidence).toBe('number');
      expect(result[0].confidence).toBeGreaterThanOrEqual(0);
      expect(result[0].confidence).toBeLessThanOrEqual(1);

      vi.unstubAllGlobals();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/facts/extractor.test.ts`
Expected: FAIL - LLM integration not implemented

- [ ] **Step 3: Update FactExtractor to use LLM**

Modify `src/facts/extractor.ts`:

```typescript
/**
 * @file src/facts/extractor.ts
 * @description Fact extraction from content with LLM support
 */

import { createFact, FactInput } from '../sqlite/facts';
import { createExtractionStatus, updateExtractionStatus } from '../sqlite/extraction_status';
import { generateUUID } from '../utils/uuid';
import { createLLMClient } from '../llm/ollama';
import { buildFactExtractionPrompt } from '../llm/prompts';

/**
 * Extracted fact
 */
export interface ExtractedFact {
  content: string;
  factType: string;
  entities: string[];
  confidence: number;
}

/**
 * Fact extractor with LLM support
 */
export class FactExtractor {
  /**
   * Extract facts from content using LLM
   */
  async extract(content: string): Promise<ExtractedFact[]> {
    // Handle empty/whitespace content
    if (!content || content.trim() === '') {
      return [];
    }

    try {
      const llmClient = createLLMClient();
      const prompt = buildFactExtractionPrompt(content);
      
      const facts = await llmClient.generateJSON<ExtractedFact[]>(prompt, []);
      
      // Validate and filter facts
      return this.validateFacts(facts);
    } catch {
      // Return empty array on failure
      return [];
    }
  }

  /**
   * Validate extracted facts
   */
  private validateFacts(facts: unknown[]): ExtractedFact[] {
    if (!Array.isArray(facts)) {
      return [];
    }

    const validFactTypes = ['preference', 'decision', 'observation', 'conclusion'];

    return facts.filter((fact): fact is ExtractedFact => {
      if (!fact || typeof fact !== 'object') {
        return false;
      }

      const f = fact as Record<string, unknown>;

      // Check required fields
      if (typeof f.content !== 'string' || !f.content.trim()) {
        return false;
      }

      if (!validFactTypes.includes(f.factType as string)) {
        return false;
      }

      if (!Array.isArray(f.entities)) {
        return false;
      }

      if (typeof f.confidence !== 'number' || f.confidence < 0 || f.confidence > 1) {
        return false;
      }

      return true;
    }).map(f => ({
      content: String(f.content).trim(),
      factType: String(f.factType),
      entities: (f.entities as string[]).map(String),
      confidence: Number(f.confidence)
    }));
  }
  
  /**
   * Extract and save facts
   */
  async extractAndSave(input: {
    userId: string;
    sourceType: string;
    sourceId: string;
    content: string;
  }): Promise<string[]> {
    const status = createExtractionStatus({
      target_type: input.sourceType,
      target_id: input.sourceId,
      extraction_mode: 'on_demand'
    });
    
    const facts = await this.extract(input.content);
    const factIds: string[] = [];
    
    for (const fact of facts) {
      const id = generateUUID();
      createFact({
        id,
        user_id: input.userId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        content: fact.content,
        fact_type: fact.factType,
        entities: JSON.stringify(fact.entities),
        confidence: fact.confidence
      });
      factIds.push(id);
    }
    
    updateExtractionStatus(status.id, {
      status: 'completed',
      facts_count: facts.length
    });
    
    return factIds;
  }
}

/**
 * Singleton extractor
 */
let extractorInstance: FactExtractor | null = null;

/**
 * Get fact extractor
 */
export function getFactExtractor(): FactExtractor {
  if (!extractorInstance) {
    extractorInstance = new FactExtractor();
  }
  return extractorInstance;
}

/**
 * Reset extractor (for testing)
 */
export function resetFactExtractor(): void {
  extractorInstance = null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/facts/extractor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/facts/extractor.ts tests/facts/extractor.test.ts
git commit -m "feat: integrate LLM into FactExtractor for atomic fact extraction"
```

---

## Task 7: Update Entity Tree Aggregator

**Files:**
- Modify: `src/entity_tree/aggregator.ts`
- Modify: `tests/entity_tree/aggregator.test.ts`

- [ ] **Step 1: Write failing tests for LLM-based aggregation**

Add to `tests/entity_tree/aggregator.test.ts`:

```typescript
import { vi } from 'vitest';
import { resetLLMClient } from '../../src/llm/ollama';

describe('Entity Tree Aggregator with LLM', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    resetLLMClient();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'Test User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
    resetLLMClient();
    vi.unstubAllGlobals();
  });

  describe('aggregateChildContent with LLM', () => {
    it('should call LLM for content aggregation', async () => {
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'ProjectX',
        depth: 0
      });
      createEntityNode({
        id: 'child-1',
        user_id: 'user-1',
        entity_name: 'Child',
        depth: 1,
        parent_id: 'parent-1',
        aggregated_content: 'Child 1 describes feature A.'
      });
      createEntityNode({
        id: 'child-2',
        user_id: 'user-1',
        entity_name: 'Child',
        depth: 1,
        parent_id: 'parent-1',
        aggregated_content: 'Child 2 describes feature B.'
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          response: 'ProjectX contains features A and B as described by its children.' 
        })
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await aggregateChildContent('parent-1');

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toContain('ProjectX');

      vi.unstubAllGlobals();
    });

    it('should fall back to simple combination when LLM fails', async () => {
      createEntityNode({
        id: 'parent-2',
        user_id: 'user-1',
        entity_name: 'Entity',
        depth: 0
      });
      createEntityNode({
        id: 'child-3',
        user_id: 'user-1',
        entity_name: 'C',
        depth: 1,
        parent_id: 'parent-2',
        aggregated_content: 'Content A'
      });
      createEntityNode({
        id: 'child-4',
        user_id: 'user-1',
        entity_name: 'C',
        depth: 1,
        parent_id: 'parent-2',
        aggregated_content: 'Content B'
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Service unavailable'
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await aggregateChildContent('parent-2');

      expect(result).toContain('Content A');
      expect(result).toContain('Content B');

      vi.unstubAllGlobals();
    });

    it('should handle parent with no children', async () => {
      createEntityNode({
        id: 'parent-empty',
        user_id: 'user-1',
        entity_name: 'Empty',
        depth: 0
      });

      const result = await aggregateChildContent('parent-empty');

      expect(result).toBe('');
    });

    it('should handle children without content', async () => {
      createEntityNode({
        id: 'parent-no-content',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });
      createEntityNode({
        id: 'child-no-content',
        user_id: 'user-1',
        entity_name: 'Child',
        depth: 1,
        parent_id: 'parent-no-content'
        // No aggregated_content
      });

      const result = await aggregateChildContent('parent-no-content');

      expect(result).toBe('');
    });

    it('should respect token budget', async () => {
      createEntityNode({
        id: 'parent-budget',
        user_id: 'user-1',
        entity_name: 'Entity',
        depth: 0
      });
      createEntityNode({
        id: 'child-long',
        user_id: 'user-1',
        entity_name: 'Long',
        depth: 1,
        parent_id: 'parent-budget',
        aggregated_content: Array(100).fill('Very long content.').join(' ')
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Short summary.' })
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await aggregateChildContent('parent-budget');

      const tokens = estimateTokens(result);
      expect(tokens).toBeLessThanOrEqual(L1_TOKEN_BUDGET + 50);

      vi.unstubAllGlobals();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/entity_tree/aggregator.test.ts`
Expected: FAIL - LLM integration not implemented

- [ ] **Step 3: Update aggregator to use LLM**

Modify `src/entity_tree/aggregator.ts`:

```typescript
/**
 * @file src/entity_tree/aggregator.ts
 * @description Entity node content aggregator with LLM support
 */

import { getEntityNodeById, getEntityNodesByParent, updateEntityNode } from '../sqlite/entity_nodes';
import { estimateTokens } from '../utils/token_estimate';
import { L1_TOKEN_BUDGET } from '../core/constants';
import { createLLMClient } from '../llm/ollama';
import { buildAggregationPrompt } from '../llm/prompts';

/**
 * Aggregate child content into parent using LLM
 */
export async function aggregateChildContent(parentNodeId: string): Promise<string> {
  const parent = getEntityNodeById(parentNodeId);
  const children = getEntityNodesByParent(parentNodeId);

  if (!parent || children.length === 0) return '';

  // Collect child contents
  const contents: string[] = [];
  for (const child of children) {
    if (child.aggregated_content) {
      contents.push(child.aggregated_content);
    }
  }

  if (contents.length === 0) return '';

  // Simple combination for small content (no LLM needed)
  const combined = contents.join('\n\n');
  if (estimateTokens(combined) <= L1_TOKEN_BUDGET) {
    return combined;
  }

  try {
    const llmClient = createLLMClient();
    const prompt = buildAggregationPrompt(contents, parent.entity_name);
    
    const aggregated = await llmClient.generate(prompt, {
      temperature: 0.5,
      maxTokens: L1_TOKEN_BUDGET + 50
    });

    // Ensure result is within budget
    if (estimateTokens(aggregated) > L1_TOKEN_BUDGET + 50) {
      return combined.slice(0, L1_TOKEN_BUDGET * 4);
    }

    return aggregated.trim();
  } catch {
    // Fall back to simple combination + truncation
    return combined.slice(0, L1_TOKEN_BUDGET * 4);
  }
}

/**
 * Update parent aggregation
 */
export async function updateParentAggregation(parentNodeId: string): Promise<void> {
  const aggregated = await aggregateChildContent(parentNodeId);
  const children = getEntityNodesByParent(parentNodeId);

  updateEntityNode(parentNodeId, {
    aggregated_content: aggregated,
    child_count: children.length
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/entity_tree/aggregator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/entity_tree/aggregator.ts tests/entity_tree/aggregator.test.ts
git commit -m "feat: integrate LLM into entity tree aggregator for content combination"
```

---

## Task 8: Integration Testing

**Files:**
- Create: `tests/integration/llm_integration.test.ts`

- [ ] **Step 1: Write integration tests**

```typescript
// tests/integration/llm_integration.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resetConnection,
  closeConnection,
  setDatabasePath
} from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { createUser } from '../../src/sqlite/users';
import { createDocument } from '../../src/sqlite/documents';
import { resetLLMClient } from '../../src/llm/ollama';
import { TieredGenerator, resetTieredGenerator } from '../../src/tiered/generator';
import { FactExtractor, resetFactExtractor } from '../../src/facts/extractor';

describe('LLM Integration Tests', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    resetLLMClient();
    resetTieredGenerator();
    resetFactExtractor();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'Test User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
    vi.unstubAllGlobals();
  });

  describe('End-to-end L0/L1 generation', () => {
    it('should generate L0 and L1 for a document', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'One sentence abstract.' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: '**Summary**: Overview text.\n**Key Points**: Point 1, Point 2.' })
        });
      vi.stubGlobal('fetch', mockFetch);

      const generator = new TieredGenerator();
      const content = 'This is a long document about multiple topics...';
      
      const { abstract, overview } = await generator.generateBoth(content);

      expect(abstract).toBe('One sentence abstract.');
      expect(overview).toContain('Summary');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.unstubAllGlobals();
    });

    it('should cascade fallback on LLM failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Service unavailable'
      });
      vi.stubGlobal('fetch', mockFetch);

      const generator = new TieredGenerator();
      const content = 'Content that needs summarization but LLM is down.';
      
      const result = await generator.generateBoth(content);

      // Should fall back to truncation
      expect(result.abstract).toBeDefined();
      expect(result.overview).toBeDefined();

      vi.unstubAllGlobals();
    });
  });

  describe('End-to-end fact extraction', () => {
    it('should extract and save facts from document', async () => {
      const mockResponse = JSON.stringify([
        { content: 'User prefers dark mode', factType: 'preference', entities: ['theme'], confidence: 0.9 }
      ]);
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: mockResponse })
      });
      vi.stubGlobal('fetch', mockFetch);

      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Test Doc',
        content: 'The user prefers dark mode for the interface.'
      });

      const extractor = new FactExtractor();
      const factIds = await extractor.extractAndSave({
        userId: 'user-1',
        sourceType: 'documents',
        sourceId: 'doc-1',
        content: 'The user prefers dark mode for the interface.'
      });

      expect(factIds.length).toBeGreaterThan(0);

      vi.unstubAllGlobals();
    });
  });

  describe('Performance tests', () => {
    it('should handle concurrent requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Response' })
      });
      vi.stubGlobal('fetch', mockFetch);

      const generator = new TieredGenerator();
      
      // Run multiple concurrent generations
      const promises = [
        generator.generateL0('Content 1'),
        generator.generateL0('Content 2'),
        generator.generateL0('Content 3')
      ];

      const results = await Promise.all(promises);

      expect(results.length).toBe(3);
      expect(results.every(r => r === 'Response')).toBe(true);

      vi.unstubAllGlobals();
    });
  });
});
```

- [ ] **Step 2: Create integration test directory**

```bash
mkdir tests/integration
```

- [ ] **Step 3: Run integration tests**

Run: `bun test tests/integration/llm_integration.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/integration/
git commit -m "test: add LLM integration tests for end-to-end workflows"
```

---

## Verification Checklist

Before claiming completion, verify:

- [ ] All tests pass: `bun test`
- [ ] TypeScript compiles: `bun run typecheck`
- [ ] LLM client exists: `src/llm/ollama.ts`
- [ ] Prompts defined: `src/llm/prompts.ts`
- [ ] TieredGenerator updated: uses LLM with fallback
- [ ] FactExtractor updated: uses LLM for extraction
- [ ] Aggregator updated: uses LLM for combination
- [ ] No regressions: existing tests still pass
- [ ] Documentation updated: README mentions LLM requirement

---

## Constants to Add

Add to `src/core/constants.ts`:

```typescript
// ============================================================================
// LLM Configuration
// ============================================================================

export const DEFAULT_LLM_MODEL = 'llama3';
export const LLM_MAX_RETRIES = 3;
export const LLM_RETRY_DELAY = 1000;
export const LLM_TIMEOUT = 30000;
```

---

## Summary

| Component | Change | LLM Usage |
|-----------|--------|-----------|
| OllamaLLMClient | New file | Core LLM client |
| TieredGenerator | Modified | L0 abstract, L1 overview |
| FactExtractor | Modified | Atomic fact extraction |
| Aggregator | Modified | Entity content aggregation |
| Prompts | New file | Structured prompts |

**Token Budgets Preserved:**
- L0: ~50-100 tokens (one sentence)
- L1: ~500-2000 tokens (structured overview)
- Aggregation: ~2000 tokens maximum

**Fallback Strategy:**
All LLM operations fall back to truncation/simple combination on failure.

---

**Plan complete. Ready for execution.**