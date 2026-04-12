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