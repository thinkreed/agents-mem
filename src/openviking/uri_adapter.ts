/**
 * @file src/openviking/uri_adapter.ts
 * @description URI conversion between mem:// and viking:// schemes
 */

import type { Scope, EntityType } from '../core/types';
import type { VikingURI, VikingResourceType } from './types';
import { parseURI, buildURI } from '../core/uri';

/**
 * Entity type to Viking resource type mapping
 * Note: EntityType uses plural forms (documents, assets, etc.)
 */
const ENTITY_TO_VIKING: Record<EntityType, VikingResourceType> = {
  documents: 'resources',
  assets: 'resources',
  conversations: 'memories',
  messages: 'memories',
  facts: 'memories',
  tiered: 'resources',
  entity_nodes: 'resources',
};

/**
 * URI Adapter - converts between mem:// and viking:// schemes
 */
export class URIAdapter {
  /**
   * Convert mem:// URI to viking:// URI
   * 
   * mem://userId/agentId/teamId/type/id
   * → viking://account/user/agent/resources/path/to/id
   */
  toVikingURI(memURI: string, scope: Scope, account?: string): string {
    const parsed = parseURI(memURI);
    if (!parsed) {
      throw new Error(`Invalid mem:// URI: ${memURI}`);
    }
    
    // Build Viking URI path
    const resourceType = ENTITY_TO_VIKING[parsed.type];
    const pathSegments = this.buildPathSegments(parsed.type, parsed.id);
    
    // Construct Viking URI
    const vikingUri: VikingURI = {
      scheme: 'viking',
      account: account ?? 'default',
      user: parsed.userId,
      agent: parsed.agentId,
      resourceType,
      path: pathSegments,
    };
    
    return this.buildVikingURIString(vikingUri);
  }
  
  /**
   * Convert viking:// URI to mem:// URI
   * 
   * viking://account/user/agent/resources/path/to/id
   * → mem://userId/agentId/teamId/type/id
   */
  toMemURI(vikingURI: string, scope: Scope): string {
    const parsed = this.parseVikingURI(vikingURI);
    if (!parsed) {
      throw new Error(`Invalid viking:// URI: ${vikingURI}`);
    }
    
    // Extract entity type and ID from path
    const { entityType, id } = this.extractEntityFromPath(parsed.path);
    
    // Build mem:// URI
    return buildURI({
      userId: parsed.user,
      agentId: parsed.agent,
      teamId: scope.teamId, // teamId from original scope
      type: entityType,
      id,
    });
  }
  
  /**
   * Extract OpenViking resource ID from viking:// URI
   */
  extractIdFromVikingURI(vikingURI: string): string {
    const parsed = this.parseVikingURI(vikingURI);
    if (!parsed) {
      throw new Error(`Invalid viking:// URI: ${vikingURI}`);
    }
    
    // Last path segment is typically the ID
    return parsed.path[parsed.path.length - 1];
  }
  
  /**
   * Build path segments for Viking URI
   */
  private buildPathSegments(entityType: EntityType, id: string): string[] {
    // Organize by entity type
    const basePath = this.getBasePathForEntity(entityType);
    return [...basePath, id];
  }
  
/**
 * Get base path for entity type
 * Note: EntityType uses plural forms
 */
private getBasePathForEntity(entityType: EntityType): string[] {
  switch (entityType) {
    case 'documents':
      return ['documents'];
    case 'assets':
      return ['assets'];
    case 'conversations':
      return ['conversations'];
    case 'messages':
      return ['messages'];
    case 'facts':
      return ['facts'];
    case 'tiered':
      return ['tiered'];
    case 'entity_nodes':
      return ['entity_nodes'];
    default:
      return ['misc'];
  }
}
  
/**
 * Extract entity type and ID from Viking path
 */
private extractEntityFromPath(path: string[]): { entityType: EntityType; id: string } {
  // Path format: ['documents', 'id'] or ['documents', 'subdir', 'id']
  const firstSegment = path[0];
  
  const pathToEntity: Record<string, EntityType> = {
    documents: 'documents',
    assets: 'assets',
    conversations: 'conversations',
    messages: 'messages',
    facts: 'facts',
    tiered: 'tiered',
    entity_nodes: 'entity_nodes',
  };
  
  const entityType = pathToEntity[firstSegment] ?? 'documents';
  const id = path[path.length - 1];
  
  return { entityType, id };
}
  
  /**
   * Build Viking URI string from components
   */
  private buildVikingURIString(uri: VikingURI): string {
    const parts: string[] = [uri.account, uri.user];
    
    if (uri.agent) {
      parts.push(uri.agent);
    }
    
    parts.push(uri.resourceType);
    parts.push(...uri.path);
    
    return 'viking://' + parts.join('/');
  }
  
  /**
   * Parse Viking URI string to components
   */
  private parseVikingURI(uri: string): VikingURI | null {
    // Format: viking://account/user/agent/resourceType/path...
    const match = uri.match(/^viking:\/\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
    
    if (!match) {
      return null;
    }
    
    const [, account, user, agentOrResource, resourceType, pathStr] = match;
    
    // Determine if agent is present or if it's resourceType directly
    // Simplified: assume format viking://account/user/resourceType/path
    const path = pathStr.split('/');
    
    return {
      scheme: 'viking',
      account,
      user,
      // agent is optional, we skip for simplicity
      resourceType: resourceType as VikingResourceType,
      path,
    };
  }
  
  /**
   * Build target URI for OpenViking addResource
   */
  buildTargetUri(scope: Scope, entityType: EntityType, account?: string): string {
    const resourceType = ENTITY_TO_VIKING[entityType];
    const basePath = this.getBasePathForEntity(entityType);
    
    const parts: string[] = [account ?? 'default', scope.userId];
    
    if (scope.agentId) {
      parts.push(scope.agentId);
    }
    
    parts.push(resourceType);
    parts.push(...basePath);
    
    return 'viking://' + parts.join('/');
  }
}

/**
 * Singleton adapter instance
 */
let adapterInstance: URIAdapter | null = null;

/**
 * Get singleton URI adapter
 */
export function getURIAdapter(): URIAdapter {
  if (!adapterInstance) {
    adapterInstance = new URIAdapter();
  }
  return adapterInstance;
}

/**
 * Reset adapter (for testing)
 */
export function resetURIAdapter(): void {
  adapterInstance = null;
}