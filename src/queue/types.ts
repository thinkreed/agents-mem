/**
 * @file src/queue/types.ts
 * @description Background queue type definitions for async embedding generation
 */

/**
 * Job types for the background queue
 */
export type JobType = 'embedding' | 'fts_index';

/**
 * Job status in the queue lifecycle
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Queue job configuration
 */
export interface QueueJobConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay: number;
}

/**
 * Default queue job configuration
 */
export const DEFAULT_JOB_CONFIG: QueueJobConfig = {
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Background queue job
 */
export interface QueueJob {
  /** Unique job identifier */
  id: string;
  /** Type of job (embedding or fts_index) */
  type: JobType;
  /** Job status */
  status: JobStatus;
  /** Target resource ID (document_id, asset_id, etc.) */
  resourceId: string;
  /** Target resource type (document, asset, message, etc.) */
  resourceType: string;
  /** Additional job payload data */
  payload: Record<string, unknown>;
  /** Number of retry attempts */
  retries: number;
  /** Last error message if failed */
  error?: string;
  /** Timestamp when job was created */
  createdAt: number;
  /** Timestamp when job started processing */
  startedAt?: number;
  /** Timestamp when job completed */
  completedAt?: number;
  /** User scope */
  userId: string;
  /** Optional agent scope */
  agentId?: string;
  /** Optional team scope */
  teamId?: string;
}

/**
 * Queue options for creating a new job
 */
export interface CreateJobOptions {
  /** Type of job */
  type: JobType;
  /** Target resource ID */
  resourceId: string;
  /** Target resource type */
  resourceType: string;
  /** Additional payload data */
  payload?: Record<string, unknown>;
  /** User scope (required) */
  userId: string;
  /** Optional agent scope */
  agentId?: string;
  /** Optional team scope */
  teamId?: string;
}

/**
 * Queue processor function
 */
export type JobProcessor = (job: QueueJob) => Promise<void>;

/**
 * Queue event types
 */
export type QueueEventType = 'job_added' | 'job_started' | 'job_completed' | 'job_failed' | 'job_retried';

/**
 * Queue event
 */
export interface QueueEvent {
  /** Event type */
  type: QueueEventType;
  /** Job that triggered the event */
  job: QueueJob;
  /** Event timestamp */
  timestamp: number;
  /** Error information if failed */
  error?: Error;
}

/**
 * Queue event listener
 */
export type QueueEventListener = (event: QueueEvent) => void;

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total jobs processed */
  totalProcessed: number;
  /** Jobs completed successfully */
  completed: number;
  /** Jobs that failed after retries */
  failed: number;
  /** Currently processing jobs */
  processing: number;
  /** Pending jobs in queue */
  pending: number;
}