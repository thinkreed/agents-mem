/**
 * @file src/tools/definitions.ts
 * @description MCP tool definitions
 */

/**
 * Tool definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * All MCP tool definitions
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'scope_set',
    description: 'Set agent scope',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        agentId: { type: 'string' },
        teamId: { type: 'string' }
      },
      required: ['userId']
    }
  },
  {
    name: 'document_save',
    description: 'Save document',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        docType: { type: 'string' }
      },
      required: ['userId', 'title', 'content']
    }
  },
  {
    name: 'hybrid_search',
    description: 'Hybrid search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' }
      },
      required: ['query']
    }
  },
  {
    name: 'fact_extract',
    description: 'Extract facts',
    inputSchema: {
      type: 'object',
      properties: {
        sourceType: { type: 'string' },
        sourceId: { type: 'string' }
      },
      required: ['sourceType', 'sourceId']
    }
  }
];

/**
 * Get tool definitions
 */
export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}