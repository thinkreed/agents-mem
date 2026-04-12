/**
 * @file tests/sqlite/extraction_status.test.ts
 * @description Extraction status table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createExtractionStatus,
  getExtractionStatus,
  getExtractionStatusByTarget,
  updateExtractionStatus,
  deleteExtractionStatus,
  getPendingExtractions,
  ExtractionStatusRecord
} from '../../src/sqlite/extraction_status';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Extraction Status Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('createExtractionStatus', () => {
    it('should create extraction status', () => {
      const status = createExtractionStatus({
        target_type: 'documents',
        target_id: 'doc-1'
      });
      
      expect(status).toBeDefined();
      expect(status.target_type).toBe('documents');
      expect(status.target_id).toBe('doc-1');
      expect(status.status).toBe('pending');
    });

    it('should create with extraction mode', () => {
      const status = createExtractionStatus({
        target_type: 'messages',
        target_id: 'msg-1',
        extraction_mode: 'async_batch'
      });
      
      expect(status.extraction_mode).toBe('async_batch');
    });
  });

  describe('getExtractionStatus', () => {
    it('should get status by id', () => {
      const created = createExtractionStatus({
        target_type: 'documents',
        target_id: 'doc-2'
      });
      
      const status = getExtractionStatus(created.id);
      
      expect(status).toBeDefined();
      expect(status?.target_id).toBe('doc-2');
    });
  });

  describe('getExtractionStatusByTarget', () => {
    it('should get status by target', () => {
      createExtractionStatus({
        target_type: 'documents',
        target_id: 'doc-3'
      });
      
      const status = getExtractionStatusByTarget('documents', 'doc-3');
      
      expect(status).toBeDefined();
    });
  });

  describe('updateExtractionStatus', () => {
    it('should update status', () => {
      const created = createExtractionStatus({
        target_type: 'documents',
        target_id: 'doc-4'
      });
      
      const now = Math.floor(Date.now() / 1000);
      const updated = updateExtractionStatus(created.id, {
        status: 'completed',
        facts_count: 5,
        entities_count: 3,
        completed_at: now
      });
      
      expect(updated?.status).toBe('completed');
      expect(updated?.facts_count).toBe(5);
    });

    it('should update to failed status', () => {
      const created = createExtractionStatus({
        target_type: 'documents',
        target_id: 'doc-5'
      });
      
      const updated = updateExtractionStatus(created.id, {
        status: 'failed',
        error_message: 'Connection error'
      });
      
      expect(updated?.status).toBe('failed');
      expect(updated?.error_message).toBe('Connection error');
    });
  });

  describe('getPendingExtractions', () => {
    it('should get pending extractions', () => {
      createExtractionStatus({
        target_type: 'documents',
        target_id: 'doc-6'
      });
      createExtractionStatus({
        target_type: 'documents',
        target_id: 'doc-7'
      });
      const completed = createExtractionStatus({
        target_type: 'documents',
        target_id: 'doc-8'
      });
      updateExtractionStatus(completed.id, { status: 'completed' });
      
      const pending = getPendingExtractions();
      
      expect(pending.length).toBe(2);
    });
  });

  describe('deleteExtractionStatus', () => {
    it('should delete status', () => {
      const created = createExtractionStatus({
        target_type: 'documents',
        target_id: 'doc-9'
      });
      
      const result = deleteExtractionStatus(created.id);
      
      expect(result).toBe(true);
    });
  });
});