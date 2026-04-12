/**
 * @file src/tools/handlers.ts
 * @description MCP tool handlers
 */

import { storeDocument, storeAsset } from '../materials/store';
import { hybridSearchDocuments } from '../lance/hybrid_search';
import { getFactExtractor } from '../facts/extractor';
import { searchEntityTree } from '../entity_tree/search';
import { getEntityTreeBuilder } from '../entity_tree/builder';
import { listMaterials } from '../materials/filesystem';
import { getEmbedding } from '../embedder/ollama';

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
  
  // Task 3: hybrid_search handler - generate embedding and search
  hybrid_search: async (params) => {
    try {
      const query = params.query as string;
      const userId = params.userId as string;
      const limit = (params.limit as number) ?? 10;
      
      // Generate embedding for query
      const queryVector = await getEmbedding(query);
      
      // Perform hybrid search
      const results = await hybridSearchDocuments({
        queryVector,
        queryText: query,
        limit,
        scope: { userId }
      });
      
      return { results };
    } catch (error) {
      // Return error info when embedding fails
      return {
        results: [],
        error: `embedding_failed: ${error instanceof Error ? error.message : 'unknown error'}`
      };
    }
  },
  
  // Task 4: fact_extract handler - call extractor and return factIds
  fact_extract: async (params) => {
    const extractor = getFactExtractor();
    
    const factIds = await extractor.extractAndSave({
      userId: params.userId as string,
      sourceType: params.sourceType as string,
      sourceId: params.sourceId as string,
      content: params.content as string
    });
    
    return { factIds };
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
  },
  
  // Task 5: entity_tree_build handler - build tree from entities
  entity_tree_build: async (params) => {
    const userId = params.userId as string;
    const entities = params.entities as { name: string; facts: string[] }[] | undefined;
    
    // Validate entities
    if (!entities || entities.length === 0) {
      return { error: 'no_entities_provided' };
    }
    
    const builder = getEntityTreeBuilder();
    const status = await builder.buildTree(userId, entities);
    
    return {
      status,
      entitiesCount: entities.length
    };
  }
};

/**
 * Get handler for tool
 */
export function getHandler(toolName: string): ToolHandler | undefined {
  return TOOL_HANDLERS[toolName];
}