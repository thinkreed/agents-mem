/**
 * @file src/core/scope.ts
 * @description Scope utilities for user_id/agent_id/team_id isolation
 */

import { Scope } from './types';

/**
 * Scope creation config
 */
export interface ScopeConfig {
  userId: string;
  agentId?: string;
  teamId?: string;
  isGlobal?: boolean;
}

/**
 * Create scope object
 */
export function createScope(config: ScopeConfig): Scope {
  return {
    userId: config.userId,
    agentId: config.agentId,
    teamId: config.teamId,
    isGlobal: config.isGlobal ?? false
  };
}

/**
 * Validate scope (must have userId)
 */
export function validateScope(scope: Partial<Scope>): boolean {
  return typeof scope.userId === 'string' && scope.userId.length > 0;
}

/**
 * Convert scope to string representation
 */
export function scopeToString(scope: Scope): string {
  const parts: string[] = [`user:${scope.userId}`];
  
  if (scope.agentId) {
    parts.push(`agent:${scope.agentId}`);
  }
  
  if (scope.teamId) {
    parts.push(`team:${scope.teamId}`);
  }
  
  if (scope.isGlobal) {
    parts.push('global');
  }
  
  return parts.join('/');
}

/**
 * Scope string format regex
 */
const SCOPE_STRING_FORMAT = /^user:([^/]+)(\/agent:([^/]+))?(\/team:([^/]+))?(\/global)?$/;

/**
 * Parse scope string to object
 */
export function parseScopeString(str: string): Scope | null {
  const match = str.match(SCOPE_STRING_FORMAT);
  if (!match) return null;
  
  const [, userId, , agentId, , teamId, globalPart] = match;
  
  return {
    userId,
    agentId: agentId || undefined,
    teamId: teamId || undefined,
    isGlobal: globalPart !== undefined
  };
}

/**
 * Check if two scopes are equal
 */
export function scopeEquals(a: Scope, b: Scope): boolean {
  return a.userId === b.userId &&
    (a.agentId ?? undefined) === (b.agentId ?? undefined) &&
    (a.teamId ?? undefined) === (b.teamId ?? undefined) &&
    (a.isGlobal ?? false) === (b.isGlobal ?? false);
}

/**
 * Check if scope contains target (target is subset of scope)
 */
export function scopeContains(scope: Scope, target: Scope): boolean {
  if (scope.userId !== target.userId) return false;
  
  // If target has agentId, scope must have same agentId
  if (target.agentId && scope.agentId !== target.agentId) return false;
  
  // If target has teamId, scope must have same teamId
  if (target.teamId && scope.teamId !== target.teamId) return false;
  
  return true;
}

/**
 * Check if scope is global
 */
export function isGlobalScope(scope: Scope): boolean {
  return scope.isGlobal === true;
}

/**
 * Check if scope has agentId
 */
export function isAgentScope(scope: Scope): boolean {
  return typeof scope.agentId === 'string' && scope.agentId.length > 0;
}

/**
 * Check if scope has teamId
 */
export function isTeamScope(scope: Scope): boolean {
  return typeof scope.teamId === 'string' && scope.teamId.length > 0;
}

/**
 * Merge two scopes (second overrides first)
 */
export function mergeScopes(a: Scope, b: Partial<Scope>): Scope {
  return {
    userId: b.userId ?? a.userId,
    agentId: b.agentId ?? a.agentId,
    teamId: b.teamId ?? a.teamId,
    isGlobal: b.isGlobal ?? a.isGlobal ?? false
  };
}

/**
 * Scope filter for SQL/LanceDB queries
 */
export class ScopeFilter {
  userId: string;
  agentId?: string;
  teamId?: string;
  isGlobal?: boolean;
  
  constructor(scope: Scope) {
    this.userId = scope.userId;
    this.agentId = scope.agentId;
    this.teamId = scope.teamId;
    this.isGlobal = scope.isGlobal;
  }
  
  /**
   * Create filter from scope
   */
  static fromScope(scope: Scope): ScopeFilter {
    return new ScopeFilter(scope);
  }
  
  /**
   * Generate SQL WHERE clause
   */
  toWhereClause(): string {
    const conditions: string[] = [`user_id = '${this.userId}'`];
    
    if (this.agentId) {
      conditions.push(`agent_id = '${this.agentId}'`);
    }
    
    if (this.teamId) {
      conditions.push(`team_id = '${this.teamId}'`);
    }
    
    if (this.isGlobal) {
      conditions.push(`is_global = true`);
    }
    
    return conditions.join(' AND ');
  }
  
/**
    * Generate LanceDB filter expression
    * Uses AND operator (not && which is not supported)
    */
  toLanceFilter(): string {
    const conditions: string[] = [`user_id == "${this.userId}"`];
    
    if (this.agentId) {
      conditions.push(`agent_id == "${this.agentId}"`);
    }
    
    if (this.teamId) {
      conditions.push(`team_id == "${this.teamId}"`);
    }
    
    if (this.isGlobal) {
      conditions.push(`is_global == true`);
    }
    
    return conditions.join(' AND ');
  }
}