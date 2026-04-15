/**
 * @file src/openviking/scope_mapper.ts
 * @description Scope mapping between agents-mem and OpenViking
 */

import 'reflect-metadata';
import { singleton } from 'tsyringe';
import type { Scope } from '../core/types';
import type { OpenVikingConfig } from './types';
import { getConfig } from './config';

/**
 * OpenViking scope context
 */
export interface VikingScope {
  /** Account context (multi-tenant) */
  account: string;
  /** User context */
  user: string;
  /** Agent context */
  agent?: string;
}

/**
 * Scope Mapper - converts agents-mem Scope to OpenViking context
 */
@singleton()
export class ScopeMapper {
  private config: OpenVikingConfig;

  constructor() {
    this.config = getConfig();
  }
  
  /**
   * Map agents-mem Scope to VikingScope
   */
  mapToVikingScope(scope: Scope): VikingScope {
    return {
      account: this.config.account ?? 'default',
      user: scope.userId,
      agent: scope.agentId,
    };
  }
  
  /**
   * Build target URI for OpenViking search/add operations
   */
  mapToVikingTarget(scope: Scope): string {
    const vikingScope = this.mapToVikingScope(scope);
    
    // Build target URI: viking://account/user/agent/memories
    const parts: string[] = [
      'viking://',
      vikingScope.account,
      vikingScope.user,
    ];
    
    if (vikingScope.agent) {
      parts.push(vikingScope.agent);
    }
    
    // Default to memories for search scope
    parts.push('memories');
    
    return parts.join('/');
  }
  
  /**
   * Build target URI for specific resource type
   */
  buildTargetForType(scope: Scope, resourceType: 'resources' | 'memories' | 'skills'): string {
    const vikingScope = this.mapToVikingScope(scope);
    
    const parts: string[] = [
      'viking://',
      vikingScope.account,
      vikingScope.user,
    ];
    
    if (vikingScope.agent) {
      parts.push(vikingScope.agent);
    }
    
    parts.push(resourceType);
    
    return parts.join('/');
  }
  
  /**
   * Build headers for OpenViking API requests
   */
  mapToOpenVikingHeaders(scope: Scope): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Add authentication
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    // Add scope context headers (optional, for debugging/logging)
    headers['X-Account'] = this.config.account ?? 'default';
    headers['X-User'] = scope.userId;
    
    if (scope.agentId) {
      headers['X-Agent'] = scope.agentId;
    }
    
    if (scope.teamId) {
      headers['X-Team'] = scope.teamId;
    }
    
    return headers;
  }
  
  /**
   * Extract Scope from Viking URI
   */
  extractScopeFromUri(vikingUri: string): Partial<Scope> {
    // Parse viking://account/user/agent/...
    const match = vikingUri.match(/^viking:\/\/([^/]+)\/([^/]+)\/([^/]+)/);
    
    if (!match) {
      return {};
    }
    
    const [, _account, user, agentOrResource] = match;
    
    // Determine if third segment is agent or resource type
    const resourceTypes = ['resources', 'memories', 'skills'];
    const agentId = resourceTypes.includes(agentOrResource) ? undefined : agentOrResource;
    
    return {
      userId: user,
      agentId,
    };
  }
  
  /**
   * Validate scope compatibility with OpenViking
   */
  validateScope(scope: Scope): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // userId is required
    if (!scope.userId) {
      errors.push('userId is required for OpenViking operations');
    }
    
    // Check userId format (no special characters)
    if (scope.userId && !/^[a-zA-Z0-9_-]+$/.test(scope.userId)) {
      errors.push('userId must contain only alphanumeric characters, underscores, and hyphens');
    }
    
    // Check agentId format if present
    if (scope.agentId && !/^[a-zA-Z0-9_-]+$/.test(scope.agentId)) {
      errors.push('agentId must contain only alphanumeric characters, underscores, and hyphens');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================================
// Backward Compatibility Helpers
// ============================================================================

/**
 * @deprecated Use container.resolve(ScopeMapper)
 */
export function getScopeMapper(): ScopeMapper {
  const { container } = require('tsyringe');
  return container.resolve(ScopeMapper);
}

/**
 * @deprecated Use container.reset()
 */
export function resetScopeMapper(): void {
  const { container } = require('tsyringe');
  container.reset();
}