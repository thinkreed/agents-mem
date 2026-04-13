/**
 * @file src/materials/store.ts
 * @description Material store operations
 */

import { createDocument, updateDocument, getDocumentById } from '../sqlite/documents';
import { createAsset, getAssetById } from '../sqlite/assets';
import { createMemoryIndex } from '../sqlite/memory_index';
import { buildMaterialURI } from './uri_resolver';
import { generateUUID } from '../utils/uuid';
import { getEmbeddingQueue } from '../queue';
import { getOpenVikingClient, getScopeMapper, getURIAdapter } from '../openviking';

/**
 * Store document
 */
export async function storeDocument(input: {
  userId: string;
  agentId?: string;
  teamId?: string;
  docType: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; uri: string }> {
  const id = generateUUID();
  
  const doc = createDocument({
    id,
    user_id: input.userId,
    agent_id: input.agentId,
    team_id: input.teamId,
    doc_type: input.docType,
    title: input.title,
    content: input.content,
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined
  });
  
  const uri = buildMaterialURI({
    userId: input.userId,
    agentId: input.agentId,
    teamId: input.teamId,
    type: 'documents',
    id: doc.id
  });
  
  createMemoryIndex({
    uri,
    user_id: input.userId,
    agent_id: input.agentId,
    team_id: input.teamId,
    target_type: 'documents',
    target_id: doc.id,
    title: input.title
  });
  
  // Add content to OpenViking (handles embedding and FTS automatically)
  try {
    const scopeMapper = getScopeMapper();
    const uriAdapter = getURIAdapter();
    const client = getOpenVikingClient();
    
    // Build target URI for OpenViking
    const scope = { userId: input.userId, agentId: input.agentId, teamId: input.teamId };
    const targetUri = uriAdapter.buildTargetUri(scope, 'documents');
    
    // Add resource to OpenViking
    const result = await client.addResource({
      content: `${input.title}\n\n${input.content}`,
      targetUri,
      reason: `Adding document: ${input.title}`,
      wait: true
    });
    
    // Update document with OpenViking URI
    if (result.rootUri) {
      updateDocument(doc.id, { openviking_uri: result.rootUri });
    }
  } catch (err) {
    console.error('Failed to add document to OpenViking:', err);
    // Continue even if OpenViking fails - document is still stored in SQLite
  }
  
  return { id: doc.id, uri };
}

/**
 * Store asset
 */
export async function storeAsset(input: {
  userId: string;
  agentId?: string;
  teamId?: string;
  filename: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}): Promise<{ id: string; uri: string }> {
  const id = generateUUID();
  
  const asset = createAsset({
    id,
    user_id: input.userId,
    agent_id: input.agentId,
    team_id: input.teamId,
    filename: input.filename,
    file_type: input.fileType,
    file_size: input.fileSize,
    storage_path: input.storagePath
  });
  
  const uri = buildMaterialURI({
    userId: input.userId,
    agentId: input.agentId,
    teamId: input.teamId,
    type: 'assets',
    id: asset.id
  });
  
  createMemoryIndex({
    uri,
    user_id: input.userId,
    agent_id: input.agentId,
    team_id: input.teamId,
    target_type: 'assets',
    target_id: asset.id,
    title: input.filename
  });
  
  return { id: asset.id, uri };
}