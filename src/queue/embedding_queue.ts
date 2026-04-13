/**
 * @file src/queue/embedding_queue.ts
 * @description Background queue system for async embedding generation
 */

import { createJob, getJob as dbGetJob, updateJob, getPendingJobs as dbGetPendingJobs, getJobsByStatus as dbGetJobsByStatus } from '../sqlite/queue_jobs';
import { getEmbedding } from '../embedder/ollama';
import { addDocumentVector } from '../lance/documents_vec';
import { createFTSIndex } from '../lance/index';
import { recordToJob, jobToRecord } from './converters';
import type {
  QueueJob,
  JobType,
  JobStatus,
  QueueJobConfig,
  CreateJobOptions,
  QueueEventType,
  QueueEventListener,
  QueueEvent,
} from './types';
import { DEFAULT_JOB_CONFIG } from './types';

/**
 * EmbeddingQueue - Background queue for async embedding generation and FTS indexing
 */
export class EmbeddingQueue {
  private config: QueueJobConfig;
  private jobs: Map<string, QueueJob> = new Map();
  private processing: Set<string> = new Set();
  private eventListeners: Map<QueueEventType, QueueEventListener[]> = new Map();

  /**
   * Create a new EmbeddingQueue instance
   */
  constructor(config?: Partial<QueueJobConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? DEFAULT_JOB_CONFIG.maxRetries,
      retryDelay: config?.retryDelay ?? DEFAULT_JOB_CONFIG.retryDelay,
    };
  }

  /**
   * Add a job to the queue
   */
  async addJob(options: CreateJobOptions): Promise<QueueJob> {
    // Try to persist to SQLite if available
    let job: QueueJob;
    try {
      // Create proper job object first
      const newJob: QueueJob = {
        id: '',  // Will be set by DB
        type: options.type,
        status: 'pending',
        resourceId: options.resourceId,
        resourceType: options.resourceType,
        payload: options.payload || {},
        retries: 0,
        createdAt: Date.now(),
        userId: options.userId,
        agentId: options.agentId,
        teamId: options.teamId,
      };
      const record = jobToRecord(newJob);
      const dbRecord = createJob({
        type: record.type!,
        payload: record.payload!,
        user_id: record.user_id!,
        agent_id: record.agent_id,
        team_id: record.team_id,
      });
      job = recordToJob(dbRecord);
      job.id = dbRecord.id;  // Use DB-generated ID
    } catch {
      // Fallback to in-memory if SQLite unavailable
      job = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: options.type,
        status: 'pending',
        resourceId: options.resourceId,
        resourceType: options.resourceType,
        payload: options.payload || {},
        retries: 0,
        createdAt: Date.now(),
        userId: options.userId,
        agentId: options.agentId,
        teamId: options.teamId,
      };
    }

    // Store payload fields in job.payload for consistency
    job.payload = {
      ...job.payload,
      resourceId: job.resourceId,
      resourceType: job.resourceType,
    };

    this.jobs.set(job.id, job);
    this.emitEvent('job_added', job);
    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(id: string): Promise<QueueJob | undefined> {
    // Check in-memory cache first
    const cached = this.jobs.get(id);
    if (cached) return cached;

    // Try SQLite
    try {
      const dbJobRecord = await dbGetJob(id);
      if (dbJobRecord) {
        const dbJob = recordToJob(dbJobRecord);
        this.jobs.set(dbJob.id, dbJob);
        return dbJob;
      }
    } catch {
      // SQLite unavailable
    }

    return undefined;
  }

  /**
   * Get all pending jobs
   */
  async getPendingJobs(): Promise<QueueJob[]> {
    // Try SQLite first
    try {
      const dbJobsRecords = await dbGetPendingJobs();
      const dbJobs = dbJobsRecords.map(recordToJob);
      for (const job of dbJobs) {
        this.jobs.set(job.id, job);
      }
      return dbJobs;
    } catch {
      // Fallback to in-memory
      return this.getJobsByStatus('pending');
    }
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus): Promise<QueueJob[]> {
    // Check in-memory
    const inMemoryJobs = Array.from(this.jobs.values()).filter((j) => j.status === status);

    // Try SQLite
    try {
      const dbJobsRecords = await dbGetJobsByStatus(status);
      const dbJobs = dbJobsRecords.map(recordToJob);
      for (const job of dbJobs) {
        this.jobs.set(job.id, job);
      }
      // Merge with in-memory
      const mergedMap = new Map<string, QueueJob>();
      for (const job of dbJobs) {
        mergedMap.set(job.id, job);
      }
      for (const job of inMemoryJobs) {
        mergedMap.set(job.id, job);
      }
      return Array.from(mergedMap.values()).filter((j) => j.status === status);
    } catch {
      return inMemoryJobs;
    }
  }

  /**
   * Process all pending jobs
   */
  async process(): Promise<void> {
    const pending = await this.getPendingJobs();
    for (const job of pending) {
      await this.processJob(job);
    }
  }

  /**
   * Process a single job by job object
   */
  async processJob(job: QueueJob): Promise<void> {
    const currentJob = await this.getJob(job.id);
    if (!currentJob || currentJob.status !== 'pending') return;

    // Mark as processing
    currentJob.status = 'processing';
    currentJob.startedAt = Date.now();
    this.processing.add(currentJob.id);
    this.jobs.set(currentJob.id, currentJob);

    // Update in SQLite if available
    try {
      await updateJob(currentJob.id, 'processing');
    } catch {
      // Continue without SQLite
    }

    this.emitEvent('job_started', currentJob);

    try {
      // Process based on job type
      if (currentJob.type === 'embedding') {
        await this.processEmbedding(currentJob);
      } else if (currentJob.type === 'fts_index') {
        await this.processFtsIndex(currentJob);
      }

      // Mark as completed
      await this.handleSuccess(currentJob);
    } catch (error) {
      await this.handleFailure(currentJob, error as Error);
    } finally {
      this.processing.delete(currentJob.id);
    }
  }

  /**
   * Process embedding job - generate embedding and store in vector DB
   */
  private async processEmbedding(job: QueueJob): Promise<void> {
    const text = (job.payload.text as string) || (job.payload.content as string) || '';
    const id = job.payload.documentId || job.resourceId;
    const title = (job.payload.title as string) || 'Untitled';

    // Get embedding
    const vector = await getEmbedding(text);

    // Add to vector store
    await addDocumentVector({
      id: id as string,
      content: text,
      vector,
      title,
      user_id: job.userId,
      agent_id: job.agentId,
      team_id: job.teamId,
    });
  }

  /**
   * Process FTS index job
   */
  private async processFtsIndex(job: QueueJob): Promise<void> {
    const tableName = (job.payload.tableName as string) || `${job.resourceType}_vec`;
    const column = (job.payload.column as string) || 'content';

    await createFTSIndex(tableName, column);
  }

  /**
   * Handle successful job completion
   */
  async handleSuccess(job: QueueJob): Promise<void> {
    job.status = 'completed';
    job.completedAt = Date.now();

    this.jobs.set(job.id, job);

    // Update in SQLite if available
    try {
      await updateJob(job.id, 'completed');
    } catch {
      // Continue without SQLite
    }

    this.emitEvent('job_completed', job);
  }

  /**
   * Handle job failure with retry logic
   */
  async handleFailure(job: QueueJob, error: Error): Promise<void> {
    job.retries++;
    job.error = error.message;

    if (job.retries < this.config.maxRetries) {
      // Retry with delay
      job.status = 'pending';
      this.emitEvent('job_retried', job);

      // Update in SQLite if available
      try {
        await updateJob(job.id, 'pending', job.retries, undefined, error.message);
      } catch {
        // Continue without SQLite
      }

      // Wait before allowing retry
      await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
    } else {
      // Max retries exceeded - mark as failed
      job.status = 'failed';
      job.completedAt = Date.now();

      this.jobs.set(job.id, job);

      // Update in SQLite if available
      try {
        await updateJob(job.id, 'failed', job.retries, undefined, error.message);
      } catch {
        // Continue without SQLite
      }

      this.emitEvent('job_failed', job, error);
    }
  }

  /**
   * Register event listener
   */
  on(event: QueueEventType, listener: QueueEventListener): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(type: QueueEventType, job: QueueJob, error?: Error): void {
    const listeners = this.eventListeners.get(type) || [];
    const event: QueueEvent = {
      type,
      job,
      timestamp: Date.now(),
      error,
    };

    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Get all jobs (in-memory only)
   */
  getAllJobs(): QueueJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clear all jobs (in-memory only)
   */
  clear(): void {
    this.jobs.clear();
    this.processing.clear();
  }
}