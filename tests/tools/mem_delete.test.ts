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

// LanceDB vector mocks - NEW: test vector cleanup on delete
vi.mock('../../src/lance/documents_vec', () => ({
  deleteDocumentVector: vi.fn()
}));

vi.mock('../../src/lance/assets_vec', () => ({
  deleteAssetVector: vi.fn()
}));

vi.mock('../../src/lance/messages_vec', () => ({
  deleteMessageVector: vi.fn()
}));

vi.mock('../../src/lance/facts_vec', () => ({
  deleteFactVector: vi.fn()
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

// Import mocked LanceDB modules - NEW
import { deleteDocumentVector } from '../../src/lance/documents_vec';
import { deleteAssetVector } from '../../src/lance/assets_vec';
import { deleteMessageVector } from '../../src/lance/messages_vec';
import { deleteFactVector } from '../../src/lance/facts_vec';

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
      (deleteDocumentVector as Mock).mockResolvedValue(undefined);
      const result = await getHandler()({
        resource: 'document',
        id: 'doc-1',
        scope: { userId: 'user-1' }
      });
      expect(deleteDocument).toHaveBeenCalledWith('doc-1');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    // NEW: TDD test for vector cleanup - should FAIL initially
    it('should delete document vector from LanceDB', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-vector-1', user_id: 'user-1' });
      (deleteDocument as Mock).mockReturnValue(true);
      (deleteMemoryIndexByTarget as Mock).mockReturnValue(undefined);
      (deleteDocumentVector as Mock).mockResolvedValue(undefined);
      
      await getHandler()({
        resource: 'document',
        id: 'doc-vector-1',
        scope: { userId: 'user-1' }
      });
      
      // This assertion should FAIL because deleteDocumentVector is not called in current implementation
      expect(deleteDocumentVector).toHaveBeenCalledWith('doc-vector-1');
    });

    // NEW: test vector deletion failure handling - should not block main flow
    it('should succeed even if vector deletion fails', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-vector-fail', user_id: 'user-1' });
      (deleteDocument as Mock).mockReturnValue(true);
      (deleteMemoryIndexByTarget as Mock).mockReturnValue(undefined);
      (deleteDocumentVector as Mock).mockRejectedValue(new Error('LanceDB connection failed'));
      
      const result = await getHandler()({
        resource: 'document',
        id: 'doc-vector-fail',
        scope: { userId: 'user-1' }
      });
      
      // Should still succeed despite vector deletion failure
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      // Vector deletion should still be attempted
      expect(deleteDocumentVector).toHaveBeenCalledWith('doc-vector-fail');
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
      (deleteAssetVector as Mock).mockResolvedValue(undefined);
      const result = await getHandler()({
        resource: 'asset',
        id: 'asset-1',
        scope: { userId: 'user-1' }
      });
      expect(deleteAsset).toHaveBeenCalled();
    });

    // NEW: TDD test for asset vector cleanup - should FAIL initially
    it('should delete asset vector from LanceDB', async () => {
      (getAssetById as Mock).mockReturnValue({ id: 'asset-vector-1', user_id: 'user-1' });
      (deleteAsset as Mock).mockReturnValue(true);
      (deleteAssetVector as Mock).mockResolvedValue(undefined);
      
      await getHandler()({
        resource: 'asset',
        id: 'asset-vector-1',
        scope: { userId: 'user-1' }
      });
      
      expect(deleteAssetVector).toHaveBeenCalledWith('asset-vector-1');
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
      (deleteMessageVector as Mock).mockResolvedValue(undefined);
      const result = await getHandler()({
        resource: 'message',
        id: 'msg-1',
        scope: { userId: 'user-1' }
      });
      expect(deleteMessage).toHaveBeenCalled();
    });

    // NEW: TDD test for message vector cleanup - should FAIL initially
    it('should delete message vector from LanceDB', async () => {
      (getMessageById as Mock).mockReturnValue({ id: 'msg-vector-1' });
      (deleteMessage as Mock).mockReturnValue(true);
      (deleteMessageVector as Mock).mockResolvedValue(undefined);
      
      await getHandler()({
        resource: 'message',
        id: 'msg-vector-1',
        scope: { userId: 'user-1' }
      });
      
      expect(deleteMessageVector).toHaveBeenCalledWith('msg-vector-1');
    });
  });

  describe('fact resource', () => {
    it('should delete fact', async () => {
      (getFactById as Mock).mockReturnValue({ id: 'fact-1', user_id: 'user-1' });
      (deleteFact as Mock).mockReturnValue(true);
      (deleteFactVector as Mock).mockResolvedValue(undefined);
      const result = await getHandler()({
        resource: 'fact',
        id: 'fact-1',
        scope: { userId: 'user-1' }
      });
      expect(deleteFact).toHaveBeenCalled();
    });

    // NEW: TDD test for fact vector cleanup - should FAIL initially
    it('should delete fact vector from LanceDB', async () => {
      (getFactById as Mock).mockReturnValue({ id: 'fact-vector-1', user_id: 'user-1' });
      (deleteFact as Mock).mockReturnValue(true);
      (deleteFactVector as Mock).mockResolvedValue(undefined);
      
      await getHandler()({
        resource: 'fact',
        id: 'fact-vector-1',
        scope: { userId: 'user-1' }
      });
      
      expect(deleteFactVector).toHaveBeenCalledWith('fact-vector-1');
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