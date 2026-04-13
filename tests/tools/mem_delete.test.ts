/**
 * @file tests/tools/mem_delete.test.ts
 * @description TDD tests for mem_delete CRUD tool with vector cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// SQLite mocks
vi.mock('../../src/sqlite/documents', () => ({
  getDocumentById: vi.fn(),
  deleteDocument: vi.fn()
}));

vi.mock('../../src/sqlite/assets', () => ({
  getAssetById: vi.fn(),
  deleteAsset: vi.fn()
}));

// OpenViking mock
const mockDelete = vi.fn().mockResolvedValue({ success: true });
const mockHealthCheck = vi.fn().mockResolvedValue({ status: 'ok' });
const mockClient = {
  delete: mockDelete,
  healthCheck: mockHealthCheck,
};

vi.mock('../../src/openviking', () => ({
  getOpenVikingClient: vi.fn(() => mockClient),
  getScopeMapper: vi.fn(() => ({
    mapToVikingTarget: vi.fn().mockReturnValue('viking://default/user/resources')
  })),
  getURIAdapter: vi.fn(() => ({
    toVikingURI: vi.fn().mockReturnValue('viking://default/user/resources/documents/doc-123')
  }))
}));

vi.mock('../../src/sqlite/conversations', () => ({
  getConversationById: vi.fn(),
  deleteConversation: vi.fn()
}));

vi.mock('../../src/sqlite/messages', () => ({
  getMessageById: vi.fn(),
  deleteMessage: vi.fn(),
  deleteMessagesByConversation: vi.fn()
}));

vi.mock('../../src/sqlite/facts', () => ({
  getFactById: vi.fn(),
  deleteFact: vi.fn()
}));

vi.mock('../../src/sqlite/teams', () => ({
  getTeamById: vi.fn(),
  deleteTeam: vi.fn()
}));

vi.mock('../../src/sqlite/team_members', () => ({
  deleteTeamMembersByTeam: vi.fn()
}));

vi.mock('../../src/sqlite/memory_index', () => ({
  deleteMemoryIndexByTarget: vi.fn()
}));

// Import mocked SQLite modules
import { getDocumentById, deleteDocument } from '../../src/sqlite/documents';
import { getAssetById, deleteAsset } from '../../src/sqlite/assets';
import { getConversationById, deleteConversation } from '../../src/sqlite/conversations';
import { getMessageById, deleteMessage, deleteMessagesByConversation } from '../../src/sqlite/messages';
import { getFactById, deleteFact } from '../../src/sqlite/facts';
import { getTeamById, deleteTeam } from '../../src/sqlite/teams';
import { deleteTeamMembersByTeam } from '../../src/sqlite/team_members';
import { deleteMemoryIndexByTarget } from '../../src/sqlite/memory_index';

// Import OpenViking mock
import { getOpenVikingClient, getScopeMapper, getURIAdapter } from '../../src/openviking';

// Import the actual handler
import { handleMemDelete } from '../../src/tools/crud_handlers';

const getHandler = () => handleMemDelete;

describe('mem_delete tool', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe('document resource', () => {
    it('should delete document', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', user_id: 'user-1' });
      (deleteDocument as Mock).mockReturnValue(true);
      (deleteMemoryIndexByTarget as Mock).mockReturnValue(undefined);
      const result = await getHandler()({
        resource: 'document',
        id: 'doc-1',
        scope: { userId: 'user-1' }
      });
      expect(deleteDocument).toHaveBeenCalledWith('doc-1');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    // TDD test for vector cleanup via OpenViking
    it('should delete document via OpenViking', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-viking-1', user_id: 'user-1' });
      (deleteDocument as Mock).mockReturnValue(true);
      (deleteMemoryIndexByTarget as Mock).mockReturnValue(undefined);
      const client = getOpenVikingClient();
      (client.delete as Mock).mockResolvedValue({ success: true });
      
      await getHandler()({
        resource: 'document',
        id: 'doc-viking-1',
        scope: { userId: 'user-1' }
      });
      
      expect(client.delete).toHaveBeenCalled();
    });

    // Test vector deletion failure handling - should not block main flow
    it('should succeed even if OpenViking deletion fails', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-viking-fail', user_id: 'user-1' });
      (deleteDocument as Mock).mockReturnValue(true);
      (deleteMemoryIndexByTarget as Mock).mockReturnValue(undefined);
      const client = getOpenVikingClient();
      (client.delete as Mock).mockRejectedValue(new Error('OpenViking connection failed'));
      
      const result = await getHandler()({
        resource: 'document',
        id: 'doc-viking-fail',
        scope: { userId: 'user-1' }
      });
      
      // Should still succeed despite deletion failure
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('should return success=false if not found', async () => {
      (getDocumentById as Mock).mockReturnValue(null);
      const result = await getHandler()({
        resource: 'document',
        id: 'x',
        scope: { userId: 'user-1' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });

    it('should validate scope', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', user_id: 'user-2' });
      const result = await getHandler()({
        resource: 'document',
        id: 'doc-1',
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('asset resource', () => {
    it('should delete asset', async () => {
      (getAssetById as Mock).mockReturnValue({ id: 'asset-1', user_id: 'user-1' });
      (deleteAsset as Mock).mockReturnValue(true);
      const result = await getHandler()({
        resource: 'asset',
        id: 'asset-1',
        scope: { userId: 'user-1' }
      });
      expect(deleteAsset).toHaveBeenCalled();
    });

    // TDD test for asset vector cleanup via OpenViking
    it('should delete asset via OpenViking', async () => {
      (getAssetById as Mock).mockReturnValue({ id: 'asset-viking-1', user_id: 'user-1' });
      (deleteAsset as Mock).mockReturnValue(true);
      const client = getOpenVikingClient();
      (client.delete as Mock).mockResolvedValue({ success: true });
      
      await getHandler()({
        resource: 'asset',
        id: 'asset-viking-1',
        scope: { userId: 'user-1' }
      });
      
      expect(client.delete).toHaveBeenCalled();
    });
  });

  describe('conversation resource', () => {
    it('should cascade delete messages', async () => {
      (getConversationById as Mock).mockReturnValue({ id: 'conv-1', user_id: 'user-1' });
      (deleteConversation as Mock).mockReturnValue(true);
      (deleteMessagesByConversation as Mock).mockReturnValue(5);
      const result = await getHandler()({
        resource: 'conversation',
        id: 'conv-1',
        scope: { userId: 'user-1' }
      });
      expect(deleteMessagesByConversation).toHaveBeenCalledWith('conv-1');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.deletedMessages).toBe(5);
    });
  });

  describe('message resource', () => {
    it('should delete message', async () => {
      (getMessageById as Mock).mockReturnValue({ id: 'msg-1' });
      (deleteMessage as Mock).mockReturnValue(true);
      const client = getOpenVikingClient();
      (client.delete as Mock).mockResolvedValue({ success: true });
      const result = await getHandler()({
        resource: 'message',
        id: 'msg-1',
        scope: { userId: 'user-1' }
      });
      expect(deleteMessage).toHaveBeenCalled();
    });

    // OpenViking delete test
    it('should delete message via OpenViking', async () => {
      (getMessageById as Mock).mockReturnValue({ id: 'msg-vector-1' });
      (deleteMessage as Mock).mockReturnValue(true);
      const client = getOpenVikingClient();
      (client.delete as Mock).mockResolvedValue({ success: true });
      
      await getHandler()({
        resource: 'message',
        id: 'msg-vector-1',
        scope: { userId: 'user-1' }
      });
      
      expect(client.delete).toHaveBeenCalled();
    });
  });

  describe('fact resource', () => {
    it('should delete fact', async () => {
      (getFactById as Mock).mockReturnValue({ id: 'fact-1', user_id: 'user-1' });
      (deleteFact as Mock).mockReturnValue(true);
      const client = getOpenVikingClient();
      (client.delete as Mock).mockResolvedValue({ success: true });
      const result = await getHandler()({
        resource: 'fact',
        id: 'fact-1',
        scope: { userId: 'user-1' }
      });
      expect(deleteFact).toHaveBeenCalled();
    });

    // OpenViking delete test
    it('should delete fact via OpenViking', async () => {
      (getFactById as Mock).mockReturnValue({ id: 'fact-vector-1', user_id: 'user-1' });
      (deleteFact as Mock).mockReturnValue(true);
      const client = getOpenVikingClient();
      (client.delete as Mock).mockResolvedValue({ success: true });
      
      await getHandler()({
        resource: 'fact',
        id: 'fact-vector-1',
        scope: { userId: 'user-1' }
      });
      
      expect(client.delete).toHaveBeenCalled();
    });
  });

  describe('team resource', () => {
    it('should cascade delete members', async () => {
      (getTeamById as Mock).mockReturnValue({ id: 'team-1' });
      (deleteTeam as Mock).mockReturnValue(true);
      (deleteTeamMembersByTeam as Mock).mockReturnValue(3);
      const result = await getHandler()({
        resource: 'team',
        id: 'team-1'
      });
      expect(deleteTeamMembersByTeam).toHaveBeenCalledWith('team-1');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.deletedMembers).toBe(3);
    });

    it('should not require scope', async () => {
      (getTeamById as Mock).mockReturnValue({ id: 'team-1' });
      (deleteTeam as Mock).mockReturnValue(true);
      const result = await getHandler()({
        resource: 'team',
        id: 'team-1'
      });
      expect(deleteTeam).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should reject invalid resource', async () => {
      const result = await getHandler()({
        resource: 'invalid',
        id: 'x',
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should reject missing id', async () => {
      const result = await getHandler()({
        resource: 'document',
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should handle service errors', async () => {
      (getDocumentById as Mock).mockImplementation(() => { throw new Error('DB error'); });
      const result = await getHandler()({
        resource: 'document',
        id: 'x',
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });
});