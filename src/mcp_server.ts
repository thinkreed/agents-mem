/**
 * @file src/mcp_server.ts
 * @description MCP stdio server entry point with 4 CRUD tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runMigrations } from './sqlite/migrations';
import { handleMemCreate, handleMemRead, handleMemUpdate, handleMemDelete } from './tools/crud_handlers';

/**
 * Create MCP server with 4 CRUD tools
 */
async function createMCPServer(): Promise<McpServer> {
  // Run migrations first
  runMigrations();
  
  const server = new McpServer({
    name: 'agents-mem',
    version: '1.0.0'
  });

  // ============================================================================
  // CRUD Tools (4 tools)
  // ============================================================================

  // Tool: mem_create
  server.tool(
    'mem_create',
    'Create a resource (document, asset, conversation, message, fact, team)',
    {
      resource: z.enum(['document', 'asset', 'conversation', 'message', 'fact', 'team']).describe('Resource type'),
      data: z.record(z.unknown()).describe('Resource data'),
      scope: z.object({
        userId: z.string().optional().describe('User ID'),
        agentId: z.string().optional().describe('Agent ID'),
        teamId: z.string().optional().describe('Team ID')
      }).optional().describe('Scope')
    },
    async ({ resource, data, scope }) => {
      return handleMemCreate({ resource, data, scope });
    }
  );

  // Tool: mem_read
  server.tool(
    'mem_read',
    'Read/search resources (document, asset, conversation, message, fact, team)',
    {
      resource: z.enum(['document', 'asset', 'conversation', 'message', 'fact', 'team']).describe('Resource type'),
      query: z.record(z.unknown()).optional().describe('Query parameters'),
      scope: z.object({
        userId: z.string().optional().describe('User ID'),
        agentId: z.string().optional().describe('Agent ID'),
        teamId: z.string().optional().describe('Team ID')
      }).optional().describe('Scope')
    },
    async ({ resource, query, scope }) => {
      return handleMemRead({ resource, query, scope });
    }
  );

  // Tool: mem_update
  server.tool(
    'mem_update',
    'Update a resource (document, asset, conversation, message, fact, team)',
    {
      resource: z.enum(['document', 'asset', 'conversation', 'message', 'fact', 'team']).describe('Resource type'),
      id: z.string().describe('Resource ID'),
      data: z.record(z.unknown()).describe('Update data'),
      scope: z.object({
        userId: z.string().optional().describe('User ID'),
        agentId: z.string().optional().describe('Agent ID'),
        teamId: z.string().optional().describe('Team ID')
      }).optional().describe('Scope')
    },
    async ({ resource, id, data, scope }) => {
      return handleMemUpdate({ resource, id, data, scope });
    }
  );

  // Tool: mem_delete
  server.tool(
    'mem_delete',
    'Delete a resource (document, asset, conversation, message, fact, team)',
    {
      resource: z.enum(['document', 'asset', 'conversation', 'message', 'fact', 'team']).describe('Resource type'),
      id: z.string().describe('Resource ID'),
      scope: z.object({
        userId: z.string().optional().describe('User ID'),
        agentId: z.string().optional().describe('Agent ID'),
        teamId: z.string().optional().describe('Team ID')
      }).optional().describe('Scope')
    },
    async ({ resource, id, scope }) => {
      return handleMemDelete({ resource, id, scope });
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
  console.error('agents-mem MCP server started with 4 CRUD tools');
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});