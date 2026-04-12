/**
 * @file src/server.ts
 * @description MCP server entry point
 */

import { getToolRegistry, RegisteredTool } from './tools/registry';
import { runMigrations } from './sqlite/migrations';

/**
 * MCP Server
 */
export class MCPServer {
  private registry: ReturnType<typeof getToolRegistry>;
  
  constructor() {
    this.registry = getToolRegistry();
  }
  
  /**
   * Initialize server
   */
  async init(): Promise<void> {
    runMigrations();
  }
  
  /**
   * List tools
   */
  listTools(): RegisteredTool[] {
    return this.registry.list();
  }
  
  /**
   * Handle tool call
   */
  async handleToolCall(name: string, params: Record<string, unknown>): Promise<unknown> {
    const tool = this.registry.get(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    return tool.handler(params);
  }
}

/**
 * Start server
 */
export async function startServer(): Promise<MCPServer> {
  const server = new MCPServer();
  await server.init();
  return server;
}