/**
 * @file tests/llm/prompts.test.ts
 * @description Prompt templates tests (TDD)
 */

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

    it('should handle empty content', () => {
      const prompt = buildL1OverviewPrompt('');
      expect(prompt).toBeDefined();
      expect(prompt).toContain('(empty)');
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
      
      expect(prompt).toContain('0.0');
      expect(prompt).toContain('1.0');
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