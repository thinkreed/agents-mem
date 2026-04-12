/**
 * @file src/entity_tree/builder.ts
 * @description Entity tree builder
 */

import { createEntityNode, getEntityNodeById, getRootNodes } from '../sqlite/entity_nodes';
import { generateUUID } from '../utils/uuid';
import { updateParentAggregation } from './aggregator';
import { getThresholdForDepth } from './threshold';

/**
 * Entity tree builder
 */
export class EntityTreeBuilder {
  /**
   * Build tree from entities
   */
  async buildTree(userId: string, entities: { name: string; facts: string[] }[]): Promise<string> {
    // Create root nodes for each entity
    for (const entity of entities) {
      const nodeId = generateUUID();
      
      createEntityNode({
        id: nodeId,
        user_id: userId,
        entity_name: entity.name,
        depth: 0,
        threshold: getThresholdForDepth(0),
        linked_fact_ids: JSON.stringify(entity.facts)
      });
    }
    
    return 'built';
  }
  
  /**
   * Add child to node
   */
  async addChild(parentNodeId: string, entityName: string, facts: string[]): Promise<string> {
    const parent = getEntityNodeById(parentNodeId);
    if (!parent) throw new Error('Parent not found');
    
    const childId = generateUUID();
    const childDepth = parent.depth + 1;
    
    createEntityNode({
      id: childId,
      parent_id: parentNodeId,
      user_id: parent.user_id,
      agent_id: parent.agent_id,
      team_id: parent.team_id,
      entity_name: entityName,
      depth: childDepth,
      threshold: getThresholdForDepth(childDepth),
      linked_fact_ids: JSON.stringify(facts)
    });
    
    await updateParentAggregation(parentNodeId);
    
    return childId;
  }
}

/**
 * Singleton builder
 */
let builderInstance: EntityTreeBuilder | null = null;

/**
 * Get entity tree builder
 */
export function getEntityTreeBuilder(): EntityTreeBuilder {
  if (!builderInstance) {
    builderInstance = new EntityTreeBuilder();
  }
  return builderInstance;
}