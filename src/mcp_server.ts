/**
 * @file src/mcp_server.ts
 * @description MCP stdio server entry point with all 24 tools per DESIGN.md
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runMigrations } from './sqlite/migrations';
import { createUser, getUserById } from './sqlite/users';
import { createTeam, getTeamById, listTeams } from './sqlite/teams';
import { addTeamMember, getTeamMembers } from './sqlite/team_members';
import { createDocument, getDocumentById, searchDocuments } from './sqlite/documents';
import { createAsset, getAssetById } from './sqlite/assets';
import { createConversation, getConversationById } from './sqlite/conversations';
import { createMessage } from './sqlite/messages';
import { createFact, getFactById, searchFacts, getFactsBySource } from './sqlite/facts';
import { createMemoryIndex, searchMemoryIndex, getMemoryIndexByURI } from './sqlite/memory_index';
import { createEntityNode, getRootNodes, getEntityNodesByParent } from './sqlite/entity_nodes';
import { storeDocument, storeAsset } from './materials/store';
import { resolveURI, buildMaterialURI } from './materials/uri_resolver';
import { listMaterials, getMaterialTree, grepMaterials, readMaterial } from './materials/filesystem';
import { hybridSearchDocuments } from './lance/hybrid_search';
import { ftsSearchDocuments } from './lance/fts_search';
import { semanticSearchDocuments } from './lance/semantic_search';
import { getFactExtractor } from './facts/extractor';
import { searchEntityTree, foldTree, getTreePath } from './entity_tree/search';
import { EntityTreeBuilder, getEntityTreeBuilder } from './entity_tree/builder';
import { generateUUID } from './utils/uuid';

// Global scope for tools
let currentScope: { userId: string; agentId?: string; teamId?: string } | null = null;

/**
 * Create MCP server with all 24 tools per DESIGN.md Chapter 5
 */
async function createMCPServer(): Promise<McpServer> {
  // Run migrations first
  runMigrations();
  
  const server = new McpServer({
    name: 'agents-mem',
    version: '1.0.0'
  });
  
  // ============================================================================
  // Layer 0: SCOPE & IDENTITY
  // ============================================================================
  
  // Tool: scope_set
  server.tool(
    'scope_set',
    'Set agent scope (user_id, agent_id, team_id)',
    {
      userId: z.string().describe('User ID'),
      agentId: z.string().optional().describe('Agent ID'),
      teamId: z.string().optional().describe('Team ID')
    },
    async ({ userId, agentId, teamId }) => {
      currentScope = { userId, agentId, teamId };
      // Ensure user exists
      const user = getUserById(userId);
      if (!user) {
        createUser({ id: userId, name: userId });
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ scope: currentScope, status: 'set' })
        }]
      };
    }
  );
  
  // Tool: team_create
  server.tool(
    'team_create',
    'Create a team',
    {
      name: z.string().describe('Team name'),
      ownerId: z.string().describe('Owner user ID')
    },
    async ({ name, ownerId }) => {
      const id = generateUUID();
      const team = createTeam({ id, name, owner_user_id: ownerId });
      // Add owner as member (using agent_id = ownerId for now)
      addTeamMember({ team_id: id, agent_id: ownerId, role: 'owner' });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ team })
        }]
      };
    }
  );
  
  // Tool: team_join
  server.tool(
    'team_join',
    'Agent join a team',
    {
      teamId: z.string().describe('Team ID'),
      agentId: z.string().describe('Agent ID to add'),
      role: z.enum(['owner', 'admin', 'member', 'guest']).optional().default('member').describe('Role')
    },
    async ({ teamId, agentId, role }) => {
      const team = getTeamById(teamId);
      if (!team) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Team not found' })
          }]
        };
      }
      addTeamMember({ team_id: teamId, agent_id: agentId, role });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: 'joined', teamId, agentId, role })
        }]
      };
    }
  );
  
  // ============================================================================
  // Layer 1: INDEX & METADATA
  // ============================================================================
  
  // Tool: index_search
  server.tool(
    'index_search',
    'Search memory index by URI and metadata',
    {
      userId: z.string().describe('User ID'),
      topic: z.string().optional().describe('Topic filter'),
      entity: z.string().optional().describe('Entity filter'),
      targetType: z.string().optional().describe('Target type (documents, assets, etc)'),
      limit: z.number().optional().default(10).describe('Max results')
    },
    async ({ userId, topic, entity, targetType, limit }) => {
      // Search by scope and filter
      const results = searchMemoryIndex({ 
        topic, 
        entity
      });
      // Filter by userId and targetType in result
      const filtered = results
        .filter(r => r.user_id === userId)
        .filter(r => !targetType || r.target_type === targetType)
        .slice(0, limit ?? 10);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(filtered)
        }]
      };
    }
  );
  
  // Tool: uri_resolve
  server.tool(
    'uri_resolve',
    'Parse mem:// URI to components',
    {
      uri: z.string().describe('URI to resolve (mem://...)')
    },
    async ({ uri }) => {
      const resolved = resolveURI(uri);
      if (!resolved) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Invalid URI' })
          }]
        };
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(resolved)
        }]
      };
    }
  );
  
  // ============================================================================
  // Layer 2: DOCUMENTS & ASSETS
  // ============================================================================
  
  // Tool: document_save
  server.tool(
    'document_save',
    'Save a document to memory storage',
    {
      userId: z.string().describe('User ID'),
      title: z.string().describe('Document title'),
      content: z.string().describe('Document content'),
      docType: z.string().optional().default('note').describe('Document type')
    },
    async ({ userId, title, content, docType }) => {
      const result = await storeDocument({
        userId,
        title,
        content,
        docType: docType ?? 'note'
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result)
        }]
      };
    }
  );
  
  // Tool: document_abstract
  server.tool(
    'document_abstract',
    'Get L0 abstract (~50-100 tokens)',
    {
      documentId: z.string().describe('Document ID')
    },
    async ({ documentId }) => {
      // L0 abstract is stored in tiered_content
      // Placeholder - would query tiered_content for L0
      const doc = getDocumentById(documentId);
      if (!doc) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Document not found' })
          }]
        };
      }
      // Return truncated content as placeholder for L0
      const abstract = doc.content?.slice(0, 200) ?? '';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ abstract, documentId, tier: 'L0' })
        }]
      };
    }
  );
  
  // Tool: document_overview
  server.tool(
    'document_overview',
    'Get L1 overview (~500-2000 tokens)',
    {
      documentId: z.string().describe('Document ID')
    },
    async ({ documentId }) => {
      const doc = getDocumentById(documentId);
      if (!doc) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Document not found' })
          }]
        };
      }
      // Return truncated content as placeholder for L1
      const overview = doc.content?.slice(0, 1000) ?? '';
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ overview, documentId, tier: 'L1' })
        }]
      };
    }
  );
  
  // Tool: document_read
  server.tool(
    'document_read',
    'Get L2 full content',
    {
      documentId: z.string().describe('Document ID')
    },
    async ({ documentId }) => {
      const doc = getDocumentById(documentId);
      if (!doc) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Document not found' })
          }]
        };
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ 
            id: doc.id, 
            title: doc.title, 
            content: doc.content,
            docType: doc.doc_type,
            tier: 'L2'
          })
        }]
      };
    }
  );
  
  // Tool: asset_save
  server.tool(
    'asset_save',
    'Save binary asset (file, image, PDF)',
    {
      userId: z.string().describe('User ID'),
      filename: z.string().describe('Filename'),
      fileType: z.string().describe('File type (pdf, image, video, etc)'),
      fileSize: z.number().describe('File size in bytes'),
      storagePath: z.string().describe('Storage path')
    },
    async ({ userId, filename, fileType, fileSize, storagePath }) => {
      const result = await storeAsset({
        userId,
        filename,
        fileType,
        fileSize,
        storagePath
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result)
        }]
      };
    }
  );
  
  // ============================================================================
  // Layer 3: CONVERSATIONS & MESSAGES
  // ============================================================================
  
  // Tool: conversation_create
  server.tool(
    'conversation_create',
    'Create a new conversation',
    {
      userId: z.string().describe('User ID'),
      agentId: z.string().describe('Agent ID'),
      title: z.string().optional().describe('Conversation title')
    },
    async ({ userId, agentId, title }) => {
      const id = generateUUID();
      const conv = createConversation({
        id,
        user_id: userId,
        agent_id: agentId,
        title: title ?? `Conversation ${id}`
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(conv)
        }]
      };
    }
  );
  
  // Tool: message_save
  server.tool(
    'message_save',
    'Save a message in conversation',
    {
      conversationId: z.string().describe('Conversation ID'),
      role: z.enum(['user', 'assistant', 'system', 'tool']).describe('Message role'),
      content: z.string().describe('Message content')
    },
    async ({ conversationId, role, content }) => {
      const id = generateUUID();
      const msg = createMessage({
        id,
        conversation_id: conversationId,
        role,
        content
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(msg)
        }]
      };
    }
  );
  
  // ============================================================================
  // Layer 4: VECTOR + HYBRID SEARCH
  // ============================================================================
  
  // Tool: hybrid_search
  server.tool(
    'hybrid_search',
    'Hybrid search (FTS + Vector + RRF) for documents',
    {
      query: z.string().describe('Search query'),
      userId: z.string().optional().describe('User ID for scope filtering'),
      limit: z.number().optional().default(10).describe('Max results')
    },
    async ({ query, userId, limit }) => {
      // Placeholder - requires embedding implementation
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ results: [], query, userId, limit, type: 'hybrid' })
        }]
      };
    }
  );
  
  // Tool: semantic_search
  server.tool(
    'semantic_search',
    'Vector-only semantic search',
    {
      queryVector: z.array(z.number()).optional().describe('Query vector (768 dim)'),
      userId: z.string().optional().describe('User ID for scope'),
      limit: z.number().optional().default(10).describe('Max results')
    },
    async ({ queryVector, userId, limit }) => {
      // Placeholder - requires vector
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ results: [], userId, limit, type: 'semantic' })
        }]
      };
    }
  );
  
  // Tool: fts_search
  server.tool(
    'fts_search',
    'Full-text search (BM25)',
    {
      queryText: z.string().describe('Search query text'),
      userId: z.string().optional().describe('User ID for scope'),
      limit: z.number().optional().default(10).describe('Max results')
    },
    async ({ queryText, userId, limit }) => {
      // Placeholder - LanceDB FTS
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ results: [], queryText, userId, limit, type: 'fts' })
        }]
      };
    }
  );
  
  // Tool: progressive_search
  server.tool(
    'progressive_search',
    'Progressive disclosure search (L0→L1→L2)',
    {
      query: z.string().describe('Search query'),
      userId: z.string().describe('User ID'),
      tokenBudget: z.number().optional().default(500).describe('Token budget'),
      tier: z.enum(['L0', 'L1', 'L2']).optional().default('L0').describe('Starting tier')
    },
    async ({ query, userId, tokenBudget, tier }) => {
      // Placeholder - progressive disclosure
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ 
            results: [], 
            query, 
            userId, 
            tokenBudget, 
            tier,
            type: 'progressive'
          })
        }]
      };
    }
  );
  
  // ============================================================================
  // Layer 5: FACTS & ENTITY TREE
  // ============================================================================
  
  // Tool: fact_extract
  server.tool(
    'fact_extract',
    'Extract atomic facts from a source',
    {
      userId: z.string().describe('User ID'),
      sourceType: z.enum(['documents', 'messages', 'conversations']).describe('Source type'),
      sourceId: z.string().describe('Source ID'),
      content: z.string().describe('Content to extract from')
    },
    async ({ userId, sourceType, sourceId, content }) => {
      const extractor = getFactExtractor();
      const factIds = await extractor.extractAndSave({
        userId,
        sourceType,
        sourceId,
        content
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ factIds, sourceType, sourceId })
        }]
      };
    }
  );
  
  // Tool: fact_search
  server.tool(
    'fact_search',
    'Search facts by entity or content',
    {
      userId: z.string().describe('User ID'),
      factType: z.enum(['preference', 'decision', 'observation', 'conclusion']).optional().describe('Fact type'),
      verified: z.boolean().optional().describe('Verified status'),
      limit: z.number().optional().default(10).describe('Max results')
    },
    async ({ userId, factType, verified, limit }) => {
      const results = searchFacts({
        fact_type: factType,
        verified
      });
      // Filter by userId
      const filtered = results
        .filter(r => r.user_id === userId)
        .slice(0, limit ?? 10);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(filtered)
        }]
      };
    }
  );
  
  // Tool: fact_trace
  server.tool(
    'fact_trace',
    'Trace fact back to source documents/assets',
    {
      factId: z.string().describe('Fact ID to trace')
    },
    async ({ factId }) => {
      const fact = getFactById(factId);
      if (!fact) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Fact not found' })
          }]
        };
      }
      // Get source documents
      const sources = getFactsBySource(fact.source_type, fact.source_id);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ 
            fact,
            sources,
            trace: `${fact.source_type}:${fact.source_id}`
          })
        }]
      };
    }
  );
  
  // Tool: entity_tree_build
  server.tool(
    'entity_tree_build',
    'Build entity tree from facts',
    {
      userId: z.string().describe('User ID'),
      entities: z.array(z.object({
        name: z.string().describe('Entity name'),
        facts: z.array(z.string()).describe('Associated fact IDs')
      })).describe('Entities to build tree from')
    },
    async ({ userId, entities }) => {
      const builder = getEntityTreeBuilder();
      const result = await builder.buildTree(userId, entities);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ status: result, entitiesCount: entities.length })
        }]
      };
    }
  );
  
  // Tool: entity_tree_search
  server.tool(
    'entity_tree_search',
    'Search entity tree for related entities',
    {
      userId: z.string().describe('User ID'),
      entityName: z.string().describe('Entity name to search'),
      depth: z.number().optional().default(2).describe('Search depth')
    },
    async ({ userId, entityName }) => {
      const nodes = await searchEntityTree({
        userId,
        entityName
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(nodes)
        }]
      };
    }
  );
  
  // ============================================================================
  // Layer 2: MATERIALS FILESYSTEM
  // ============================================================================
  
  // Tool: materials_ls
  server.tool(
    'materials_ls',
    'List materials for a user',
    {
      userId: z.string().describe('User ID'),
      type: z.string().optional().describe('Material type filter')
    },
    async ({ userId, type }) => {
      const materials = await listMaterials({ userId, type });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(materials)
        }]
      };
    }
  );
  
  // Tool: materials_tree
  server.tool(
    'materials_tree',
    'Get materials tree structure',
    {
      userId: z.string().describe('User ID')
    },
    async ({ userId }) => {
      const tree = await getMaterialTree({ userId });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(tree)
        }]
      };
    }
  );
  
  // Tool: materials_grep
  server.tool(
    'materials_grep',
    'Search materials content',
    {
      userId: z.string().describe('User ID'),
      pattern: z.string().describe('Search pattern')
    },
    async ({ userId, pattern }) => {
      const results = await grepMaterials({
        scope: { userId },
        pattern
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results)
        }]
      };
    }
  );
  
  return server;
}

/**
 * Start MCP stdio server
 */
async function main(): Promise<void> {
  const server = await createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('agents-mem MCP server started with 24 tools');
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});