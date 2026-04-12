/**
 * @file tests/server.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPServer, startServer } from '../src/server';
import { resetConnection, closeConnection } from '../src/sqlite/connection';
import { resetManager } from '../src/sqlite/migrations';
import { setDatabasePath } from '../src/sqlite/connection';

describe('MCP Server', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  it('should create server', () => {
    const server = new MCPServer();
    expect(server).toBeDefined();
  });

  it('should list tools', async () => {
    const server = new MCPServer();
    await server.init();
    
    const tools = server.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should handle tool call', async () => {
    const server = new MCPServer();
    await server.init();
    
    const result = await server.handleToolCall('scope_set', { userId: 'test-user' });
    expect(result).toBeDefined();
  });

  it('should start server', async () => {
    const server = await startServer();
    expect(server).toBeDefined();
  });
});