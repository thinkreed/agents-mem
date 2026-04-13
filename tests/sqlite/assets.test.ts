/**
 * @file tests/sqlite/assets.test.ts
 * @description Assets table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createAsset,
  getAssetById,
  getAssetsByScope,
  updateAsset,
  deleteAsset,
  searchAssets,
  AssetRecord
} from '../../src/sqlite/assets';
import { createUser } from '../../src/sqlite/users';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Assets Table', () => {
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

  describe('createAsset', () => {
    it('should create asset', () => {
      const asset = createAsset({
        id: 'asset-1',
        user_id: 'user-1',
        filename: 'test.pdf',
        file_type: 'pdf',
        file_size: 1024,
        storage_path: '/storage/test.pdf'
      });
      
      expect(asset).toBeDefined();
      expect(asset.id).toBe('asset-1');
      expect(asset.filename).toBe('test.pdf');
      expect(asset.file_size).toBe(1024);
    });

    it('should create asset with extracted text', () => {
      const asset = createAsset({
        id: 'asset-2',
        user_id: 'user-1',
        filename: 'document.txt',
        file_type: 'txt',
        file_size: 100,
        storage_path: '/storage/document.txt',
        extracted_text: 'Extracted content'
      });
      
      expect(asset.extracted_text).toBe('Extracted content');
    });
  });

  describe('getAssetById', () => {
    it('should get asset by id', () => {
      createAsset({
        id: 'asset-3',
        user_id: 'user-1',
        filename: 'get.pdf',
        file_type: 'pdf',
        file_size: 512,
        storage_path: '/storage/get.pdf'
      });
      
      const asset = getAssetById('asset-3');
      
      expect(asset).toBeDefined();
      expect(asset?.filename).toBe('get.pdf');
    });
  });

  describe('getAssetsByScope', () => {
    it('should get assets by user', () => {
      createAsset({
        id: 'asset-4',
        user_id: 'user-1',
        filename: 'scope.pdf',
        file_type: 'pdf',
        file_size: 256,
        storage_path: '/storage/scope.pdf'
      });
      
      const assets = getAssetsByScope({ userId: 'user-1' });
      
      expect(assets.length).toBe(1);
    });

    it('should get assets by user with agent scope', () => {
      createAsset({
        id: 'asset-agent',
        user_id: 'user-1',
        agent_id: 'agent-1',
        filename: 'agent-scope.pdf',
        file_type: 'pdf',
        file_size: 256,
        storage_path: '/storage/agent-scope.pdf'
      });
      
      createAsset({
        id: 'asset-no-agent',
        user_id: 'user-1',
        filename: 'no-agent.pdf',
        file_type: 'pdf',
        file_size: 256,
        storage_path: '/storage/no-agent.pdf'
      });
      
      const assets = getAssetsByScope({ userId: 'user-1', agentId: 'agent-1' });
      
      expect(assets.length).toBe(1);
      expect(assets[0].agent_id).toBe('agent-1');
    });

    it('should get assets by user with team scope', () => {
      createAsset({
        id: 'asset-team',
        user_id: 'user-1',
        team_id: 'team-1',
        filename: 'team-scope.pdf',
        file_type: 'pdf',
        file_size: 256,
        storage_path: '/storage/team-scope.pdf'
      });
      
      createAsset({
        id: 'asset-no-team',
        user_id: 'user-1',
        filename: 'no-team.pdf',
        file_type: 'pdf',
        file_size: 256,
        storage_path: '/storage/no-team.pdf'
      });
      
      const assets = getAssetsByScope({ userId: 'user-1', teamId: 'team-1' });
      
      expect(assets.length).toBe(1);
      expect(assets[0].team_id).toBe('team-1');
    });
  });

  describe('updateAsset', () => {
    it('should update asset', () => {
      createAsset({
        id: 'asset-5',
        user_id: 'user-1',
        filename: 'update.pdf',
        file_type: 'pdf',
        file_size: 128,
        storage_path: '/storage/update.pdf'
      });
      
      const updated = updateAsset('asset-5', {
        title: 'Updated Title',
        text_extracted: true
      });
      
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.text_extracted).toBe(1);
    });

    it('should update asset with extracted_text and infer text_extracted', () => {
      createAsset({
        id: 'asset-text',
        user_id: 'user-1',
        filename: 'text.pdf',
        file_type: 'pdf',
        file_size: 256,
        storage_path: '/storage/text.pdf',
        text_extracted: false
      });
      
      // When extracted_text is provided, text_extracted should be inferred as true
      const updated = updateAsset('asset-text', {
        extracted_text: 'Extracted content here'
      });
      
      expect(updated?.extracted_text).toBe('Extracted content here');
      expect(updated?.text_extracted).toBeTruthy(); // inferred true from extracted_text
    });

    it('should update multiple fields', () => {
      createAsset({
        id: 'asset-multi',
        user_id: 'user-1',
        filename: 'multi.pdf',
        file_type: 'pdf',
        file_size: 512,
        storage_path: '/storage/multi.pdf',
        title: 'Original Title',
        description: 'Original Description',
        metadata: '{"original": true}'
      });
      
      const updated = updateAsset('asset-multi', {
        title: 'New Title',
        description: 'New Description',
        metadata: '{"updated": true}',
        openviking_uri: 'viking://default/user-1/resources/assets/asset-multi'
      });
      
      expect(updated?.title).toBe('New Title');
      expect(updated?.description).toBe('New Description');
      expect(updated?.metadata).toBe('{"updated": true}');
      expect(updated?.openviking_uri).toBe('viking://default/user-1/resources/assets/asset-multi');
    });
  });

  describe('deleteAsset', () => {
    it('should delete asset', () => {
      createAsset({
        id: 'asset-6',
        user_id: 'user-1',
        filename: 'delete.pdf',
        file_type: 'pdf',
        file_size: 64,
        storage_path: '/storage/delete.pdf'
      });
      
      const result = deleteAsset('asset-6');
      
      expect(result).toBe(true);
    });
  });

  describe('searchAssets', () => {
    it('should search by file type', () => {
      createAsset({
        id: 'asset-7',
        user_id: 'user-1',
        filename: 'image.png',
        file_type: 'png',
        file_size: 2048,
        storage_path: '/storage/image.png'
      });
      
      const assets = searchAssets({ file_type: 'png' });
      
      expect(assets.length).toBe(1);
    });
  });
});