/**
 * @file tests/facts/linker.test.ts
 * @description Fact to entity linking tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { linkFactToEntities, getFactsForEntity } from '../../src/facts/linker';

// Mock sqlite/facts
vi.mock('../../src/sqlite/facts', () => ({
  getFactById: vi.fn()
}));

// Mock sqlite/entity_nodes
vi.mock('../../src/sqlite/entity_nodes', () => ({
  createEntityNode: vi.fn(),
  getEntityNodeById: vi.fn(),
  updateEntityNode: vi.fn()
}));

// Mock uuid generator
vi.mock('../../src/utils/uuid', () => ({
  generateUUID: vi.fn()
}));

// Import mocked modules after vi.mock
import { getFactById } from '../../src/sqlite/facts';
import { createEntityNode, getEntityNodeById } from '../../src/sqlite/entity_nodes';
import { generateUUID } from '../../src/utils/uuid';

// Cast mocks for TypeScript
const mockGetFactById = getFactById as ReturnType<typeof vi.fn>;
const mockCreateEntityNode = createEntityNode as ReturnType<typeof vi.fn>;
const mockGetEntityNodeById = getEntityNodeById as ReturnType<typeof vi.fn>;
const mockGenerateUUID = generateUUID as ReturnType<typeof vi.fn>;

describe('Fact Linker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('linkFactToEntities', () => {
    it('should return empty array for non-existent fact', async () => {
      // Setup mock - fact not found
      mockGetFactById.mockReturnValue(undefined);

      const result = await linkFactToEntities('non-existent-fact', ['Entity1']);

      expect(result).toEqual([]);
      expect(mockGetFactById).toHaveBeenCalledWith('non-existent-fact');
      expect(mockCreateEntityNode).not.toHaveBeenCalled();
    });

    it('should create entity nodes for existing fact', async () => {
      // Setup mock - fact exists
      const mockFact = {
        id: 'fact-1',
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-1',
        is_global: false,
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test fact content',
        fact_type: 'preference',
        entities: '["Entity1"]',
        importance: 0.5,
        confidence: 0.8,
        verified: false,
        created_at: 1000,
        updated_at: 1000
      };
      mockGetFactById.mockReturnValue(mockFact);

      // Mock UUID generation
      mockGenerateUUID.mockReturnValueOnce('node-uuid-1').mockReturnValueOnce('node-uuid-2');

      // Mock createEntityNode
      mockCreateEntityNode.mockImplementation((input: any) => ({
        id: input.id,
        user_id: input.user_id,
        agent_id: input.agent_id,
        team_id: input.team_id,
        depth: input.depth,
        entity_name: input.entity_name,
        linked_fact_ids: input.linked_fact_ids,
        is_global: false,
        child_count: 0,
        created_at: 1000,
        updated_at: 1000
      }));

      const entities = ['Project X', 'User John'];
      const result = await linkFactToEntities('fact-1', entities);

      expect(result).toEqual(['node-uuid-1', 'node-uuid-2']);
      expect(mockGetFactById).toHaveBeenCalledWith('fact-1');
      expect(mockCreateEntityNode).toHaveBeenCalledTimes(2);

      // Verify first entity node creation
      expect(mockCreateEntityNode).toHaveBeenNthCalledWith(1, {
        id: 'node-uuid-1',
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-1',
        entity_name: 'Project X',
        depth: 0,
        linked_fact_ids: JSON.stringify(['fact-1'])
      });

      // Verify second entity node creation
      expect(mockCreateEntityNode).toHaveBeenNthCalledWith(2, {
        id: 'node-uuid-2',
        user_id: 'user-1',
        agent_id: 'agent-1',
        team_id: 'team-1',
        entity_name: 'User John',
        depth: 0,
        linked_fact_ids: JSON.stringify(['fact-1'])
      });
    });

    it('should create entity nodes without agent_id and team_id', async () => {
      // Setup mock - fact without agent/team
      const mockFact = {
        id: 'fact-2',
        user_id: 'user-2',
        agent_id: undefined,
        team_id: undefined,
        is_global: false,
        source_type: 'messages',
        source_id: 'msg-1',
        content: 'Simple fact',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false,
        created_at: 1000,
        updated_at: 1000
      };
      mockGetFactById.mockReturnValue(mockFact);
      mockGenerateUUID.mockReturnValue('node-uuid-3');
      mockCreateEntityNode.mockImplementation((input: any) => ({
        id: input.id,
        user_id: input.user_id,
        agent_id: input.agent_id,
        team_id: input.team_id,
        depth: input.depth,
        entity_name: input.entity_name,
        linked_fact_ids: input.linked_fact_ids,
        is_global: false,
        child_count: 0,
        created_at: 1000,
        updated_at: 1000
      }));

      const result = await linkFactToEntities('fact-2', ['Entity']);

      expect(result).toEqual(['node-uuid-3']);
      expect(mockCreateEntityNode).toHaveBeenCalledWith({
        id: 'node-uuid-3',
        user_id: 'user-2',
        agent_id: undefined,
        team_id: undefined,
        entity_name: 'Entity',
        depth: 0,
        linked_fact_ids: JSON.stringify(['fact-2'])
      });
    });

    it('should handle empty entities array', async () => {
      const mockFact = {
        id: 'fact-3',
        user_id: 'user-1',
        is_global: false,
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false,
        created_at: 1000,
        updated_at: 1000
      };
      mockGetFactById.mockReturnValue(mockFact);

      const result = await linkFactToEntities('fact-3', []);

      expect(result).toEqual([]);
      expect(mockCreateEntityNode).not.toHaveBeenCalled();
    });
  });

  describe('getFactsForEntity', () => {
    it('should return parsed fact IDs for entity node', async () => {
      // Setup mock - entity node with linked facts
      mockGetEntityNodeById.mockReturnValue({
        id: 'node-1',
        user_id: 'user-1',
        entity_name: 'Project X',
        depth: 0,
        linked_fact_ids: JSON.stringify(['fact-1', 'fact-2', 'fact-3']),
        is_global: false,
        child_count: 0,
        created_at: 1000,
        updated_at: 1000
      });

      const result = await getFactsForEntity('node-1');

      expect(result).toEqual(['fact-1', 'fact-2', 'fact-3']);
      expect(mockGetEntityNodeById).toHaveBeenCalledWith('node-1');
    });

    it('should return empty array for non-existent entity node', async () => {
      // Setup mock - entity node not found
      mockGetEntityNodeById.mockReturnValue(undefined);

      const result = await getFactsForEntity('non-existent-node');

      expect(result).toEqual([]);
      expect(mockGetEntityNodeById).toHaveBeenCalledWith('non-existent-node');
    });

    it('should return empty array for entity node without linked facts', async () => {
      // Setup mock - entity node exists but no linked facts
      mockGetEntityNodeById.mockReturnValue({
        id: 'node-2',
        user_id: 'user-1',
        entity_name: 'Empty Node',
        depth: 0,
        linked_fact_ids: undefined,
        is_global: false,
        child_count: 0,
        created_at: 1000,
        updated_at: 1000
      });

      const result = await getFactsForEntity('node-2');

      expect(result).toEqual([]);
    });

    it('should return empty array for entity node with null linked_fact_ids', async () => {
      // Setup mock - entity node with null linked_fact_ids
      mockGetEntityNodeById.mockReturnValue({
        id: 'node-3',
        user_id: 'user-1',
        entity_name: 'Null Node',
        depth: 0,
        linked_fact_ids: null,
        is_global: false,
        child_count: 0,
        created_at: 1000,
        updated_at: 1000
      });

      const result = await getFactsForEntity('node-3');

      expect(result).toEqual([]);
    });

    it('should parse single fact ID', async () => {
      mockGetEntityNodeById.mockReturnValue({
        id: 'node-4',
        user_id: 'user-1',
        entity_name: 'Single Fact Node',
        depth: 0,
        linked_fact_ids: JSON.stringify(['fact-single']),
        is_global: false,
        child_count: 0,
        created_at: 1000,
        updated_at: 1000
      });

      const result = await getFactsForEntity('node-4');

      expect(result).toEqual(['fact-single']);
    });
  });
});