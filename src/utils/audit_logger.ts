/**
 * @file src/utils/audit_logger.ts
 * @description Audit logging layer for CRUD operations
 * Records only metadata (userId, resourceId, operation) - no sensitive content
 */

import { getLogBuffer } from './log_buffer';
import { parseLoggerConfig } from './config';
import { LogLevel } from './logger_types';

/**
 * Audit log entry structure
 * Maps to memory_access_log SQLite table
 */
export interface AuditLogEntry {
  userId: string;
  agentId?: string;
  teamId?: string;
  memoryType: 'document' | 'asset' | 'conversation' | 'message' | 'fact' | 'team';
  memoryId: string;
  action: 'create' | 'read' | 'update' | 'delete';
  scope: string; // JSON.stringify({agentId, teamId})
  timestamp: number;
  success: boolean;
  reason?: string;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  enabled: boolean;
  samplingRate: number; // 0.0-1.0, 1.0 = full audit
}

/**
 * Input type for AuditLogger.log()
 */
export interface AuditLogInput {
  userId: string;
  agentId?: string;
  teamId?: string;
  memoryType: AuditLogEntry['memoryType'];
  memoryId: string;
  action: AuditLogEntry['action'];
  scope: { agentId?: string; teamId?: string };
  success: boolean;
  reason?: string;
}

/**
 * Default audit config
 */
export const DEFAULT_AUDIT_CONFIG: AuditLoggerConfig = {
  enabled: true,
  samplingRate: 1.0,
};

/**
 * AuditLogger - Records CRUD operation metadata to audit trail
 * 
 * Features:
 * - Field mapping from camelCase to snake_case
 * - Sampling logic for high-throughput scenarios
 * - Enqueues to LogBuffer for async processing
 * - Does NOT log sensitive content (metadata only)
 */
export class AuditLogger {
  private config: AuditLoggerConfig;

  /**
   * Create a new AuditLogger instance
   * @param config - Logger configuration (defaults to DEFAULT_AUDIT_CONFIG)
   */
  constructor(config?: AuditLoggerConfig) {
    this.config = {
      ...DEFAULT_AUDIT_CONFIG,
      ...config,
    };
  }

  /**
   * Log a CRUD operation to the audit trail
   * 
   * Field mapping:
   * - userId → user_id
   * - agentId → agent_id
   * - teamId → team_id
   * - resourceType → memory_type
   * - resourceId → memory_id
   * - operation → action
   * - scope → JSON.stringify({agentId, teamId})
   * - success → success
   * - reason → reason
   * 
   * @param entry - Audit log entry (camelCase)
   */
  log(entry: AuditLogInput): void {
    // Check if audit is enabled
    if (!this.config.enabled) {
      return;
    }

    // Check sampling rate - skip if not sampled
    if (Math.random() >= this.config.samplingRate) {
      return;
    }

    // Create AuditLogEntry with field mapping
    const auditEntry: AuditLogEntry = {
      userId: entry.userId,
      agentId: entry.agentId,
      teamId: entry.teamId,
      memoryType: entry.memoryType,
      memoryId: entry.memoryId,
      action: entry.action,
      scope: JSON.stringify(entry.scope),
      timestamp: Math.floor(Date.now() / 1000),
      success: entry.success,
      reason: entry.reason,
    };

    // Enqueue to LogBuffer for async processing
    const buffer = getLogBuffer();
    
    // Convert to log format and enqueue with compatible metadata type
    buffer.enqueue({
      level: LogLevel.INFO,
      message: `AUDIT: ${entry.action} ${entry.memoryType}/${entry.memoryId}`,
      timestamp: Date.now(),
      metadata: auditEntry as unknown as Record<string, unknown>,
    });
  }
}

/**
 * Singleton instance for global audit logger
 */
let auditLoggerInstance: AuditLogger | null = null;

/**
 * Get the global AuditLogger singleton
 * 
 * - Lazy initialization on first call
 * - Uses config.auditEnabled and config.samplingRate
 * 
 * @returns AuditLogger instance
 */
export function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) {
    const config = parseLoggerConfig();
    
    auditLoggerInstance = new AuditLogger({
      enabled: config.auditEnabled,
      samplingRate: config.samplingRate,
    });
  }
  return auditLoggerInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetAuditLogger(): void {
  if (auditLoggerInstance) {
    auditLoggerInstance = null;
  }
}
