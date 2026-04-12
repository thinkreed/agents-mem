/**
 * @file tests/tools/mem_create.test.ts
 * @description TDD tests for mem_create CRUD tool - RED phase
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock all services
vi.mock('../../src/sqlite/documents', () => ({
  createDocument: vi.fn(),
  getDocumentById: vi.fn()
}));

vi.mock('../../src/sqlite/assets', () => ({
  createAsset: vi.fn()
}));

vi.mock('../../src/sqlite/conversations', () => ({
  createConversation: vi.fn()
}));

vi.mock('../../src/sqlite/messages', () => ({
  createMessage: vi.fn()
}));

vi.mock('../../src/sqlite/facts', () => ({
  createFact: vi.fn()
}));

vi.mock('../../src/sqlite/teams', () => ({
  createTeam: vi.fn()
}));

vi.mock('../../src/sqlite/team_members', () => ({
  addTeamMember: vi.fn()
}));

vi.mock('../../src/sqlite/users', () => ({
  createUser: vi.fn(),
  getUserById: vi.fn()
}));

vi.mock('../../src/materials/store', () => ({
  storeDocument: vi.fn(),
  storeAsset: vi.fn()
}));

vi.mock('../../src/facts/extractor', () => ({
  getFactExtractor: vi.fn()
}));

vi.mock('../../src/utils/uuid', () => ({
  generateUUID: vi.fn()
}));

import { storeDocument, storeAsset } from '../../src/materials/store';
import { createConversation } from '../../src/sqlite/conversations';
import { createMessage } from '../../src/sqlite/messages';
import { createTeam } from '../../src/sqlite/teams';
import { addTeamMember } from '../../src/sqlite/team_members';
import { createUser, getUserById } from '../../src/sqlite/users';
import { getFactExtractor } from '../../src/facts/extractor';
import { generateUUID } from '../../src/utils/uuid';

const mockHandler = vi.fn();
const getHandler = () => mockHandler;

describe('mem_create tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (generateUUID as Mock).mockReturnValue('test-uuid');
    (getUserById as Mock).mockReturnValue({ id: 'user-1' });
  });
  afterEach(() => vi.resetAllMocks());

  describe('document resource', () => {
    it('should create document with userId', async () => {
      (storeDocument as Mock).mockResolvedValue({ id: 'doc-1' });
      const result = await getHandler()({
        resource: 'document',
        data: { title: 'Test', content: 'Content' },
        scope: { userId: 'user-1' }
      });
      expect(storeDocument).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    });

    it('should require userId', async () => {
      const result = await getHandler()({
        resource: 'document',
        data: { title: 'Test', content: 'Content' },
        scope: {}
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should require title', async () => {
      const result = await getHandler()({
        resource: 'document',
        data: { content: 'Content' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should require content', async () => {
      const result = await getHandler()({
        resource: 'document',
        data: { title: 'Test' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should use default docType', async () => {
      (storeDocument as Mock).mockResolvedValue({ id: 'doc-1' });
      await getHandler()({
        resource: 'document',
        data: { title: 'Test', content: 'Content' },
        scope: { userId: 'user-1' }
      });
      expect(storeDocument).toHaveBeenCalledWith(expect.objectContaining({ docType: 'note' }));
    });
  });

  describe('asset resource', () => {
    it('should create asset with required fields', async () => {
      (storeAsset as Mock).mockResolvedValue({ id: 'asset-1' });
      const result = await getHandler()({
        resource: 'asset',
        data: { filename: 'test.pdf', fileType: 'pdf', fileSize: 1024, storagePath: '/s' },
        scope: { userId: 'user-1' }
      });
      expect(storeAsset).toHaveBeenCalled();
    });

    it('should require filename', async () => {
      const result = await getHandler()({
        resource: 'asset',
        data: { fileType: 'pdf', fileSize: 1, storagePath: '/s' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('conversation resource', () => {
    it('should create conversation', async () => {
      (createConversation as Mock).mockReturnValue({ id: 'conv-1' });
      const result = await getHandler()({
        resource: 'conversation',
        data: { agentId: 'agent-1' },
        scope: { userId: 'user-1' }
      });
      expect(createConversation).toHaveBeenCalled();
    });

    it('should require agentId', async () => {
      const result = await getHandler()({
        resource: 'conversation',
        data: {},
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('message resource', () => {
    it('should create message', async () => {
      (createMessage as Mock).mockReturnValue({ id: 'msg-1' });
      const result = await getHandler()({
        resource: 'message',
        data: { conversationId: 'conv-1', role: 'user', content: 'Hello' },
        scope: { userId: 'user-1' }
      });
      expect(createMessage).toHaveBeenCalled();
    });

    it('should require conversationId', async () => {
      const result = await getHandler()({
        resource: 'message',
        data: { role: 'user', content: 'Hello' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('fact resource', () => {
    it('should create fact and trigger extraction', async () => {
      (getFactExtractor as Mock).mockReturnValue({ extractAndSave: vi.fn().mockResolvedValue(['fact-1']) });
      const result = await getHandler()({
        resource: 'fact',
        data: { content: 'Test', sourceType: 'documents', sourceId: 'doc-1' },
        scope: { userId: 'user-1' }
      });
      expect(getFactExtractor).toHaveBeenCalled();
    });

    it('should require sourceType', async () => {
      const result = await getHandler()({
        resource: 'fact',
        data: { content: 'Test', sourceId: 'doc-1' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('team resource', () => {
    it('should create team and add owner', async () => {
      (createTeam as Mock).mockReturnValue({ id: 'team-1' });
      (addTeamMember as Mock).mockReturnValue(undefined);
      const result = await getHandler()({
        resource: 'team',
        data: { name: 'Test Team', ownerId: 'user-1' }
      });
      expect(createTeam).toHaveBeenCalled();
      expect(addTeamMember).toHaveBeenCalled();
    });

    it('should require name', async () => {
      const result = await getHandler()({
        resource: 'team',
        data: { ownerId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('error handling', () => {
    it('should reject invalid resource', async () => {
      const result = await getHandler()({
        resource: 'invalid',
        data: {},
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should auto-create user if not exists', async () => {
      (getUserById as Mock).mockReturnValue(null);
      (createUser as Mock).mockReturnValue({ id: 'new-user' });
      (storeDocument as Mock).mockResolvedValue({ id: 'doc-1' });
      await getHandler()({
        resource: 'document',
        data: { title: 'Test', content: 'Content' },
        scope: { userId: 'new-user' }
      });
      expect(createUser).toHaveBeenCalled();
    });
  });
});