/**
 * @file tests/sqlite/tiered_content.test.ts
 * @description Tiered content table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTieredContent,
  getTieredContentById,
  getTieredContentBySource,
  updateTieredContent,
  deleteTieredContent,
  getTieredContentByScope,
  TieredContentRecord
} from '../../src/sqlite/tiered_content';
import { createUser } from '../../src/sqlite/users';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Tiered Content Table', () => {
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

  describe('createTieredContent', () => {
    it('should create tiered content', () => {
      const tiered = createTieredContent({
        id: 'tiered-1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        abstract: 'L0 abstract'
      });
      
      expect(tiered).toBeDefined();
      expect(tiered.id).toBe('tiered-1');
      expect(tiered.source_type).toBe('documents');
      expect(tiered.abstract).toBe('L0 abstract');
    });

    it('should create with L0 and L1', () => {
      const tiered = createTieredContent({
        id: 'tiered-2',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2',
        abstract: 'L0 abstract',
        overview: 'L1 overview',
        original_uri: 'mem://user-1/_/_/documents/doc-2'
      });
      
      expect(tiered.overview).toBe('L1 overview');
      expect(tiered.original_uri).toBe('mem://user-1/_/_/documents/doc-2');
    });
  });

  describe('getTieredContentById', () => {
    it('should get tiered content by id', () => {
      createTieredContent({
        id: 'tiered-3',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-3',
        abstract: 'Abstract'
      });
      
      const tiered = getTieredContentById('tiered-3');
      
      expect(tiered).toBeDefined();
      expect(tiered?.abstract).toBe('Abstract');
    });
  });

  describe('getTieredContentBySource', () => {
    it('should get by source', () => {
      createTieredContent({
        id: 'tiered-4',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-4',
        abstract: 'Abstract'
      });
      
      const tiered = getTieredContentBySource('documents', 'doc-4');
      
      expect(tiered).toBeDefined();
      expect(tiered?.id).toBe('tiered-4');
    });
  });

  describe('updateTieredContent', () => {
    it('should update tiered content', () => {
      createTieredContent({
        id: 'tiered-5',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-5',
        abstract: 'Original'
      });
      
      const updated = updateTieredContent('tiered-5', {
        overview: 'New overview',
        lance_id_l0: 'lance-l0-1',
        lance_id_l1: 'lance-l1-1'
      });
      
      expect(updated?.overview).toBe('New overview');
      expect(updated?.lance_id_l0).toBe('lance-l0-1');
    });
  });

  describe('deleteTieredContent', () => {
    it('should delete tiered content', () => {
      createTieredContent({
        id: 'tiered-6',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-6',
        abstract: 'Abstract'
      });
      
      const result = deleteTieredContent('tiered-6');
      
      expect(result).toBe(true);
    });
  });

  describe('getTieredContentByScope', () => {
    it('should get by scope', () => {
      createTieredContent({
        id: 'tiered-7',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-7',
        abstract: 'Abstract'
      });
      
      const tiereds = getTieredContentByScope({ userId: 'user-1' });
      
      expect(tiereds.length).toBe(1);
    });

    it('should get by agent scope', () => {
      createTieredContent({
        id: 'tiered-agent',
        user_id: 'user-1',
        agent_id: 'agent-1',
        source_type: 'documents',
        source_id: 'doc-agent',
        abstract: 'Agent Abstract'
      });
      createTieredContent({
        id: 'tiered-no-agent',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-no-agent',
        abstract: 'No Agent Abstract'
      });
      
      const tiereds = getTieredContentByScope({ userId: 'user-1', agentId: 'agent-1' });
      
      expect(tiereds.length).toBe(1);
      expect(tiereds[0].agent_id).toBe('agent-1');
    });

    it('should get by team scope', () => {
      createTieredContent({
        id: 'tiered-team',
        user_id: 'user-1',
        team_id: 'team-1',
        source_type: 'documents',
        source_id: 'doc-team',
        abstract: 'Team Abstract'
      });
      createTieredContent({
        id: 'tiered-no-team',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-no-team',
        abstract: 'No Team Abstract'
      });
      
      const tiereds = getTieredContentByScope({ userId: 'user-1', teamId: 'team-1' });
      
      expect(tiereds.length).toBe(1);
      expect(tiereds[0].team_id).toBe('team-1');
    });
  });
});