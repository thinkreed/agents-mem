/**
 * @file src/materials/store.ts
 * @description Material store operations
 */

import { createDocument, getDocumentById } from '../sqlite/documents';
import { createAsset, getAssetById } from '../sqlite/assets';
import { createMemoryIndex } from '../sqlite/memory_index';
import { buildMaterialURI } from './uri_resolver';
import { generateUUID } from '../utils/uuid';
import { getEmbeddingQueue } from '../queue';

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
  
  // Queue async embedding generation
  const queue = getEmbeddingQueue();
  await queue.addJob({
    type: 'embedding',
    resourceId: doc.id,
    resourceType: 'document',
    payload: { content: input.content, title: input.title },
    userId: input.userId,
    agentId: input.agentId,
    teamId: input.teamId
  });
  
  // Start background processing (fire-and-forget)
  queue.process().catch(err => console.error('Queue processing error:', err));
  
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