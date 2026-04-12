/**
 * @file src/core/uri.ts
 * @description URI parsing and building for mem:// scheme
 */

import { EntityType, MaterialURI } from './types';

/**
 * URI format regex
 * mem://{userId}/{agentId?}/{teamId?}/{type}/{id}
 */
export const URI_FORMAT = /^mem:\/\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/;

/**
 * Placeholder for missing agentId/teamId
 */
const PLACEHOLDER = '_';

/**
 * URI build config
 */
export interface URIConfig {
  userId: string;
  agentId?: string;
  teamId?: string;
  type: EntityType;
  id: string;
}

/**
 * Build URI string from components
 */
export function buildURI(config: URIConfig): string {
  const agentPath = config.agentId ?? PLACEHOLDER;
  const teamPath = config.teamId ?? PLACEHOLDER;
  return `mem://${config.userId}/${agentPath}/${teamPath}/${config.type}/${config.id}`;
}

/**
 * Parse URI string to MaterialURI object
 */
export function parseURI(uri: string): MaterialURI | null {
  if (!validateURI(uri)) {
    return null;
  }
  
  const match = uri.match(URI_FORMAT);
  if (!match) {
    return null;
  }
  
  const [, userId, agentPath, teamPath, type, id] = match;
  
  return {
    scheme: 'mem',
    userId,
    agentId: agentPath === PLACEHOLDER ? undefined : agentPath,
    teamId: teamPath === PLACEHOLDER ? undefined : teamPath,
    type: type as EntityType,
    id
  };
}

/**
 * Validate URI format
 */
export function validateURI(uri: string): boolean {
  return URI_FORMAT.test(uri);
}

/**
 * Type guard for URI string
 */
export function isURI(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return validateURI(value);
}

/**
 * Extract URI components (alias for parseURI)
 */
export function extractURIComponents(uri: string): URIConfig | null {
  const parsed = parseURI(uri);
  if (!parsed) return null;
  
  return {
    userId: parsed.userId,
    agentId: parsed.agentId,
    teamId: parsed.teamId,
    type: parsed.type,
    id: parsed.id
  };
}