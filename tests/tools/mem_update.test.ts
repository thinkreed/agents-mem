/**
 * @file tests/tools/mem_update.test.ts
 * @description TDD tests for mem_update CRUD tool - GREEN phase
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

vi.mock('../../src/sqlite/documents', () => ({
  getDocumentById: vi.fn(),
  updateDocument: vi.fn()
}));

vi.mock('../../src/sqlite/assets', () => ({
  getAssetById: vi.fn(),
  updateAsset: vi.fn()
}));

vi.mock('../../src/sqlite/conversations', () => ({
  getConversationById: vi.fn(),
  updateConversation: vi.fn()
}));

vi.mock('../../src/sqlite/messages', () => ({
  getMessageById: vi.fn(),
  updateMessage: vi.fn()
}));

vi.mock('../../src/sqlite/facts', () => ({
  getFactById: vi.fn(),
  updateFact: vi.fn()
}));

vi.mock('../../src/sqlite/teams', () => ({
  getTeamById: vi.fn(),
  updateTeam: vi.fn()
}));

vi.mock('../../src/sqlite/team_members', () => ({
  updateTeamMemberRole: vi.fn()
}));

// Import mocked modules
import { getDocumentById, updateDocument } from '../../src/sqlite/documents';
import { getAssetById, updateAsset } from '../../src/sqlite/assets';
import { getConversationById, updateConversation } from '../../src/sqlite/conversations';
import { getMessageById, updateMessage } from '../../src/sqlite/messages';
import { getFactById, updateFact } from '../../src/sqlite/facts';
import { getTeamById, updateTeam } from '../../src/sqlite/teams';
import { updateTeamMemberRole } from '../../src/sqlite/team_members';

// Import the actual handler
import { handleMemUpdate } from '../../src/tools/crud_handlers';

const getHandler = () => handleMemUpdate;

describe('mem_update tool', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe('document resource', () => {
    it('should update document title', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', user_id: 'user-1' });
      (updateDocument as Mock).mockReturnValue({ id: 'doc-1', title: 'New' });
      const result = await getHandler()({
        resource: 'document',
        id: 'doc-1',
        data: { title: 'New Title' },
        scope: { userId: 'user-1' }
      });
      expect(updateDocument).toHaveBeenCalledWith('doc-1', expect.objectContaining({ title: 'New Title' }));
    });

    it('should update document content', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', user_id: 'user-1' });
      (updateDocument as Mock).mockReturnValue({ id: 'doc-1' });
      await getHandler()({
        resource: 'document',
        id: 'doc-1',
        data: { content: 'New content' },
        scope: { userId: 'user-1' }
      });
      expect(updateDocument).toHaveBeenCalledWith('doc-1', expect.objectContaining({ content: 'New content' }));
    });

    it('should partial update', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', user_id: 'user-1', title: 'Old', content: 'Old' });
      (updateDocument as Mock).mockReturnValue({ id: 'doc-1' });
      await getHandler()({
        resource: 'document',
        id: 'doc-1',
        data: { title: 'New' },
        scope: { userId: 'user-1' }
      });
      expect(updateDocument).toHaveBeenCalledWith('doc-1', expect.objectContaining({ title: 'New' }));
    });

    it('should return error if not found', async () => {
      (getDocumentById as Mock).mockReturnValue(null);
      const result = await getHandler()({
        resource: 'document',
        id: 'x',
        data: { title: 'New' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should validate scope', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', user_id: 'user-2' });
      const result = await getHandler()({
        resource: 'document',
        id: 'doc-1',
        data: { title: 'New' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('asset resource', () => {
    it('should update asset title', async () => {
      (getAssetById as Mock).mockReturnValue({ id: 'asset-1', user_id: 'user-1' });
      (updateAsset as Mock).mockReturnValue({ id: 'asset-1' });
      await getHandler()({
        resource: 'asset',
        id: 'asset-1',
        data: { title: 'New' },
        scope: { userId: 'user-1' }
      });
      expect(updateAsset).toHaveBeenCalled();
    });
  });

  describe('conversation resource', () => {
    it('should update conversation title', async () => {
      (getConversationById as Mock).mockReturnValue({ id: 'conv-1', user_id: 'user-1' });
      (updateConversation as Mock).mockReturnValue({ id: 'conv-1' });
      await getHandler()({
        resource: 'conversation',
        id: 'conv-1',
        data: { title: 'New' },
        scope: { userId: 'user-1' }
      });
      expect(updateConversation).toHaveBeenCalled();
    });
  });

  describe('message resource', () => {
    it('should update message content', async () => {
      (getMessageById as Mock).mockReturnValue({ id: 'msg-1' });
      (updateMessage as Mock).mockReturnValue({ id: 'msg-1' });
      await getHandler()({
        resource: 'message',
        id: 'msg-1',
        data: { content: 'New' },
        scope: { userId: 'user-1' }
      });
      expect(updateMessage).toHaveBeenCalled();
    });
  });

  describe('fact resource', () => {
    it('should update fact verified status', async () => {
      (getFactById as Mock).mockReturnValue({ id: 'fact-1', user_id: 'user-1' });
      (updateFact as Mock).mockReturnValue({ id: 'fact-1' });
      await getHandler()({
        resource: 'fact',
        id: 'fact-1',
        data: { verified: true },
        scope: { userId: 'user-1' }
      });
      expect(updateFact).toHaveBeenCalledWith('fact-1', expect.objectContaining({ verified: true }));
    });

    it('should not update fact content (immutable)', async () => {
      (getFactById as Mock).mockReturnValue({ id: 'fact-1' });
      const result = await getHandler()({
        resource: 'fact',
        id: 'fact-1',
        data: { content: 'New' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('team resource', () => {
    it('should update team name', async () => {
      (getTeamById as Mock).mockReturnValue({ id: 'team-1' });
      (updateTeam as Mock).mockReturnValue({ id: 'team-1' });
      await getHandler()({
        resource: 'team',
        id: 'team-1',
        data: { name: 'New' }
      });
      expect(updateTeam).toHaveBeenCalled();
    });

    it('should update team member role', async () => {
      (getTeamById as Mock).mockReturnValue({ id: 'team-1' });
      (updateTeamMemberRole as Mock).mockReturnValue(undefined);
      await getHandler()({
        resource: 'team',
        id: 'team-1',
        data: { memberId: 'agent-1', role: 'admin' }
      });
      expect(updateTeamMemberRole).toHaveBeenCalled();
    });

    it('should not require scope', async () => {
      (getTeamById as Mock).mockReturnValue({ id: 'team-1' });
      (updateTeam as Mock).mockReturnValue({ id: 'team-1' });
      const result = await getHandler()({
        resource: 'team',
        id: 'team-1',
        data: { name: 'New' }
      });
      expect(updateTeam).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should reject invalid resource', async () => {
      const result = await getHandler()({
        resource: 'invalid',
        id: 'x',
        data: {},
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should reject missing id', async () => {
      const result = await getHandler()({
        resource: 'document',
        data: { title: 'New' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should reject empty data', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1' });
      const result = await getHandler()({
        resource: 'document',
        id: 'doc-1',
        data: {},
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });
});