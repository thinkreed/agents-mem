import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

vi.mock('../../src/sqlite/documents', () => ({
  getDocumentById: vi.fn(),
  searchDocuments: vi.fn()
}));

vi.mock('../../src/sqlite/assets', () => ({
  getAssetById: vi.fn()
}));

vi.mock('../../src/sqlite/conversations', () => ({
  getConversationById: vi.fn(),
  listConversations: vi.fn()
}));

vi.mock('../../src/sqlite/messages', () => ({
  getMessageById: vi.fn(),
  listMessagesByConversation: vi.fn()
}));

vi.mock('../../src/sqlite/facts', () => ({
  getFactById: vi.fn(),
  searchFacts: vi.fn(),
  getFactsBySource: vi.fn()
}));

vi.mock('../../src/sqlite/teams', () => ({
  getTeamById: vi.fn(),
  listTeams: vi.fn()
}));

vi.mock('../../src/sqlite/team_members', () => ({
  getTeamMembers: vi.fn()
}));

vi.mock('../../src/lance/hybrid_search', () => ({
  hybridSearchDocuments: vi.fn()
}));

vi.mock('../../src/lance/fts_search', () => ({
  ftsSearchDocuments: vi.fn()
}));

vi.mock('../../src/lance/semantic_search', () => ({
  semanticSearchDocuments: vi.fn()
}));

vi.mock('../../src/materials/filesystem', () => ({
  listMaterials: vi.fn()
}));

vi.mock('../../src/materials/trace', () => ({
  traceFactToSource: vi.fn()
}));

vi.mock('../../src/embedder/ollama', () => ({
  getEmbedding: vi.fn().mockResolvedValue(new Float32Array(768).fill(0.5))
}));

// Import mocked modules
import { getDocumentById, searchDocuments } from '../../src/sqlite/documents';
import { getAssetById } from '../../src/sqlite/assets';
import { getConversationById, listConversations } from '../../src/sqlite/conversations';
import { getFactById, searchFacts, getFactsBySource } from '../../src/sqlite/facts';
import { getTeamById, listTeams } from '../../src/sqlite/teams';
import { getTeamMembers } from '../../src/sqlite/team_members';
import { hybridSearchDocuments } from '../../src/lance/hybrid_search';
import { ftsSearchDocuments } from '../../src/lance/fts_search';
import { semanticSearchDocuments } from '../../src/lance/semantic_search';
import { listMaterials } from '../../src/materials/filesystem';
import { traceFactToSource } from '../../src/materials/trace';
import { getEmbedding } from '../../src/embedder/ollama';

// Import the actual handler
import { handleMemRead } from '../../src/tools/crud_handlers';

const getHandler = () => handleMemRead;

describe('mem_read tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getEmbedding as Mock).mockResolvedValue(new Float32Array(768).fill(0.5));
  });
  afterEach(() => vi.resetAllMocks());

  describe('document resource - ID lookup', () => {
    it('should read document by id', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', content: 'Test' });
      const result = await getHandler()({
        resource: 'document',
        query: { id: 'doc-1' },
        scope: { userId: 'user-1' }
      });
      expect(getDocumentById).toHaveBeenCalledWith('doc-1');
    });

    it('should return error if not found', async () => {
      (getDocumentById as Mock).mockReturnValue(null);
      const result = await getHandler()({
        resource: 'document',
        query: { id: 'x' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('document resource - tiered content', () => {
    it('should return L0 abstract', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', content: 'Test' });
      const result = await getHandler()({
        resource: 'document',
        query: { id: 'doc-1', tier: 'L0' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('L0');
    });

    it('should return L1 overview', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', content: 'Test' });
      const result = await getHandler()({
        resource: 'document',
        query: { id: 'doc-1', tier: 'L1' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('L1');
    });

    it('should return L2 full content', async () => {
      (getDocumentById as Mock).mockReturnValue({ id: 'doc-1', content: 'Full content' });
      const result = await getHandler()({
        resource: 'document',
        query: { id: 'doc-1', tier: 'L2' },
        scope: { userId: 'user-1' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.tier).toBe('L2');
    });
  });

  describe('document resource - search', () => {
    it('should hybrid search', async () => {
      (hybridSearchDocuments as Mock).mockResolvedValue([{ id: 'doc-1' }]);
      const result = await getHandler()({
        resource: 'document',
        query: { search: 'test', searchMode: 'hybrid' },
        scope: { userId: 'user-1' }
      });
      expect(hybridSearchDocuments).toHaveBeenCalled();
    });

    it('should fts search', async () => {
      (ftsSearchDocuments as Mock).mockResolvedValue([{ id: 'doc-1' }]);
      await getHandler()({
        resource: 'document',
        query: { search: 'test', searchMode: 'fts' },
        scope: { userId: 'user-1' }
      });
      expect(ftsSearchDocuments).toHaveBeenCalled();
    });

    it('should semantic search', async () => {
      (semanticSearchDocuments as Mock).mockResolvedValue([{ id: 'doc-1' }]);
      await getHandler()({
        resource: 'document',
        query: { search: 'test', searchMode: 'semantic' },
        scope: { userId: 'user-1' }
      });
      expect(semanticSearchDocuments).toHaveBeenCalled();
    });

    it('should progressive search', async () => {
      (hybridSearchDocuments as Mock).mockResolvedValue([{ id: 'doc-1' }]);
      const result = await getHandler()({
        resource: 'document',
        query: { search: 'test', searchMode: 'progressive', tokenBudget: 500 },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('progressive');
    });
  });

  describe('document resource - list', () => {
    it('should list documents', async () => {
      (searchDocuments as Mock).mockReturnValue([
        { id: 'doc-1', user_id: 'user-1' },
        { id: 'doc-2', user_id: 'user-1' }
      ]);
      const result = await getHandler()({
        resource: 'document',
        query: { list: true },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('doc-1');
    });
  });

  describe('asset resource', () => {
    it('should read asset by id', async () => {
      (getAssetById as Mock).mockReturnValue({ id: 'asset-1', filename: 'test.pdf' });
      const result = await getHandler()({
        resource: 'asset',
        query: { id: 'asset-1' },
        scope: { userId: 'user-1' }
      });
      expect(getAssetById).toHaveBeenCalledWith('asset-1');
    });

    it('should list assets', async () => {
      (listMaterials as Mock).mockResolvedValue([{ id: 'a1' }]);
      await getHandler()({
        resource: 'asset',
        query: { list: true },
        scope: { userId: 'user-1' }
      });
      expect(listMaterials).toHaveBeenCalled();
    });
  });

  describe('conversation resource', () => {
    it('should read conversation', async () => {
      (getConversationById as Mock).mockReturnValue({ id: 'conv-1' });
      const result = await getHandler()({
        resource: 'conversation',
        query: { id: 'conv-1' },
        scope: { userId: 'user-1' }
      });
      expect(getConversationById).toHaveBeenCalled();
    });

    it('should list conversations', async () => {
      (listConversations as Mock).mockReturnValue([{ id: 'conv-1' }]);
      await getHandler()({
        resource: 'conversation',
        query: { list: true },
        scope: { userId: 'user-1' }
      });
      expect(listConversations).toHaveBeenCalled();
    });
  });

  describe('fact resource', () => {
    it('should read fact by id', async () => {
      (getFactById as Mock).mockReturnValue({ id: 'fact-1', content: 'Test' });
      const result = await getHandler()({
        resource: 'fact',
        query: { id: 'fact-1' },
        scope: { userId: 'user-1' }
      });
      expect(getFactById).toHaveBeenCalledWith('fact-1');
    });

    it('should trace fact to source', async () => {
      (getFactById as Mock).mockReturnValue({ id: 'fact-1', source_type: 'documents' });
      (getFactsBySource as Mock).mockReturnValue([]);
      (traceFactToSource as Mock).mockReturnValue({ fact: {}, sources: [] });
      const result = await getHandler()({
        resource: 'fact',
        query: { id: 'fact-1', trace: true },
        scope: { userId: 'user-1' }
      });
      expect(traceFactToSource).toHaveBeenCalled();
    });

    it('should search facts', async () => {
      (searchFacts as Mock).mockReturnValue([{ id: 'fact-1' }]);
      await getHandler()({
        resource: 'fact',
        query: { filters: { factType: 'preference' } },
        scope: { userId: 'user-1' }
      });
      expect(searchFacts).toHaveBeenCalled();
    });
  });

  describe('team resource', () => {
    it('should read team', async () => {
      (getTeamById as Mock).mockReturnValue({ id: 'team-1' });
      const result = await getHandler()({
        resource: 'team',
        query: { id: 'team-1' }
      });
      expect(getTeamById).toHaveBeenCalled();
    });

    it('should list teams', async () => {
      (listTeams as Mock).mockReturnValue([{ id: 'team-1' }]);
      await getHandler()({
        resource: 'team',
        query: { list: true }
      });
      expect(listTeams).toHaveBeenCalled();
    });

    it('should list team members', async () => {
      (getTeamById as Mock).mockReturnValue({ id: 'team-1' });
      (getTeamMembers as Mock).mockReturnValue([]);
      await getHandler()({
        resource: 'team',
        query: { id: 'team-1', filters: { members: true } }
      });
      expect(getTeamMembers).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should reject invalid resource', async () => {
      const result = await getHandler()({
        resource: 'invalid',
        query: { id: 'x' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should reject invalid searchMode', async () => {
      const result = await getHandler()({
        resource: 'document',
        query: { search: 'test', searchMode: 'invalid' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });

    it('should reject invalid tier', async () => {
      const result = await getHandler()({
        resource: 'document',
        query: { id: 'doc-1', tier: 'L99' },
        scope: { userId: 'user-1' }
      });
      expect(result.content[0].text).toContain('error');
    });
  });

  /**
   * TDD: Error message enhancement tests
   * These tests verify that validation errors include usage hints
   * @see E:\bugs\agents-mem-tools-api-errors.md - Errors 2-4: query issues
   */
  describe('error message enhancements - query hints', () => {
    it('should hint valid query formats when query missing', async () => {
      const result = await getHandler()({
        resource: 'document',
        scope: { userId: 'user-1' }
        // missing query entirely
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('query is required');
      expect(parsed.error).toContain('id');
      expect(parsed.error).toContain('search');
      expect(parsed.error).toContain('list');
    });

    it('should hint valid document query keys when invalid key used', async () => {
      const result = await getHandler()({
        resource: 'document',
        query: { content: 'x' }, // invalid - should use 'search' or 'id'
        scope: { userId: 'user-1' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for document');
      expect(parsed.error).toContain('id');
      expect(parsed.error).toContain('search');
      expect(parsed.error).toContain('list');
    });

    it('should hint valid asset query keys when invalid key used', async () => {
      const result = await getHandler()({
        resource: 'asset',
        query: { content: 'x' }, // invalid - should use 'id' or 'list'
        scope: { userId: 'user-1' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for asset');
      expect(parsed.error).toContain('id');
      expect(parsed.error).toContain('list');
    });

    it('should hint valid conversation query keys when invalid key used', async () => {
      const result = await getHandler()({
        resource: 'conversation',
        query: { content: 'x' }, // invalid - should use 'id' or 'list'
        scope: { userId: 'user-1' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for conversation');
      expect(parsed.error).toContain('id');
      expect(parsed.error).toContain('list');
    });

    it('should hint valid message query keys when invalid key used', async () => {
      const result = await getHandler()({
        resource: 'message',
        query: { content: 'x' }, // invalid - should use 'id' or 'conversationId'
        scope: { userId: 'user-1' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for message');
      expect(parsed.error).toContain('id');
      expect(parsed.error).toContain('conversationId');
    });

    it('should hint valid fact query keys when invalid key used', async () => {
      const result = await getHandler()({
        resource: 'fact',
        query: { content: 'x' }, // invalid - should use 'id' or 'filters'
        scope: { userId: 'user-1' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for fact');
      expect(parsed.error).toContain('id');
      expect(parsed.error).toContain('filters');
    });

    it('should hint valid team query keys when invalid key used', async () => {
      const result = await getHandler()({
        resource: 'team',
        query: { content: 'x' }, // invalid - should use 'id', 'list', or 'filters'
        scope: { userId: 'user-1' }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for team');
      expect(parsed.error).toContain('id');
      expect(parsed.error).toContain('list');
    });
  });
});