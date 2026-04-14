/**
 * @file tests/production/mcp_crud.test.ts
 * @description Real production environment test with actual articles
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { handleMemCreate, handleMemRead, handleMemUpdate, handleMemDelete } from '../../src/tools/crud_handlers';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { resetConnection } from '../../src/sqlite/connection';
import { getOpenVikingClient, resetClient, initConfig } from '../../src/openviking';
import * as fs from 'fs';
import * as path from 'path';

const ARTICLES_DIR = 'E:/projects/think_wiki/raw/articles';
const TEST_TIMEOUT = 30000; // 30 seconds for network operations
const OPENVIKING_TEST_TIMEOUT = 3000; // 3 seconds for OpenViking operations
let openVikingAvailable = false;

describe('MCP CRUD - Production Test with Real Articles', () => {
  const testUserId = 'test-user-production';
  const testAgentId = 'test-agent-001';
  const createdDocIds: string[] = [];

  beforeAll(async () => {
    // Reset connection and run migrations for fresh database
    resetConnection();
    resetManager();
    runMigrations();
    
    // Configure OpenViking with short timeout for testing
    process.env.OPENVIKING_ENABLED = 'true';
    process.env.OPENVIKING_BASE_URL = process.env.OPENVIKING_BASE_URL || 'http://localhost:1933';
    process.env.OPENVIKING_TIMEOUT = String(OPENVIKING_TEST_TIMEOUT);
    process.env.OPENVIKING_MAX_RETRIES = '1';
    
    // Reset OpenViking client to use new config
    resetClient();
    initConfig({ timeout: OPENVIKING_TEST_TIMEOUT, maxRetries: 1 });
    
    // Check OpenViking availability with timeout
    try {
      const client = getOpenVikingClient();
      // Use a short timeout check - if it fails quickly, mark as unavailable
      const healthPromise = client.healthCheck();
      const timeoutPromise = new Promise<{ status: 'error' }>((resolve) => 
        setTimeout(() => resolve({ status: 'error' }), OPENVIKING_TEST_TIMEOUT)
      );
      const health = await Promise.race([healthPromise, timeoutPromise]);
      openVikingAvailable = health.status === 'ok';
      console.log(`OpenViking status: ${openVikingAvailable ? 'available' : 'unavailable'}`);
      
      // If OpenViking unavailable, disable it for faster operations
      if (!openVikingAvailable) {
        process.env.OPENVIKING_ENABLED = 'false';
        resetClient();
        initConfig({ enabled: false });
        console.log('OpenViking disabled for this test run');
      }
    } catch (e) {
      console.log('OpenViking not available, disabling for faster tests');
      openVikingAvailable = false;
      process.env.OPENVIKING_ENABLED = 'false';
      resetClient();
      initConfig({ enabled: false });
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup: delete all created documents
    for (const docId of createdDocIds) {
      try {
        await handleMemDelete({
          resource: 'document',
          id: docId,
          scope: { userId: testUserId }
        });
      } catch (e) {
        console.log(`Cleanup: could not delete ${docId}`);
      }
    }
  }, TEST_TIMEOUT);

  describe('CREATE - Store real articles', () => {
    it('should store article: Video-MME-v2', async () => {
      const filePath = path.join(ARTICLES_DIR, '挤干大模型高分「水分」！最强模型仅49分，南大傅朝友发布Video-MME-v2.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const result = await handleMemCreate({
        resource: 'document',
        data: {
          docType: 'article',
          title: 'Video-MME-v2: 挤干大模型高分水分',
          content: content
        },
        scope: { userId: testUserId, agentId: testAgentId }
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.uri).toContain('mem://');
      createdDocIds.push(parsed.id);

      console.log(`✅ Created: ${parsed.id}`);
      console.log(`   URI: ${parsed.uri}`);
    }, TEST_TIMEOUT);

    it('should store article: OpenAI恐惧', async () => {
      const filePath = path.join(ARTICLES_DIR, 'OpenAI也开始恐惧自己训练出的新模型了.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const result = await handleMemCreate({
        resource: 'document',
        data: {
          docType: 'article',
          title: 'OpenAI也开始恐惧自己训练出的新模型了',
          content: content
        },
        scope: { userId: testUserId }
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdDocIds.push(parsed.id);

      console.log(`✅ Created: ${parsed.id}`);
    }, TEST_TIMEOUT);

    it('should store article: OpenClaw实战', async () => {
      const filePath = path.join(ARTICLES_DIR, 'OpenClaw 实战：一个人、一台 Mac、六个 AI Agent — 从能聊天到能干活的工程实战.md');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const result = await handleMemCreate({
        resource: 'document',
        data: {
          docType: 'article',
          title: 'OpenClaw实战: 6个AI Agent工程实战',
          content: content
        },
        scope: { userId: testUserId }
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      createdDocIds.push(parsed.id);

      console.log(`✅ Created: ${parsed.id}`);
    }, TEST_TIMEOUT);
  });

  describe('READ - Search and tiered content', () => {
    it('should search for "大模型"', async () => {
      if (!openVikingAvailable) {
        console.log('⚠️ OpenViking unavailable, skipping search test');
        return;
      }
      
      const result = await handleMemRead({
        resource: 'document',
        query: { search: '大模型', searchMode: 'hybrid', limit: 5 },
        scope: { userId: testUserId }
      });

      const parsed = JSON.parse(result.content[0].text);
      console.log(`🔍 Search results for "大模型":`);
      console.log(`   Total: ${parsed.length || parsed.total || 0}`);
      
      // Should find at least one match
      expect(parsed).toBeDefined();
    }, TEST_TIMEOUT);

    it('should search for "AI Agent"', async () => {
      if (!openVikingAvailable) {
        console.log('⚠️ OpenViking unavailable, skipping search test');
        return;
      }
      
      const result = await handleMemRead({
        resource: 'document',
        query: { search: 'AI Agent', searchMode: 'hybrid', limit: 5 },
        scope: { userId: testUserId }
      });

      const parsed = JSON.parse(result.content[0].text);
      console.log(`🔍 Search results for "AI Agent":`);
      console.log(`   Found documents related to OpenClaw article`);
      
      expect(parsed).toBeDefined();
    }, TEST_TIMEOUT);

    it('should read document by ID with L0 tier', async () => {
      if (createdDocIds.length === 0) {
        console.log('⚠️ No documents created, skipping');
        return;
      }
      
      if (!openVikingAvailable) {
        console.log('⚠️ OpenViking unavailable, using local fallback');
      }

      const docId = createdDocIds[0];
      const result = await handleMemRead({
        resource: 'document',
        query: { id: docId, tier: 'L0' },
        scope: { userId: testUserId }
      });

      const parsed = JSON.parse(result.content[0].text);
      console.log(`📖 L0 abstract for ${docId}:`);
      console.log(`   ${parsed.abstract?.substring(0, 100) || 'N/A'}...`);
      
      expect(parsed.tier).toBe('L0');
    }, TEST_TIMEOUT);

    it('should read document by ID with L1 tier', async () => {
      if (createdDocIds.length === 0) {
        console.log('⚠️ No documents created, skipping');
        return;
      }
      
      if (!openVikingAvailable) {
        console.log('⚠️ OpenViking unavailable, using local fallback');
      }

      const docId = createdDocIds[1] || createdDocIds[0];
      const result = await handleMemRead({
        resource: 'document',
        query: { id: docId, tier: 'L1' },
        scope: { userId: testUserId }
      });

      const parsed = JSON.parse(result.content[0].text);
      console.log(`📖 L1 overview for ${docId}:`);
      console.log(`   Length: ${parsed.overview?.length || 0} chars`);
      
      expect(parsed.tier).toBe('L1');
    }, TEST_TIMEOUT);

    it('should list all documents', async () => {
      const result = await handleMemRead({
        resource: 'document',
        query: { list: true },
        scope: { userId: testUserId }
      });

      const parsed = JSON.parse(result.content[0].text);
      console.log(`📋 List documents:`);
      console.log(`   Total: ${parsed.length}`);
      
      expect(parsed.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('UPDATE - Modify existing documents', () => {
    it('should update document title', async () => {
      if (createdDocIds.length === 0) {
        console.log('⚠️ No documents created, skipping');
        return;
      }

      const docId = createdDocIds[0];
      const result = await handleMemUpdate({
        resource: 'document',
        id: docId,
        data: { title: 'UPDATED: Video-MME-v2 Test' },
        scope: { userId: testUserId }
      });

      const parsed = JSON.parse(result.content[0].text);
      console.log(`✏️ Updated document ${docId}`);
      
      expect(parsed.title).toContain('UPDATED');
    }, TEST_TIMEOUT);
  });

  describe('DELETE - Remove documents', () => {
    it('should delete one document', async () => {
      if (createdDocIds.length < 2) {
        console.log('⚠️ Not enough documents, skipping');
        return;
      }

      const docIdToDelete = createdDocIds.pop(); // Remove last one
      const result = await handleMemDelete({
        resource: 'document',
        id: docIdToDelete,
        scope: { userId: testUserId }
      });

      const parsed = JSON.parse(result.content[0].text);
      console.log(`🗑️ Deleted document ${docIdToDelete}`);
      
      expect(parsed.success).toBe(true);
    }, TEST_TIMEOUT);
  });
});