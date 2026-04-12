/**
 * @file src/tools/handlers.ts
 * @description MCP tool handlers
 */

import { storeDocument, storeAsset } from '../materials/store';
import { hybridSearchDocuments } from '../lance/hybrid_search';
import { getFactExtractor } from '../facts/extractor';
import { searchEntityTree } from '../entity_tree/search';
import { listMaterials } from '../materials/filesystem';

/**
 * Tool handler function type
 */
export type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

/**
 * Tool handlers map
 */
export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  scope_set: async (params) => {
    return { scope: params };
  },
  
  document_save: async (params) => {
    const result = await storeDocument({
      userId: params.userId as string,
      title: params.title as string,
      content: params.content as string,
      docType: (params.docType as string) ?? 'note'
    });
    return result;
  },
  
  hybrid_search: async (params) => {
    // Placeholder - requires embedding
    return { results: [] };
  },
  
  fact_extract: async (params) => {
    const extractor = getFactExtractor();
    return { factIds: [] };
  },
  
  materials_ls: async (params) => {
    const materials = await listMaterials({
      userId: params.userId as string
    });
    return materials;
  },
  
  entity_tree_search: async (params) => {
    const nodes = await searchEntityTree({
      userId: params.userId as string,
      entityName: params.entityName as string
    });
    return nodes;
  }
};

/**
 * Get handler for tool
 */
export function getHandler(toolName: string): ToolHandler | undefined {
  return TOOL_HANDLERS[toolName];
}