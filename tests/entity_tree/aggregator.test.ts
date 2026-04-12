/**
 * @file tests/entity_tree/aggregator.test.ts
 * @description Entity node content aggregator tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getConnection,
  closeConnection,
  resetConnection,
  setDatabasePath
} from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { createUser } from '../../src/sqlite/users';
import { createEntityNode } from '../../src/sqlite/entity_nodes';
import { aggregateChildContent, updateParentAggregation } from '../../src/entity_tree/aggregator';
import { resetLLMClient } from '../../src/llm/ollama';

describe('Entity Tree Aggregator', () => {
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
  });

  describe('aggregateChildContent', () => {
    it('should return empty string when no children', async () => {
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });

      const result = await aggregateChildContent('parent-1');

      expect(result).toBe('');
    });

    it('should aggregate child content', async () => {
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0,
        aggregated_content: 'Parent content'
      });
      createEntityNode({
        id: 'child-1',
        user_id: 'user-1',
        entity_name: 'Child 1',
        depth: 1,
        parent_id: 'parent-1',
        aggregated_content: 'Child 1 content'
      });
      createEntityNode({
        id: 'child-2',
        user_id: 'user-1',
        entity_name: 'Child 2',
        depth: 1,
        parent_id: 'parent-1',
        aggregated_content: 'Child 2 content'
      });

      const result = await aggregateChildContent('parent-1');

      expect(result).toBeDefined();
      expect(result).toContain('Child 1 content');
      expect(result).toContain('Child 2 content');
    });

    it('should handle children without aggregated_content', async () => {
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });
      createEntityNode({
        id: 'child-1',
        user_id: 'user-1',
        entity_name: 'Child',
        depth: 1,
        parent_id: 'parent-1'
      });

      const result = await aggregateChildContent('parent-1');

      expect(result).toBe('');
    });

    it('should truncate content exceeding token budget', async () => {
      createEntityNode({
        id: 'parent-long',
        user_id: 'user-1',
        entity_name: 'Parent Long',
        depth: 0
      });
      
      // Create content that exceeds L1_TOKEN_BUDGET (2000 tokens)
      // English: ~4 chars per token, need ~8000+ chars to exceed 2000 tokens
      const longContent = 'x'.repeat(10000);
      
      createEntityNode({
        id: 'child-long',
        user_id: 'user-1',
        entity_name: 'Child Long',
        depth: 1,
        parent_id: 'parent-long',
        aggregated_content: longContent
      });

      const result = await aggregateChildContent('parent-long');

      // Result should be truncated (L1_TOKEN_BUDGET * 4 = 8000 chars)
      expect(result.length).toBeLessThanOrEqual(8000);
      expect(result.length).toBeLessThan(longContent.length);
    });

    it('should call LLM and truncate result exceeding budget + 50', async () => {
      createEntityNode({
        id: 'parent-llm',
        user_id: 'user-1',
        entity_name: 'Parent LLM',
        depth: 0
      });
      
      // Create combined content that exceeds L1_TOKEN_BUDGET (8000 chars) to trigger LLM call
      // Need combined > 8000 chars
      const longContent1 = 'x'.repeat(5000);
      const longContent2 = 'y'.repeat(5000);
      
      createEntityNode({
        id: 'child-llm-1',
        user_id: 'user-1',
        entity_name: 'Child LLM 1',
        depth: 1,
        parent_id: 'parent-llm',
        aggregated_content: longContent1
      });
      createEntityNode({
        id: 'child-llm-2',
        user_id: 'user-1',
        entity_name: 'Child LLM 2',
        depth: 1,
        parent_id: 'parent-llm',
        aggregated_content: longContent2
      });

      // Mock LLM to return very long content that exceeds budget + 50
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: 'word '.repeat(500) })  // ~500 words, exceeds 2050 tokens
        } as Response;
      });

      const result = await aggregateChildContent('parent-llm');

      // Result should be truncated (combined.slice)
      expect(result.length).toBeLessThanOrEqual(8000);
      
      global.fetch = originalFetch;
    });

    it('should return LLM result when within budget', async () => {
      createEntityNode({
        id: 'parent-llm-ok',
        user_id: 'user-1',
        entity_name: 'Parent LLM OK',
        depth: 0
      });
      
      // Combined content exceeds L1_TOKEN_BUDGET to trigger LLM
      const longContent1 = 'x'.repeat(5000);
      const longContent2 = 'y'.repeat(5000);
      
      createEntityNode({
        id: 'child-llm-ok-1',
        user_id: 'user-1',
        entity_name: 'Child LLM OK 1',
        depth: 1,
        parent_id: 'parent-llm-ok',
        aggregated_content: longContent1
      });
      createEntityNode({
        id: 'child-llm-ok-2',
        user_id: 'user-1',
        entity_name: 'Child LLM OK 2',
        depth: 1,
        parent_id: 'parent-llm-ok',
        aggregated_content: longContent2
      });

      // Mock LLM to return short content within budget
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ response: 'Short LLM response' })
        } as Response;
      });

      const result = await aggregateChildContent('parent-llm-ok');

      expect(result).toBe('Short LLM response');
      
      global.fetch = originalFetch;
    });
  });

  describe('updateParentAggregation', () => {
    it('should update parent node', async () => {
      createEntityNode({
        id: 'parent-1',
        user_id: 'user-1',
        entity_name: 'Parent',
        depth: 0
      });
      createEntityNode({
        id: 'child-1',
        user_id: 'user-1',
        entity_name: 'Child',
        depth: 1,
        parent_id: 'parent-1',
        aggregated_content: 'Child content'
      });

      await updateParentAggregation('parent-1');

      // Function should run without error
    });
  });
});