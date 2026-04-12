/**
 * @file tests/sqlite/facts.test.ts
 * @description Facts table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createFact,
  getFactById,
  getFactsByScope,
  getFactsBySource,
  updateFact,
  deleteFact,
  searchFacts,
  FactRecord
} from '../../src/sqlite/facts';
import { createUser } from '../../src/sqlite/users';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Facts Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('createFact', () => {
    it('should create fact', () => {
      const fact = createFact({
        id: 'fact-1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'User prefers dark theme',
        fact_type: 'preference',
        entities: '["user-1", "theme"]'
      });
      
      expect(fact).toBeDefined();
      expect(fact.id).toBe('fact-1');
      expect(fact.fact_type).toBe('preference');
      expect(fact.content).toBe('User prefers dark theme');
    });

    it('should set default importance and confidence', () => {
      const fact = createFact({
        id: 'fact-2',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2',
        content: 'Test fact',
        fact_type: 'observation',
        entities: '[]'
      });
      
      expect(fact.importance).toBe(0.5);
      expect(fact.confidence).toBe(0.8);
    });
  });

  describe('getFactById', () => {
    it('should get fact by id', () => {
      createFact({
        id: 'fact-3',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-3',
        content: 'Get test',
        fact_type: 'decision',
        entities: '[]'
      });
      
      const fact = getFactById('fact-3');
      
      expect(fact).toBeDefined();
      expect(fact?.content).toBe('Get test');
    });
  });

  describe('getFactsByScope', () => {
    it('should get facts by user', () => {
      createFact({
        id: 'fact-4',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-4',
        content: 'Scope fact',
        fact_type: 'preference',
        entities: '[]'
      });
      
      const facts = getFactsByScope({ userId: 'user-1' });
      
      expect(facts.length).toBe(1);
    });

    it('should get facts by agent scope', () => {
      createFact({
        id: 'fact-agent',
        user_id: 'user-1',
        agent_id: 'agent-1',
        source_type: 'documents',
        source_id: 'doc-agent',
        content: 'Agent fact',
        fact_type: 'preference',
        entities: '[]'
      });
      createFact({
        id: 'fact-no-agent',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-no-agent',
        content: 'No agent fact',
        fact_type: 'preference',
        entities: '[]'
      });
      
      const facts = getFactsByScope({ userId: 'user-1', agentId: 'agent-1' });
      
      expect(facts.length).toBe(1);
      expect(facts[0].agent_id).toBe('agent-1');
    });

    it('should get facts by team scope', () => {
      createFact({
        id: 'fact-team',
        user_id: 'user-1',
        team_id: 'team-1',
        source_type: 'documents',
        source_id: 'doc-team',
        content: 'Team fact',
        fact_type: 'preference',
        entities: '[]'
      });
      createFact({
        id: 'fact-no-team',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-no-team',
        content: 'No team fact',
        fact_type: 'preference',
        entities: '[]'
      });
      
      const facts = getFactsByScope({ userId: 'user-1', teamId: 'team-1' });
      
      expect(facts.length).toBe(1);
      expect(facts[0].team_id).toBe('team-1');
    });
  });

  describe('getFactsBySource', () => {
    it('should get facts by source', () => {
      createFact({
        id: 'fact-5',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-5',
        content: 'Source fact',
        fact_type: 'observation',
        entities: '[]'
      });
      
      const facts = getFactsBySource('documents', 'doc-5');
      
      expect(facts.length).toBe(1);
    });
  });

  describe('updateFact', () => {
    it('should update fact', () => {
      createFact({
        id: 'fact-6',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-6',
        content: 'Original',
        fact_type: 'preference',
        entities: '[]'
      });
      
      const updated = updateFact('fact-6', {
        verified: true,
        confidence: 0.95
      });
      
      expect(updated?.verified).toBe(1);
      expect(updated?.confidence).toBe(0.95);
    });
  });

  describe('deleteFact', () => {
    it('should delete fact', () => {
      createFact({
        id: 'fact-7',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-7',
        content: 'Delete fact',
        fact_type: 'conclusion',
        entities: '[]'
      });
      
      const result = deleteFact('fact-7');
      
      expect(result).toBe(true);
    });
  });

  describe('searchFacts', () => {
    it('should search by fact type', () => {
      createFact({
        id: 'fact-8',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-8',
        content: 'Preference fact',
        fact_type: 'preference',
        entities: '[]'
      });
      createFact({
        id: 'fact-9',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-9',
        content: 'Decision fact',
        fact_type: 'decision',
        entities: '[]'
      });
      
      const facts = searchFacts({ fact_type: 'preference' });
      
      expect(facts.length).toBe(1);
    });

    it('should search by verified true', () => {
      createFact({
        id: 'fact-verified',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-v',
        content: 'Verified fact',
        fact_type: 'observation',
        entities: '[]',
        verified: true
      });
      createFact({
        id: 'fact-unverified',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-u',
        content: 'Unverified fact',
        fact_type: 'observation',
        entities: '[]',
        verified: false
      });
      
      const facts = searchFacts({ verified: true });
      
      expect(facts.length).toBe(1);
      expect(facts[0].verified).toBeTruthy();
    });

    it('should search by verified false', () => {
      createFact({
        id: 'fact-v2',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-v2',
        content: 'Verified fact 2',
        fact_type: 'observation',
        entities: '[]',
        verified: true
      });
      createFact({
        id: 'fact-u2',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-u2',
        content: 'Unverified fact 2',
        fact_type: 'observation',
        entities: '[]',
        verified: false
      });
      
      const facts = searchFacts({ verified: false });
      
      expect(facts.length).toBe(1);
      expect(facts[0].verified).toBeFalsy();
    });

    it('should search by confidence_min', () => {
      createFact({
        id: 'fact-high',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-high',
        content: 'High confidence fact',
        fact_type: 'observation',
        entities: '[]',
        confidence: 0.95
      });
      createFact({
        id: 'fact-low',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-low',
        content: 'Low confidence fact',
        fact_type: 'observation',
        entities: '[]',
        confidence: 0.5
      });
      
      const facts = searchFacts({ confidence_min: 0.8 });
      
      expect(facts.length).toBe(1);
      expect(facts[0].confidence).toBeGreaterThanOrEqual(0.8);
    });
  });
});