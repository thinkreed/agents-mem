/**
 * @file src/tools/registry.ts
 * @description Tool registry
 */

import { getToolDefinitions, ToolDefinition } from './definitions';
import { getHandler, ToolHandler } from './handlers';

/**
 * Registered tool
 */
export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

/**
 * Tool registry
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  
  constructor() {
    this.registerAll();
  }
  
  /**
   * Register all tools
   */
  private registerAll(): void {
    const definitions = getToolDefinitions();
    
    for (const def of definitions) {
      const handler = getHandler(def.name);
      if (handler) {
        this.tools.set(def.name, { definition: def, handler });
      }
    }
  }
  
  /**
   * Get tool by name
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * List all tools
   */
  list(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get tool names
   */
  names(): string[] {
    return Array.from(this.tools.keys());
  }
}

/**
 * Singleton registry
 */
let registryInstance: ToolRegistry | null = null;

/**
 * Get tool registry
 */
export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}