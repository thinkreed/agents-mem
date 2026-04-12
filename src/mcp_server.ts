/**
 * @file src/mcp_server.ts
 * @description MCP stdio server entry point
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runMigrations } from './sqlite/migrations';
import { storeDocument } from './materials/store';
import { hybridSearchDocuments } from './lance/hybrid_search';
import { getFactExtractor } from './facts/extractor';
import { searchEntityTree } from './entity_tree/search';
import { listMaterials } from './materials/filesystem';

/**
 * Create MCP server with all tools
 */
async function createMCPServer(): Promise<McpServer> {
  // Run migrations first
  runMigrations();
  
  const server = new McpServer({
    name: 'agents-mem',
    version: '1.0.0'
  });
  
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
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ scope: { userId, agentId, teamId } })
        }]
      };
    }
  );
  
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
          text: JSON.stringify({ results: [], query, userId, limit })
        }]
      };
    }
  );
  
  // Tool: fact_extract
  server.tool(
    'fact_extract',
    'Extract atomic facts from a source',
    {
      sourceType: z.string().describe('Source type (document, message, etc)'),
      sourceId: z.string().describe('Source ID')
    },
    async ({ sourceType, sourceId }) => {
      const extractor = getFactExtractor();
      // Placeholder - requires full implementation
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ factIds: [], sourceType, sourceId })
        }]
      };
    }
  );
  
  // Tool: materials_ls
  server.tool(
    'materials_ls',
    'List materials for a user',
    {
      userId: z.string().describe('User ID')
    },
    async ({ userId }) => {
      const materials = await listMaterials({ userId });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(materials)
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
    async ({ userId, entityName, depth }) => {
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
  
  return server;
}

/**
 * Start MCP stdio server
 */
async function main(): Promise<void> {
  const server = await createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('agents-mem MCP server started');
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});