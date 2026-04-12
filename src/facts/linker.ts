/**
 * @file src/facts/linker.ts
 * @description Fact to entity linking
 */

import { getFactById } from '../sqlite/facts';
import { createEntityNode, getEntityNodeById, updateEntityNode } from '../sqlite/entity_nodes';
import { generateUUID } from '../utils/uuid';

/**
 * Link fact to entity nodes
 */
export async function linkFactToEntities(factId: string, entities: string[]): Promise<string[]> {
  const fact = getFactById(factId);
  if (!fact) return [];
  
  const nodeIds: string[] = [];
  
  for (const entityName of entities) {
    // Create or update entity node
    const nodeId = generateUUID();
    
    createEntityNode({
      id: nodeId,
      user_id: fact.user_id,
      agent_id: fact.agent_id,
      team_id: fact.team_id,
      entity_name: entityName,
      depth: 0,
      linked_fact_ids: JSON.stringify([factId])
    });
    
    nodeIds.push(nodeId);
  }
  
  return nodeIds;
}

/**
 * Get facts linked to entity
 */
export async function getFactsForEntity(entityNodeId: string): Promise<string[]> {
  const node = getEntityNodeById(entityNodeId);
  if (!node?.linked_fact_ids) return [];
  
  return JSON.parse(node.linked_fact_ids);
}