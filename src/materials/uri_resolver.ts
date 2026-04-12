/**
 * @file src/materials/uri_resolver.ts
 * @description URI resolver for mem:// scheme
 */

import { parseURI, buildURI, validateURI } from '../core/uri';
import { Scope } from '../core/types';

/**
 * Resolve URI to components
 */
export function resolveURI(uri: string): ReturnType<typeof parseURI> {
  return parseURI(uri);
}

/**
 * Build URI from components
 */
export function buildMaterialURI(config: {
  userId: string;
  agentId?: string;
  teamId?: string;
  type: string;
  id: string;
}): string {
  return buildURI({
    userId: config.userId,
    agentId: config.agentId,
    teamId: config.teamId,
    type: config.type as 'documents' | 'assets' | 'conversations' | 'messages' | 'facts' | 'tiered' | 'entity_nodes',
    id: config.id
  });
}

/**
 * Extract scope from URI
 */
export function extractScopeFromURI(uri: string): Scope | null {
  const parsed = parseURI(uri);
  if (!parsed) return null;
  
  return {
    userId: parsed.userId,
    agentId: parsed.agentId,
    teamId: parsed.teamId
  };
}

/**
 * Check if URI matches scope
 */
export function uriMatchesScope(uri: string, scope: Scope): boolean {
  const parsedScope = extractScopeFromURI(uri);
  if (!parsedScope) return false;
  
  return parsedScope.userId === scope.userId &&
    (parsedScope.agentId === scope.agentId || !scope.agentId) &&
    (parsedScope.teamId === scope.teamId || !scope.teamId);
}