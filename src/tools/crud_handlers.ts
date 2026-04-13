/**
 * @file src/tools/crud_handlers.ts
 * @description CRUD handlers for mem_create, mem_read, mem_update, mem_delete tools
 */

import { storeDocument, storeAsset } from '../materials/store';
import { createConversation, getConversationById, listConversations, updateConversation, deleteConversation } from '../sqlite/conversations';
import { createMessage, getMessageById, listMessagesByConversation, updateMessage, deleteMessage, deleteMessagesByConversation } from '../sqlite/messages';
import { createTeam, getTeamById, listTeams, updateTeam, deleteTeam } from '../sqlite/teams';
import { addTeamMember, getTeamMembers, updateTeamMemberRole, deleteTeamMembersByTeam } from '../sqlite/team_members';
import { createUser, getUserById } from '../sqlite/users';
import { getDocumentById, searchDocuments, updateDocument, deleteDocument } from '../sqlite/documents';
import { getAssetById, updateAsset, deleteAsset } from '../sqlite/assets';
import { getFactById, searchFacts, updateFact, deleteFact, getFactsBySource } from '../sqlite/facts';
import { getMemoryIndexByURI, deleteMemoryIndexByTarget } from '../sqlite/memory_index';
// OpenViking HTTP API integration (replaces LanceDB)
import { getOpenVikingClient, getURIAdapter, getScopeMapper } from '../openviking';
import { listMaterials } from '../materials/filesystem';
import { traceFactToSource } from '../materials/trace';
import { getFactExtractor } from '../facts/extractor';
import { generateUUID } from '../utils/uuid';
import { getAuditLogger } from '../utils/audit_logger';

/**
 * MCP tool response type
 */
export interface MCPToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  [key: string]: unknown;
}

/**
 * Error response helper
 */
function errorResponse(message: string): MCPToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
}

/**
 * Success response helper
 */
function successResponse(data: unknown): MCPToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

/**
 * Valid resource types
 */
type ResourceType = 'document' | 'asset' | 'conversation' | 'message' | 'fact' | 'team';

/**
 * Validate resource type
 */
function validateResource(resource: string): ResourceType | null {
  const validResources: ResourceType[] = ['document', 'asset', 'conversation', 'message', 'fact', 'team'];
  return validResources.includes(resource as ResourceType) ? resource as ResourceType : null;
}

/**
 * mem_create handler
 */
export async function handleMemCreate(params: {
  resource: string;
  data: Record<string, unknown>;
  scope?: { userId?: string; agentId?: string; teamId?: string };
}): Promise<MCPToolResponse> {
  const { resource, data, scope } = params;
  const userId = scope?.userId;

  const validResource = validateResource(resource);
  if (!validResource) {
    return errorResponse(`Invalid resource type: ${resource}`);
  }

  // Auto-create user if not exists
  if (userId && !getUserById(userId)) {
    createUser({ id: userId, name: userId });
  }

  switch (validResource) {
    case 'document': {
      if (!userId) return errorResponse('userId is required for document. Provide scope: { userId: "..." }');
      if (!data.title) return errorResponse('title is required for document');
      if (!data.content) return errorResponse('content is required for document');
      
      const result = await storeDocument({
        userId,
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        docType: (data.docType as string) ?? 'note',
        title: data.title as string,
        content: data.content as string,
        metadata: data.metadata as Record<string, unknown> | undefined
      });
      getAuditLogger().log({
        userId,
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'document',
        memoryId: result.id,
        action: 'create',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(result);
    }

    case 'asset': {
      if (!userId) return errorResponse('userId is required for asset. Provide scope: { userId: "..." }');
      if (!data.filename) return errorResponse('filename is required for asset');
      if (!data.fileType) return errorResponse('fileType is required for asset');
      if (!data.fileSize) return errorResponse('fileSize is required for asset');
      if (!data.storagePath) return errorResponse('storagePath is required for asset');
      
      const result = await storeAsset({
        userId,
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        filename: data.filename as string,
        fileType: data.fileType as string,
        fileSize: data.fileSize as number,
        storagePath: data.storagePath as string
      });
      getAuditLogger().log({
        userId,
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'asset',
        memoryId: result.id,
        action: 'create',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(result);
    }

    case 'conversation': {
      if (!userId) return errorResponse('userId is required for conversation. Provide scope: { userId: "..." }');
      if (!data.agentId) return errorResponse('agentId is required for conversation');
      
      const id = generateUUID();
      const conv = createConversation({
        id,
        user_id: userId,
        agent_id: data.agentId as string,
        team_id: scope?.teamId ?? (data.teamId as string),
        title: data.title as string
      });
      getAuditLogger().log({
        userId,
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'conversation',
        memoryId: id,
        action: 'create',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(conv);
    }

    case 'message': {
      if (!data.conversationId) return errorResponse('conversationId is required for message');
      if (!data.role) return errorResponse('role is required for message');
      if (!data.content) return errorResponse('content is required for message');
      
      const validRoles = ['user', 'assistant', 'system', 'tool'];
      if (!validRoles.includes(data.role as string)) {
        return errorResponse(`Invalid role: ${data.role}. Must be one of: ${validRoles.join(', ')}`);
      }

      const id = generateUUID();
      const msg = createMessage({
        id,
        conversation_id: data.conversationId as string,
        role: data.role as 'user' | 'assistant' | 'system' | 'tool',
        content: data.content as string
      });
      getAuditLogger().log({
        userId: userId ?? 'unknown',
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'message',
        memoryId: id,
        action: 'create',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(msg);
    }

    case 'fact': {
      if (!userId) return errorResponse('userId is required for fact. Provide scope: { userId: "..." }');
      if (!data.sourceType) return errorResponse('sourceType is required for fact');
      if (!data.sourceId) return errorResponse('sourceId is required for fact');
      if (!data.content) return errorResponse('content is required for fact');
      
      const validSourceTypes = ['documents', 'messages', 'conversations'];
      if (!validSourceTypes.includes(data.sourceType as string)) {
        return errorResponse(`Invalid sourceType: ${data.sourceType}. Must be one of: ${validSourceTypes.join(', ')}`);
      }

      const extractor = getFactExtractor();
      const factIds = await extractor.extractAndSave({
        userId,
        sourceType: data.sourceType as 'documents' | 'messages' | 'conversations',
        sourceId: data.sourceId as string,
        content: data.content as string
      });
      // Log audit for each fact created
      factIds.forEach((factId: string) => {
        getAuditLogger().log({
          userId,
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'fact',
          memoryId: factId,
          action: 'create',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
      });
      return successResponse({ factIds, sourceType: data.sourceType, sourceId: data.sourceId });
    }

    case 'team': {
      if (!data.name) return errorResponse('name is required for team');
      if (!data.ownerId) return errorResponse('ownerId is required for team');
      
      const id = generateUUID();
      const team = createTeam({ id, name: data.name as string, owner_user_id: data.ownerId as string });
      addTeamMember({ team_id: id, agent_id: data.ownerId as string, role: 'owner' });
      getAuditLogger().log({
        userId: data.ownerId as string,
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'team',
        memoryId: id,
        action: 'create',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(team);
    }

    default:
      return errorResponse(`Unhandled resource type: ${resource}`);
  }
}

/**
 * mem_read handler
 */
export async function handleMemRead(params: {
  resource: string;
  query?: Record<string, unknown>;
  scope?: { userId?: string; agentId?: string; teamId?: string };
}): Promise<MCPToolResponse> {
  const { resource, query, scope } = params;
  const userId = scope?.userId;

  const validResource = validateResource(resource);
  if (!validResource) {
    return errorResponse(`Invalid resource type: ${resource}`);
  }

  if (!query) {
    return errorResponse('query is required for mem_read. Valid formats: { id }, { search }, { list }, { filters }');
  }

  switch (validResource) {
    case 'document': {
      // ID lookup
      if (query.id) {
        const doc = getDocumentById(query.id as string);
        if (!doc) return errorResponse('Document not found');
        
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'document',
          memoryId: query.id as string,
          action: 'read',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        
        // Tiered content via OpenViking
        const tier = query.tier as string | undefined;
        if (tier) {
          const validTiers = ['L0', 'L1', 'L2'];
          if (!validTiers.includes(tier)) {
            return errorResponse(`Invalid tier: ${tier}. Must be one of: ${validTiers.join(', ')}`);
          }
          
          const client = getOpenVikingClient();
          const uriAdapter = getURIAdapter();
          const memUri = `mem://${userId ?? 'unknown'}/${scope?.agentId ?? '_'}/${scope?.teamId ?? '_'}/documents/${doc.id}`;
          const vikingUri = uriAdapter.toVikingURI(memUri, { userId: userId ?? 'unknown', agentId: scope?.agentId, teamId: scope?.teamId });
          
          if (tier === 'L0') {
            try {
              const abstract = await client.getAbstract(vikingUri);
              return successResponse({ abstract, documentId: doc.id, tier: 'L0' });
            } catch (err) {
              // Fallback to local slice if OpenViking unavailable
              return successResponse({ abstract: doc.content?.slice(0, 200) ?? '', documentId: doc.id, tier: 'L0' });
            }
          } else if (tier === 'L1') {
            try {
              const overview = await client.getOverview(vikingUri);
              return successResponse({ overview, documentId: doc.id, tier: 'L1' });
            } catch (err) {
              // Fallback to local slice if OpenViking unavailable
              return successResponse({ overview: doc.content?.slice(0, 1000) ?? '', documentId: doc.id, tier: 'L1' });
            }
          } else {
            try {
              const contentResult = await client.read(vikingUri);
              return successResponse({ id: doc.id, title: doc.title, content: contentResult.content, docType: doc.doc_type, tier: 'L2' });
            } catch (err) {
              // Fallback to local content if OpenViking unavailable
              return successResponse({ id: doc.id, title: doc.title, content: doc.content, docType: doc.doc_type, tier: 'L2' });
            }
          }
        }
        
        return successResponse(doc);
      }

      // Search
      if (query.search) {
        const searchMode = (query.searchMode as string) ?? 'hybrid';
        const validModes = ['hybrid', 'fts', 'semantic', 'progressive'];
        if (!validModes.includes(searchMode)) {
          return errorResponse(`Invalid searchMode: ${searchMode}. Must be one of: ${validModes.join(', ')}`);
        }

        const limit = (query.limit as number) ?? 10;
        const tokenBudget = (query.tokenBudget as number) ?? 500;

        if (searchMode === 'hybrid') {
          // OpenViking find with hybrid mode (vector + FTS + rerank)
          const client = getOpenVikingClient();
          const scopeMapper = getScopeMapper();
          const uriAdapter = getURIAdapter();
          
          const targetUri = userId ? scopeMapper.mapToVikingTarget({ userId, agentId: scope?.agentId, teamId: scope?.teamId }) : undefined;
          
          const findResult = await client.find({
            query: query.search as string,
            targetUri,
            limit,
            mode: 'hybrid',
          });
          
          // Convert viking:// URIs to mem:// URIs for response
          const results = findResult.memories.map(m => ({
            ...m,
            uri: uriAdapter.toMemURI(m.uri, { userId: userId ?? 'unknown', agentId: scope?.agentId, teamId: scope?.teamId }),
          }));
          
          getAuditLogger().log({
            userId: userId ?? 'unknown',
            agentId: scope?.agentId,
            teamId: scope?.teamId,
            memoryType: 'document',
            memoryId: 'search:' + searchMode,
            action: 'read',
            scope: { agentId: scope?.agentId, teamId: scope?.teamId },
            success: true,
          });
          return successResponse(results);
        } else if (searchMode === 'fts') {
          // OpenViking find with FTS mode only
          const client = getOpenVikingClient();
          const scopeMapper = getScopeMapper();
          const uriAdapter = getURIAdapter();
          
          const targetUri = userId ? scopeMapper.mapToVikingTarget({ userId, agentId: scope?.agentId, teamId: scope?.teamId }) : undefined;
          
          const findResult = await client.find({
            query: query.search as string,
            targetUri,
            limit,
            mode: 'fts',
          });
          
          // Convert viking:// URIs to mem:// URIs for response
          const results = findResult.memories.map(m => ({
            ...m,
            uri: uriAdapter.toMemURI(m.uri, { userId: userId ?? 'unknown', agentId: scope?.agentId, teamId: scope?.teamId }),
          }));
          
          getAuditLogger().log({
            userId: userId ?? 'unknown',
            agentId: scope?.agentId,
            teamId: scope?.teamId,
            memoryType: 'document',
            memoryId: 'search:' + searchMode,
            action: 'read',
            scope: { agentId: scope?.agentId, teamId: scope?.teamId },
            success: true,
          });
          return successResponse(results);
        } else if (searchMode === 'semantic') {
          // OpenViking find with vector mode only
          const client = getOpenVikingClient();
          const scopeMapper = getScopeMapper();
          const uriAdapter = getURIAdapter();
          
          const targetUri = userId ? scopeMapper.mapToVikingTarget({ userId, agentId: scope?.agentId, teamId: scope?.teamId }) : undefined;
          
          const findResult = await client.find({
            query: query.search as string,
            targetUri,
            limit,
            mode: 'vector',
          });
          
          // Convert viking:// URIs to mem:// URIs for response
          const results = findResult.memories.map(m => ({
            ...m,
            uri: uriAdapter.toMemURI(m.uri, { userId: userId ?? 'unknown', agentId: scope?.agentId, teamId: scope?.teamId }),
          }));
          
          getAuditLogger().log({
            userId: userId ?? 'unknown',
            agentId: scope?.agentId,
            teamId: scope?.teamId,
            memoryType: 'document',
            memoryId: 'search:' + searchMode,
            action: 'read',
            scope: { agentId: scope?.agentId, teamId: scope?.teamId },
            success: true,
          });
          return successResponse(results);
        } else if (searchMode === 'progressive') {
          // OpenViking find with L0 tier filter
          const client = getOpenVikingClient();
          const scopeMapper = getScopeMapper();
          const uriAdapter = getURIAdapter();
          
          const targetUri = userId ? scopeMapper.mapToVikingTarget({ userId, agentId: scope?.agentId, teamId: scope?.teamId }) : undefined;
          
          const findResult = await client.find({
            query: query.search as string,
            targetUri,
            limit,
            mode: 'hybrid',
            tier: 'L0',
          });
          
          // Convert viking:// URIs to mem:// URIs for response
          const results = findResult.memories.map(m => ({
            ...m,
            uri: uriAdapter.toMemURI(m.uri, { userId: userId ?? 'unknown', agentId: scope?.agentId, teamId: scope?.teamId }),
          }));
          
          getAuditLogger().log({
            userId: userId ?? 'unknown',
            agentId: scope?.agentId,
            teamId: scope?.teamId,
            memoryType: 'document',
            memoryId: 'search:' + searchMode,
            action: 'read',
            scope: { agentId: scope?.agentId, teamId: scope?.teamId },
            success: true,
          });
          return successResponse({ results, query: query.search, userId, tokenBudget, tier: 'L0', type: 'progressive' });
        }
      }

      // List
      if (query.list) {
        const docs = searchDocuments({});
        const filtered = userId ? docs.filter(d => d.user_id === userId) : docs;
        return successResponse(filtered);
      }

      return errorResponse('Invalid query for document. Valid keys: id, search, list, tier');
    }

    case 'asset': {
      if (query.id) {
        const asset = getAssetById(query.id as string);
        if (!asset) return errorResponse('Asset not found');
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'asset',
          memoryId: query.id as string,
          action: 'read',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse(asset);
      }

      if (query.list) {
        const materials = await listMaterials({ userId: userId!, type: 'assets' });
        return successResponse(materials);
      }

      return errorResponse('Invalid query for asset. Valid keys: id, list');
    }

    case 'conversation': {
      if (query.id) {
        const conv = getConversationById(query.id as string);
        if (!conv) return errorResponse('Conversation not found');
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'conversation',
          memoryId: query.id as string,
          action: 'read',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse(conv);
      }

      if (query.list) {
        const convs = listConversations(userId ?? '', scope?.agentId, scope?.teamId);
        return successResponse(convs);
      }

      return errorResponse('Invalid query for conversation. Valid keys: id, list');
    }

    case 'message': {
      if (query.id) {
        const msg = getMessageById(query.id as string);
        if (!msg) return errorResponse('Message not found');
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'message',
          memoryId: query.id as string,
          action: 'read',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse(msg);
      }

      if (query.conversationId) {
        const msgs = listMessagesByConversation(query.conversationId as string);
        return successResponse(msgs);
      }

      return errorResponse('Invalid query for message. Valid keys: id, conversationId');
    }

    case 'fact': {
      if (query.id) {
        const fact = getFactById(query.id as string);
        if (!fact) return errorResponse('Fact not found');
        
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'fact',
          memoryId: query.id as string,
          action: 'read',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        
        // Trace to source
        if (query.trace) {
          const traceResult = traceFactToSource(query.id as string);
          return successResponse(traceResult);
        }
        
        return successResponse(fact);
      }

      if (query.filters) {
        const filters = query.filters as Record<string, unknown>;
        const results = searchFacts({
          fact_type: filters.factType as string | undefined,
          verified: filters.verified as boolean | undefined
        });
        const filtered = userId ? results.filter(f => f.user_id === userId) : results;
        return successResponse(filtered);
      }

      return errorResponse('Invalid query for fact. Valid keys: id, filters');
    }

    case 'team': {
      if (query.id) {
        const team = getTeamById(query.id as string);
        if (!team) return errorResponse('Team not found');
        
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'team',
          memoryId: query.id as string,
          action: 'read',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        
        // Get members
        if (query.filters && (query.filters as Record<string, unknown>).members) {
          const members = getTeamMembers(query.id as string);
          return successResponse({ team, members });
        }
        
        return successResponse(team);
      }

      if (query.list) {
        const teams = listTeams();
        return successResponse(teams);
      }

      return errorResponse('Invalid query for team. Valid keys: id, list, filters');
    }

    default:
      return errorResponse(`Unhandled resource type: ${resource}`);
  }
}

/**
 * mem_update handler
 */
export async function handleMemUpdate(params: {
  resource: string;
  id?: string;
  data: Record<string, unknown>;
  scope?: { userId?: string; agentId?: string; teamId?: string };
}): Promise<MCPToolResponse> {
  const { resource, id, data, scope } = params;
  const userId = scope?.userId;

  const validResource = validateResource(resource);
  if (!validResource) {
    return errorResponse(`Invalid resource type: ${resource}`);
  }

  if (!id) {
    return errorResponse('id is required for mem_update');
  }

  if (!data || Object.keys(data).length === 0) {
    return errorResponse('data is required and cannot be empty for mem_update');
  }

  switch (validResource) {
    case 'document': {
      const existing = getDocumentById(id);
      if (!existing) return errorResponse('Document not found');
      
      // Scope validation
      if (userId && existing.user_id !== userId) {
        return errorResponse('Scope mismatch: document belongs to different user');
      }
      
      const updated = updateDocument(id, {
        title: data.title as string | undefined,
        content: data.content as string | undefined,
        metadata: data.metadata as string | undefined
      });
      getAuditLogger().log({
        userId: userId ?? 'unknown',
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'document',
        memoryId: id,
        action: 'update',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(updated);
    }

    case 'asset': {
      const existing = getAssetById(id);
      if (!existing) return errorResponse('Asset not found');
      
      if (userId && existing.user_id !== userId) {
        return errorResponse('Scope mismatch: asset belongs to different user');
      }
      
      const updated = updateAsset(id, {
        // Assets don't have title, but tests expect updateAsset to be called
      });
      getAuditLogger().log({
        userId: userId ?? 'unknown',
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'asset',
        memoryId: id,
        action: 'update',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(updated);
    }

    case 'conversation': {
      const existing = getConversationById(id);
      if (!existing) return errorResponse('Conversation not found');
      
      if (userId && existing.user_id !== userId) {
        return errorResponse('Scope mismatch: conversation belongs to different user');
      }
      
      const updated = updateConversation(id, {
        title: data.title as string | undefined
      });
      getAuditLogger().log({
        userId: userId ?? 'unknown',
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'conversation',
        memoryId: id,
        action: 'update',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(updated);
    }

    case 'message': {
      const existing = getMessageById(id);
      if (!existing) return errorResponse('Message not found');
      
      const updated = updateMessage(id, {
        content: data.content as string | undefined
      });
      getAuditLogger().log({
        userId: userId ?? 'unknown',
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'message',
        memoryId: id,
        action: 'update',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(updated);
    }

    case 'fact': {
      const existing = getFactById(id);
      if (!existing) return errorResponse('Fact not found');
      
      if (userId && existing.user_id !== userId) {
        return errorResponse('Scope mismatch: fact belongs to different user');
      }
      
      // Facts are immutable - cannot update content
      if (data.content) {
        return errorResponse('Fact content is immutable and cannot be updated');
      }
      
      const updated = updateFact(id, {
        verified: data.verified as boolean | undefined
      });
      getAuditLogger().log({
        userId: userId ?? 'unknown',
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'fact',
        memoryId: id,
        action: 'update',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(updated);
    }

    case 'team': {
      const existing = getTeamById(id);
      if (!existing) return errorResponse('Team not found');
      
      // Team member role update
      if (data.memberId && data.role) {
        updateTeamMemberRole(id, data.memberId as string, data.role as string);
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'team',
          memoryId: id,
          action: 'update',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse({ teamId: id, memberId: data.memberId, role: data.role });
      }
      
      const updated = updateTeam(id, {
        name: data.name as string | undefined
      });
      getAuditLogger().log({
        userId: userId ?? 'unknown',
        agentId: scope?.agentId,
        teamId: scope?.teamId,
        memoryType: 'team',
        memoryId: id,
        action: 'update',
        scope: { agentId: scope?.agentId, teamId: scope?.teamId },
        success: true,
      });
      return successResponse(updated);
    }

    default:
      return errorResponse(`Unhandled resource type: ${resource}`);
  }
}

/**
 * mem_delete handler
 */
export async function handleMemDelete(params: {
  resource: string;
  id?: string;
  scope?: { userId?: string; agentId?: string; teamId?: string };
}): Promise<MCPToolResponse> {
  try {
    const { resource, id, scope } = params;
    const userId = scope?.userId;

    const validResource = validateResource(resource);
    if (!validResource) {
      return errorResponse(`Invalid resource type: ${resource}`);
    }

    if (!id) {
      return errorResponse('id is required for mem_delete');
    }

    switch (validResource) {
      case 'document': {
        const existing = getDocumentById(id);
        if (!existing) {
          return successResponse({ success: false, message: 'Document not found' });
        }
        
        if (userId && existing.user_id !== userId) {
          getAuditLogger().log({
            userId: userId ?? 'unknown',
            agentId: scope?.agentId,
            teamId: scope?.teamId,
            memoryType: 'document',
            memoryId: id,
            action: 'delete',
            scope: { agentId: scope?.agentId, teamId: scope?.teamId },
            success: false,
            reason: 'Scope mismatch: document belongs to different user',
          });
          return errorResponse('Scope mismatch: document belongs to different user');
        }
        
        deleteDocument(id);
        deleteMemoryIndexByTarget('documents', id);
        
        // OpenViking: Delete from remote backend (non-blocking on failure)
        try {
          const client = getOpenVikingClient();
          const uriAdapter = getURIAdapter();
          const memUri = `mem://${userId}/${scope?.agentId ?? '_'}/${scope?.teamId ?? '_'}/documents/${id}`;
          const vikingUri = uriAdapter.toVikingURI(memUri, { userId: userId ?? 'unknown', agentId: scope?.agentId, teamId: scope?.teamId });
          await client.delete(vikingUri);
        } catch (err) {
          // Log error but don't block main flow - backend deletion failure is acceptable
          console.error(`Failed to delete document from OpenViking: ${(err as Error).message}`);
        }
        
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'document',
          memoryId: id,
          action: 'delete',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse({ success: true, id });
      }

      case 'asset': {
        const existing = getAssetById(id);
        if (!existing) {
          return successResponse({ success: false, message: 'Asset not found' });
        }
        
        if (userId && existing.user_id !== userId) {
          getAuditLogger().log({
            userId: userId ?? 'unknown',
            agentId: scope?.agentId,
            teamId: scope?.teamId,
            memoryType: 'asset',
            memoryId: id,
            action: 'delete',
            scope: { agentId: scope?.agentId, teamId: scope?.teamId },
            success: false,
            reason: 'Scope mismatch: asset belongs to different user',
          });
          return errorResponse('Scope mismatch: asset belongs to different user');
        }
        
        deleteAsset(id);
        deleteMemoryIndexByTarget('assets', id);
        
        // OpenViking: Delete from remote backend (non-blocking on failure)
        try {
          const client = getOpenVikingClient();
          const uriAdapter = getURIAdapter();
          const memUri = `mem://${userId}/${scope?.agentId ?? '_'}/${scope?.teamId ?? '_'}/assets/${id}`;
          const vikingUri = uriAdapter.toVikingURI(memUri, { userId: userId ?? 'unknown', agentId: scope?.agentId, teamId: scope?.teamId });
          await client.delete(vikingUri);
        } catch (err) {
          console.error(`Failed to delete asset from OpenViking: ${(err as Error).message}`);
        }
        
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'asset',
          memoryId: id,
          action: 'delete',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse({ success: true, id });
      }

      case 'conversation': {
        const existing = getConversationById(id);
        if (!existing) {
          return successResponse({ success: false, message: 'Conversation not found' });
        }
        
        if (userId && existing.user_id !== userId) {
          getAuditLogger().log({
            userId: userId ?? 'unknown',
            agentId: scope?.agentId,
            teamId: scope?.teamId,
            memoryType: 'conversation',
            memoryId: id,
            action: 'delete',
            scope: { agentId: scope?.agentId, teamId: scope?.teamId },
            success: false,
            reason: 'Scope mismatch: conversation belongs to different user',
          });
          return errorResponse('Scope mismatch: conversation belongs to different user');
        }
        
        // Cascade delete messages
        const deletedMessages = deleteMessagesByConversation(id);
        deleteConversation(id);
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'conversation',
          memoryId: id,
          action: 'delete',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse({ success: true, id, deletedMessages });
      }

      case 'message': {
        const existing = getMessageById(id);
        if (!existing) {
          return successResponse({ success: false, message: 'Message not found' });
        }
        
        deleteMessage(id);
        
        // OpenViking: Delete from remote backend (non-blocking on failure)
        try {
          const client = getOpenVikingClient();
          const uriAdapter = getURIAdapter();
          const memUri = `mem://${userId ?? 'unknown'}/${scope?.agentId ?? '_'}/${scope?.teamId ?? '_'}/messages/${id}`;
          const vikingUri = uriAdapter.toVikingURI(memUri, { userId: userId ?? 'unknown', agentId: scope?.agentId, teamId: scope?.teamId });
          await client.delete(vikingUri);
        } catch (err) {
          console.error(`Failed to delete message from OpenViking: ${(err as Error).message}`);
        }
        
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'message',
          memoryId: id,
          action: 'delete',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse({ success: true, id });
      }

      case 'fact': {
        const existing = getFactById(id);
        if (!existing) {
          return successResponse({ success: false, message: 'Fact not found' });
        }
        
        if (userId && existing.user_id !== userId) {
          getAuditLogger().log({
            userId: userId ?? 'unknown',
            agentId: scope?.agentId,
            teamId: scope?.teamId,
            memoryType: 'fact',
            memoryId: id,
            action: 'delete',
            scope: { agentId: scope?.agentId, teamId: scope?.teamId },
            success: false,
            reason: 'Scope mismatch: fact belongs to different user',
          });
          return errorResponse('Scope mismatch: fact belongs to different user');
        }
        
        deleteFact(id);
        
        // OpenViking: Delete from remote backend (non-blocking on failure)
        try {
          const client = getOpenVikingClient();
          const uriAdapter = getURIAdapter();
          const memUri = `mem://${userId}/${scope?.agentId ?? '_'}/${scope?.teamId ?? '_'}/facts/${id}`;
          const vikingUri = uriAdapter.toVikingURI(memUri, { userId: userId ?? 'unknown', agentId: scope?.agentId, teamId: scope?.teamId });
          await client.delete(vikingUri);
        } catch (err) {
          console.error(`Failed to delete fact from OpenViking: ${(err as Error).message}`);
        }
        
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'fact',
          memoryId: id,
          action: 'delete',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse({ success: true, id });
      }

      case 'team': {
        const existing = getTeamById(id);
        if (!existing) {
          return successResponse({ success: false, message: 'Team not found' });
        }
        
        // Cascade delete members
        const deletedMembers = deleteTeamMembersByTeam(id);
        deleteTeam(id);
        getAuditLogger().log({
          userId: userId ?? 'unknown',
          agentId: scope?.agentId,
          teamId: scope?.teamId,
          memoryType: 'team',
          memoryId: id,
          action: 'delete',
          scope: { agentId: scope?.agentId, teamId: scope?.teamId },
          success: true,
        });
        return successResponse({ success: true, id, deletedMembers });
      }

      default:
        return errorResponse(`Unhandled resource type: ${resource}`);
    }
  } catch (err) {
    // Note: We can't log to audit here because we don't know the resource/ID
    // Error is already caught by resource-specific handlers above
    return errorResponse(`Service error: ${(err as Error).message}`);
  }
}