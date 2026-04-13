/**
 * @file src/utils/audit_logger.ts
 * @description Audit logging layer for CRUD operations
 * Records only metadata (userId, resourceId, operation) - no sensitive content
 */

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
 * Default audit config
 */
export const DEFAULT_AUDIT_CONFIG: AuditLoggerConfig = {
  enabled: true,
  samplingRate: 1.0,
};

// AuditLogger class implementation will be in Wave 4