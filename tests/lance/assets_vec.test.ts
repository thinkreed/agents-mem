/**
 * @file tests/lance/assets_vec.test.ts
 * @description Assets vector table tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  addAssetVector,
  getAssetVector,
  deleteAssetVector,
  searchAssetVectors,
  countAssetVectors
} from '../../src/lance/assets_vec';
import { resetConnection, closeConnection, setDatabasePath, getConnection, createTable } from '../../src/lance/connection';
import { createAssetsVecSchema } from '../../src/lance/schema';

describe('Assets Vector Table', () => {
  const tempDir = path.join(os.tmpdir(), 'agents-mem-assets-test');
  
  beforeEach(async () => {
    resetConnection();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    setDatabasePath(tempDir);
    await getConnection();
    await createTable('assets_vec', createAssetsVecSchema());
  });

  afterEach(async () => {
    await closeConnection();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('addAssetVector', () => {
    it('should add asset vector', async () => {
      const vector = new Float32Array(768).fill(0.1);
      
      await addAssetVector({
        id: 'asset-1',
        content: 'Test asset description',
        vector: vector,
        user_id: 'user-1',
        title: 'Test Asset',
        asset_type: 'pdf',
        storage_path: '/path/to/file.pdf'
      });
      
      const result = await getAssetVector('asset-1');
      expect(result).toBeDefined();
    });

    it('should add with all fields', async () => {
      const vector = new Float32Array(768).fill(0.2);
      
      await addAssetVector({
        id: 'asset-2',
        content: 'Full asset description',
        vector: vector,
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-1',
        title: 'Full Asset',
        asset_type: 'image',
        storage_path: '/path/to/image.png'
      });
      
      const result = await getAssetVector('asset-2');
      expect(result).toBeDefined();
    });
  });

  describe('getAssetVector', () => {
    it('should get asset vector by id', async () => {
      const vector = new Float32Array(768).fill(0.3);
      await addAssetVector({
        id: 'asset-3',
        content: 'Get test',
        vector: vector,
        user_id: 'user-1',
        title: 'Get Asset',
        asset_type: 'pdf',
        storage_path: '/path/to/get.pdf'
      });
      
      const result = await getAssetVector('asset-3');
      
      expect(result).toBeDefined();
      expect(result?.id).toBe('asset-3');
    });

    it('should return undefined for non-existent', async () => {
      const result = await getAssetVector('non-existent');
      
      expect(result).toBeUndefined();
    });
  });

  describe('deleteAssetVector', () => {
    it('should delete asset vector', async () => {
      const vector = new Float32Array(768).fill(0.4);
      await addAssetVector({
        id: 'asset-4',
        content: 'Delete test',
        vector: vector,
        user_id: 'user-1',
        title: 'Delete Asset',
        asset_type: 'pdf',
        storage_path: '/path/to/delete.pdf'
      });
      
      await deleteAssetVector('asset-4');
      
      const result = await getAssetVector('asset-4');
      expect(result).toBeUndefined();
    });
  });

  describe('searchAssetVectors', () => {
    it('should search by vector similarity', async () => {
      const vector1 = new Float32Array(768).fill(0.5);
      const vector2 = new Float32Array(768).fill(0.6);
      
      await addAssetVector({
        id: 'asset-5',
        content: 'Search asset 1',
        vector: vector1,
        user_id: 'user-1',
        title: 'Search 1',
        asset_type: 'pdf',
        storage_path: '/path/to/search1.pdf'
      });
      
      await addAssetVector({
        id: 'asset-6',
        content: 'Search asset 2',
        vector: vector2,
        user_id: 'user-1',
        title: 'Search 2',
        asset_type: 'pdf',
        storage_path: '/path/to/search2.pdf'
      });
      
      const queryVector = new Float32Array(768).fill(0.55);
      const results = await searchAssetVectors(queryVector, 10);
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search with user scope', async () => {
      const vector = new Float32Array(768).fill(0.5);
      
      await addAssetVector({
        id: 'asset-user',
        content: 'User asset',
        vector: vector,
        user_id: 'user-1',
        title: 'User Asset',
        asset_type: 'pdf',
        storage_path: '/path/to/user.pdf'
      });
      
      await addAssetVector({
        id: 'asset-other-user',
        content: 'Other user asset',
        vector: vector,
        user_id: 'user-2',
        title: 'Other User Asset',
        asset_type: 'pdf',
        storage_path: '/path/to/other.pdf'
      });
      
      const queryVector = new Float32Array(768).fill(0.5);
      const results = await searchAssetVectors(queryVector, 10, { userId: 'user-1' });
      
      // Should return results filtered by user scope
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => expect(r.user_id).toBe('user-1'));
    });

    it('should search with agent scope', async () => {
      const vector = new Float32Array(768).fill(0.5);
      
      await addAssetVector({
        id: 'asset-agent',
        content: 'Agent asset',
        vector: vector,
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'Agent Asset',
        asset_type: 'pdf',
        storage_path: '/path/to/agent.pdf'
      });
      
      await addAssetVector({
        id: 'asset-no-agent',
        content: 'No agent asset',
        vector: vector,
        user_id: 'user-1',
        title: 'No Agent Asset',
        asset_type: 'pdf',
        storage_path: '/path/to/noagent.pdf'
      });
      
      const queryVector = new Float32Array(768).fill(0.5);
      const results = await searchAssetVectors(queryVector, 10, { userId: 'user-1', agentId: 'agent-1' });
      
      // Should return results filtered by agent scope
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search with team scope', async () => {
      const vector = new Float32Array(768).fill(0.5);
      
      await addAssetVector({
        id: 'asset-team',
        content: 'Team asset',
        vector: vector,
        user_id: 'user-1',
        team_id: 'team-1',
        title: 'Team Asset',
        asset_type: 'pdf',
        storage_path: '/path/to/team.pdf'
      });
      
      await addAssetVector({
        id: 'asset-no-team',
        content: 'No team asset',
        vector: vector,
        user_id: 'user-1',
        title: 'No Team Asset',
        asset_type: 'pdf',
        storage_path: '/path/to/notteam.pdf'
      });
      
      const queryVector = new Float32Array(768).fill(0.5);
      const results = await searchAssetVectors(queryVector, 10, { userId: 'user-1', teamId: 'team-1' });
      
      // Should return results filtered by team scope
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('countAssetVectors', () => {
    it('should count vectors', async () => {
      const vector = new Float32Array(768).fill(0.9);
      
      await addAssetVector({
        id: 'asset-8',
        content: 'Count 1',
        vector: vector,
        user_id: 'user-1',
        title: 'Count 1',
        asset_type: 'pdf',
        storage_path: '/path/to/count1.pdf'
      });
      
      await addAssetVector({
        id: 'asset-9',
        content: 'Count 2',
        vector: vector,
        user_id: 'user-1',
        title: 'Count 2',
        asset_type: 'pdf',
        storage_path: '/path/to/count2.pdf'
      });
      
      const count = await countAssetVectors();
      expect(count).toBeGreaterThan(0);
    });
  });
});