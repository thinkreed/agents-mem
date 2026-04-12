/**
 * @file src/materials/filesystem.ts
 * @description File system operations for materials
 */

import { getDocumentById } from '../sqlite/documents';
import { getAssetById } from '../sqlite/assets';
import { getMemoryIndexesByScope } from '../sqlite/memory_index';
import { searchDocuments } from '../sqlite/documents';
import { resolveURI } from './uri_resolver';

/**
 * List materials by scope
 */
export async function listMaterials(scope: {
  userId: string;
  agentId?: string;
  teamId?: string;
  type?: string;
}): Promise<{ id: string; uri: string; title: string }[]> {
  // Query memory_index for all materials in scope
  const indexes = getMemoryIndexesByScope({
    userId: scope.userId,
    agentId: scope.agentId,
    teamId: scope.teamId
  });
  
  // Filter by type if provided
  const filtered = scope.type 
    ? indexes.filter(idx => idx.target_type === scope.type)
    : indexes;
  
  // Map to return format
  return filtered.map(idx => ({
    id: idx.target_id,
    uri: idx.uri,
    title: idx.title
  }));
}

/**
 * Get material tree
 */
export async function getMaterialTree(scope: {
  userId: string;
  agentId?: string;
  teamId?: string;
}): Promise<Record<string, string[]>> {
  // Query memory_index for all materials in scope
  const indexes = getMemoryIndexesByScope({
    userId: scope.userId,
    agentId: scope.agentId,
    teamId: scope.teamId
  });
  
  // Group by target_type
  const tree: Record<string, string[]> = {
    documents: [],
    assets: [],
    facts: [],
    tiered: [],
    conversations: [],
    messages: []
  };
  
  for (const idx of indexes) {
    const type = idx.target_type;
    if (tree[type]) {
      tree[type].push(idx.uri);
    }
  }
  
  return tree;
}

/**
 * Grep materials for content
 */
export async function grepMaterials(query: {
  scope: { userId: string; agentId?: string; teamId?: string };
  pattern: string;
}): Promise<{ uri: string; matches: string[] }[]> {
  if (!query.pattern || query.pattern.trim() === '') {
    return [];
  }
  
  // Search documents for matching content using SQLite LIKE
  const docs = searchDocuments({
    title_contains: query.pattern
  });
  
  // Filter by scope
  const scopedDocs = docs.filter(doc => {
    if (doc.user_id !== query.scope.userId) return false;
    if (query.scope.agentId && doc.agent_id !== query.scope.agentId) return false;
    if (query.scope.teamId && doc.team_id !== query.scope.teamId) return false;
    return true;
  });
  
  // Map to return format
  return scopedDocs.map(doc => ({
    uri: `mem://${doc.user_id}/${doc.agent_id ?? '_'}/${doc.team_id ?? '_'}/documents/${doc.id}`,
    matches: [doc.title]
  }));
}

/**
 * Read material by URI
 */
export async function readMaterial(uri: string): Promise<string | null> {
  const resolved = resolveURI(uri);
  if (!resolved) return null;
  
  if (resolved.type === 'documents') {
    const doc = getDocumentById(resolved.id);
    return doc?.content ?? null;
  }
  
  if (resolved.type === 'assets') {
    const asset = getAssetById(resolved.id);
    return asset?.extracted_text ?? null;
  }
  
  return null;
}