/**
 * @file tests/queue/fts_index_job.test.ts
 * @description FTS index queue job tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { resetConnection, closeConnection, setDatabasePath } from '../../src/sqlite/connection';
import type { 
  QueueJob, 
  JobType, 
  JobStatus,
  CreateJobOptions 
} from '../../src/queue/types';
import { EmbeddingQueue } from '../../src/queue/embedding_queue';

// Mock SQLite queue operations
vi.mock('../../src/sqlite/queue_jobs', () => ({
  createJob: vi.fn(),
  updateJob: vi.fn(),
  getJob: vi.fn(),
  getPendingJobs: vi.fn(),
  getJobsByStatus: vi.fn(),
}));

// Import after mock
import { createJob, updateJob, getJob, getPendingJobs, getJobsByStatus } from '../../src/sqlite/queue_jobs';

// Mock LanceDB FTS index
vi.mock('../../src/lance/index', () => ({
  createFTSIndex: vi.fn().mockResolvedValue(undefined)
}));

// Import after mock
import { createFTSIndex } from '../../src/lance/index';

describe('FTSIndexJob', () => {
  let queue: EmbeddingQueue;

  beforeEach(() => {
    // Reset SQLite connection for isolation
    resetConnection();
    setDatabasePath(':memory:');
    
    // Create fresh queue instance
    queue = new EmbeddingQueue();
    
    // Reset mocks
    vi.clearAllMocks();
    (createFTSIndex as MockedFunction<typeof createFTSIndex>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    queue.clear();
    closeConnection();
    vi.clearAllMocks();
  });

  describe('FTS Index Job Acceptance', () => {
    it('should accept fts_index job type', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-456',
        resourceType: 'document',
        payload: { content: 'indexable content' },
        userId: 'user-1'
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.type).toBe('fts_index');
      expect(job.status).toBe('pending');
      expect(job.resourceId).toBe('doc-456');
    });

    it('should accept fts_index job with custom tableName', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-789',
        resourceType: 'document',
        payload: { 
          tableName: 'documents_vec',
          column: 'content'
        },
        userId: 'user-1'
      });

      expect(job.type).toBe('fts_index');
      expect(job.payload.tableName).toBe('documents_vec');
      expect(job.payload.column).toBe('content');
    });

    it('should accept fts_index job with default payload', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'message',
        userId: 'user-1'
      });

      expect(job.type).toBe('fts_index');
      expect(job.resourceType).toBe('message');
    });
  });

  describe('FTS Index Job Processing', () => {
    it('should process fts_index job and call createFTSIndex', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { 
          tableName: 'documents_vec',
          column: 'content'
        },
        userId: 'user-1'
      });

      await queue.processJob(job);

      expect(createFTSIndex).toHaveBeenCalledWith('documents_vec', 'content');
      const updated = await queue.getJob(job.id);
      expect(updated?.status).toBe('completed');
    });

    it('should use default tableName and column for fts_index job', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-456',
        resourceType: 'document',
        userId: 'user-1'
      });

      await queue.processJob(job);

      // Default: tableName = resourceType_vec, column = content
      expect(createFTSIndex).toHaveBeenCalledWith('document_vec', 'content');
    });

    it('should mark fts_index job as completed after successful processing', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-789',
        resourceType: 'document',
        payload: { tableName: 'messages_vec', column: 'content' },
        userId: 'user-1'
      });

      await queue.processJob(job);

      const updated = await queue.getJob(job.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
      expect(updated?.completedAt).toBeGreaterThanOrEqual(job.createdAt);
    });

    it('should process multiple fts_index jobs', async () => {
      const job1 = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-1',
        resourceType: 'document',
        userId: 'user-1'
      });

      const job2 = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-2',
        resourceType: 'document',
        userId: 'user-1'
      });

      await queue.processJob(job1);
      await queue.processJob(job2);

      const updated1 = await queue.getJob(job1.id);
      const updated2 = await queue.getJob(job2.id);
      expect(updated1?.status).toBe('completed');
      expect(updated2?.status).toBe('completed');
      expect(createFTSIndex).toHaveBeenCalledTimes(2);
    });
  });

  describe('FTS Index Job Retry Mechanism', () => {
    it('should retry failed fts_index job up to maxRetries=3', async () => {
      // Make createFTSIndex fail
      (createFTSIndex as MockedFunction<typeof createFTSIndex>).mockRejectedValue(
        new Error('FTS index creation failed')
      );

      const failingQueue = new EmbeddingQueue();

      const job = await failingQueue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      // Process and expect retries
      for (let i = 0; i < 4; i++) {
        try {
          await failingQueue.processJob(job);
        } catch {
          // Ignore errors during retry
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const updated = await failingQueue.getJob(job.id);
      // After max retries (3), job should be failed with retries >= 3
      expect(updated?.status).toBe('failed');
      expect(updated?.retries).toBeGreaterThanOrEqual(3);
    });

    it('should record error message on fts_index failure', async () => {
      const errorMessage = 'Specific FTS error';
      (createFTSIndex as MockedFunction<typeof createFTSIndex>).mockRejectedValue(
        new Error(errorMessage)
      );

      const errorQueue = new EmbeddingQueue();

      const job = await errorQueue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      // Exhaust retries
      for (let i = 0; i < 5; i++) {
        try {
          await errorQueue.processJob(job);
        } catch {
          // Ignore
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const updated = await errorQueue.getJob(job.id);
      expect(updated?.error).toBeDefined();
      expect(updated?.error).toContain(errorMessage);
    });

    it('should mark fts_index job as failed after max retries', async () => {
      (createFTSIndex as MockedFunction<typeof createFTSIndex>).mockRejectedValue(
        new Error('Always fails')
      );

      const errorQueue = new EmbeddingQueue();

      const job = await errorQueue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      // Process multiple times to exhaust retries (maxRetries = 3)
      for (let i = 0; i < 5; i++) {
        try {
          await errorQueue.processJob(job);
        } catch {
          // Ignore
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const updated = await errorQueue.getJob(job.id);
      expect(updated?.status).toBe('failed');
    });

    it('should track failed fts_index jobs', async () => {
      (createFTSIndex as MockedFunction<typeof createFTSIndex>).mockRejectedValue(
        new Error('Always fails')
      );

      const errorQueue = new EmbeddingQueue();

      const job = await errorQueue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      // Exhaust retries
      for (let i = 0; i < 5; i++) {
        try {
          await errorQueue.processJob(job);
        } catch {
          // Ignore
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const updated = await errorQueue.getJob(job.id);
      expect(updated?.status).toBe('failed');
    });

    it('should succeed after retry if createFTSIndex recovers', async () => {
      let callCount = 0;
      (createFTSIndex as MockedFunction<typeof createFTSIndex>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt fails'));
        }
        return Promise.resolve(undefined);
      });

      const retryQueue = new EmbeddingQueue();

      const job = await retryQueue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      // First process - will fail and retry
      try {
        await retryQueue.processJob(job);
      } catch {
        // Ignore first failure
      }
      await new Promise(r => setTimeout(r, 200));

      // Second process - should succeed
      await retryQueue.processJob(job);

      const updated = await retryQueue.getJob(job.id);
      expect(updated?.status).toBe('completed');
      expect(callCount).toBe(2);
    });
  });

  describe('FTS Index Job Failure Handling', () => {
    it('should handle createFTSIndex errors gracefully', async () => {
      (createFTSIndex as MockedFunction<typeof createFTSIndex>).mockRejectedValue(
        new Error('Network error')
      );

      const errorQueue = new EmbeddingQueue();

      const job = await errorQueue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      // Process multiple times to exhaust retries
      for (let i = 0; i < 4; i++) {
        try {
          await errorQueue.processJob(job);
        } catch {
          // Ignore
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const updated = await errorQueue.getJob(job.id);
      expect(updated?.status).toBe('failed');
    });

    it('should not retry completed fts_index jobs', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      await queue.processJob(job);
      const completed = await queue.getJob(job.id);
      expect(completed?.status).toBe('completed');

      // Try to process again - should still be completed
      await queue.processJob(job);
      const stillCompleted = await queue.getJob(job.id);
      expect(stillCompleted?.status).toBe('completed');
    });

    it('should process remaining fts_index jobs after one fails and retries', async () => {
      let callCount = 0;
      (createFTSIndex as MockedFunction<typeof createFTSIndex>).mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.reject(new Error('Fails first 3 times'));
        }
        return Promise.resolve(undefined);
      });

      const errorQueue = new EmbeddingQueue();

      const job1 = await errorQueue.addJob({
        type: 'fts_index',
        resourceId: 'doc-1',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      const job2 = await errorQueue.addJob({
        type: 'fts_index',
        resourceId: 'doc-2',
        resourceType: 'document',
        payload: { tableName: 'messages_vec', column: 'content' },
        userId: 'user-1'
      });

      // Process first job - will fail after max retries
      for (let i = 0; i < 4; i++) {
        try {
          await errorQueue.processJob(job1);
        } catch {
          // Ignore
        }
        await new Promise(r => setTimeout(r, 200));
      }

      // Process second job - should succeed
      await errorQueue.processJob(job2);

      // First job should be failed, second should be completed
      const updated1 = await errorQueue.getJob(job1.id);
      const updated2 = await errorQueue.getJob(job2.id);
      expect(updated1?.status).toBe('failed');
      expect(updated2?.status).toBe('completed');
    });

    it('should handle invalid job IDs gracefully', async () => {
      // Should not throw - just return
      await queue.processJob('invalid-id' as any);
      // If we reach here, test passes
      expect(true).toBe(true);
    });
  });

  describe('Mixed Job Types', () => {
    it('should process both embedding and fts_index jobs', async () => {
      const embedJob = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        payload: { text: 'test content' },
        userId: 'user-1'
      });

      const ftsJob = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-2',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      await queue.processJob(embedJob);
      await queue.processJob(ftsJob);

      const updatedEmbed = await queue.getJob(embedJob.id);
      const updatedFts = await queue.getJob(ftsJob.id);
      expect(updatedEmbed?.status).toBe('completed');
      expect(updatedFts?.status).toBe('completed');
      expect(createFTSIndex).toHaveBeenCalledWith('documents_vec', 'content');
    });

    it('should process multiple fts_index jobs sequentially', async () => {
      const job1 = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-1',
        resourceType: 'document',
        payload: { text: 'test' },
        userId: 'user-1'
      });

      const job2 = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-2',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1'
      });

      const job3 = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-3',
        resourceType: 'document',
        payload: { tableName: 'messages_vec', column: 'content' },
        userId: 'user-1'
      });

      await queue.processJob(job1);
      await queue.processJob(job2);
      await queue.processJob(job3);

      const updated1 = await queue.getJob(job1.id);
      const updated2 = await queue.getJob(job2.id);
      const updated3 = await queue.getJob(job3.id);
      expect(updated1?.status).toBe('completed');
      expect(updated2?.status).toBe('completed');
      expect(updated3?.status).toBe('completed');
    });
  });

  describe('FTS Index Job with Scope', () => {
    it('should preserve scope for fts_index job', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1',
        agentId: 'agent-1',
        teamId: 'team-1'
      });

      expect(job.userId).toBe('user-1');
      expect(job.agentId).toBe('agent-1');
      expect(job.teamId).toBe('team-1');
    });

    it('should process fts_index job with full scope', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-456',
        resourceType: 'document',
        payload: { tableName: 'documents_vec', column: 'content' },
        userId: 'user-1',
        agentId: 'agent-1',
        teamId: 'team-1'
      });

      await queue.processJob(job);

      const updated = await queue.getJob(job.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.userId).toBe('user-1');
    });
  });
});

describe('FTS Index Job Type Definitions', () => {
  it('should define fts_index in JobType', () => {
    const ftsIndex: JobType = 'fts_index';
    const embedding: JobType = 'embedding';
    
    expect(ftsIndex).toBe('fts_index');
    expect(embedding).toBe('embedding');
  });

  it('should accept fts_index in CreateJobOptions', () => {
    const options: CreateJobOptions = {
      type: 'fts_index',
      resourceId: 'doc-1',
      resourceType: 'document',
      payload: { tableName: 'documents_vec', column: 'content' },
      userId: 'user-1'
    };

    expect(options.type).toBe('fts_index');
  });

  it('should accept fts_index job in QueueJob', () => {
    const job: QueueJob = {
      id: 'test-1',
      type: 'fts_index',
      status: 'pending',
      resourceId: 'doc-1',
      resourceType: 'document',
      payload: { tableName: 'documents_vec', column: 'content' },
      retries: 0,
      createdAt: Date.now(),
      userId: 'user-1'
    };

    expect(job.type).toBe('fts_index');
    expect(job.status).toBe('pending');
  });
});
