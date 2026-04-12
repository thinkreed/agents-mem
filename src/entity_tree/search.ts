/**
 * @file src/entity_tree/search.ts
 * @description Entity tree search operations
 */

import { getRootNodes, getEntityNodesByParent, getEntityNodeById } from '../sqlite/entity_nodes';
import { meetsThreshold } from './threshold';
import { Scope } from '../core/types';

/**
 * Search entity tree
 */
export async function searchEntityTree(query: {
  userId: string;
  entityName?: string;
  minImportance?: number;
}): Promise<ReturnType<typeof getEntityNodeById>[]> {
  const roots = getRootNodes(query.userId);
  
  if (query.entityName) {
    return roots.filter(r => r.entity_name.includes(query.entityName!));
  }
  
  return roots;
}

/**
 * Fold tree for progressive disclosure
 */
export async function foldTree(nodeId: string, similarity: number): Promise<string> {
  const node = getEntityNodeById(nodeId);
  if (!node) return nodeId;
  
  // If similarity meets threshold, fold into parent
  if (node.parent_id && meetsThreshold(similarity, node.depth)) {
    return foldTree(node.parent_id, similarity);
  }
  
  return nodeId;
}

/**
 * Get tree path to node
 */
export async function getTreePath(nodeId: string): Promise<string[]> {
  const path: string[] = [];
  let current = getEntityNodeById(nodeId);
  
  while (current) {
    path.unshift(current.entity_name);
    if (current.parent_id) {
      current = getEntityNodeById(current.parent_id);
    } else {
      break;
    }
  }
  
  return path;
}