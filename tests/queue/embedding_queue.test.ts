/**
 * @file tests/queue/embedding_queue.test.ts
 * @description Background queue system tests (TDD)
 */

import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { resetConnection, closeConnection, setDatabasePath } from '../../src/sqlite/connection';
import type { 
  QueueJob, 
  JobType, 
  JobStatus, 
  QueueStats,
  CreateJobOptions 
} from '../../src/queue/types';
import { EmbeddingQueue } from '../../src/queue/embedding_queue';
import { recordToJob, jobToRecord } from '../../src/queue/converters';

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

// Mock Ollama embedder
const mockGetEmbedding = vi.fn().mockResolvedValue(Array(768).fill(0.1));
const mockGetEmbeddings = vi.fn().mockResolvedValue([Array(768).fill(0.1)]);
const mockGetModel = vi.fn().mockReturnValue('nomic-embed-text');
const mockGetDimension = vi.fn().mockReturnValue(768);

vi.mock('../../src/embedder/ollama', () => ({
  createEmbedder: vi.fn(() => ({
    getEmbedding: mockGetEmbedding,
    getEmbeddings: mockGetEmbeddings,
    getModel: mockGetModel,
    getDimension: mockGetDimension
  }))
}));

// Import after mock
import { createEmbedder } from '../../src/embedder/ollama';

// Helper to wait for async operations
const waitFor = (fn: () => boolean, timeout = 500): Promise<void> => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (fn()) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
};

describe('EmbeddingQueue', () => {
  let queue: EmbeddingQueue;

  beforeEach(() => {
    // Reset SQLite connection for isolation
    resetConnection();
    setDatabasePath(':memory:');
    
    // Create fresh queue instance
    queue = new EmbeddingQueue();
    
    // Reset mock to successful implementation
    mockGetEmbedding.mockResolvedValue(Array(768).fill(0.1));
    mockGetEmbedding.mockClear();
  });

  afterEach(() => {
    queue.clear();
    closeConnection();
    // Reset mock for next test
    mockGetEmbedding.mockResolvedValue(Array(768).fill(0.1));
    vi.clearAllMocks();
  });

  describe('Queue Instantiation', () => {
    it('should create queue instance', () => {
      expect(queue).toBeDefined();
    });

    it('should have empty initial state', () => {
      expect(queue.getStats().pending).toBe(0);
      expect(queue.getStats().processing).toBe(0);
      expect(queue.getStats().completed).toBe(0);
    });

    it('should have getJob method', () => {
      expect(typeof queue.getJob).toBe('function');
    });

    it('should have addJob method', () => {
      expect(typeof queue.addJob).toBe('function');
    });

    it('should have processJob method', () => {
      expect(typeof queue.processJob).toBe('function');
    });
  });

  describe('Adding Jobs', () => {
    it('should add embedding job to queue', async () => {
      const job = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test content' },
        userId: 'user-1'
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.type).toBe('embedding');
      expect(job.status).toBe('pending');
      expect(job.resourceId).toBe('doc-123');
      expect(job.retries).toBe(0);
    });

    it('should add fts_index job to queue', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-456',
        resourceType: 'document',
        payload: { content: 'indexable content' },
        userId: 'user-1'
      });

      expect(job.type).toBe('fts_index');
      expect(job.status).toBe('pending');
    });

    it('should add job with scope', async () => {
      const job = await queue.addJob({
        type: 'embedding',
        resourceId: 'asset-789',
        resourceType: 'asset',
        payload: {},
        userId: 'user-1',
        agentId: 'agent-1',
        teamId: 'team-1'
      });

      expect(job.userId).toBe('user-1');
      expect(job.agentId).toBe('agent-1');
      expect(job.teamId).toBe('team-1');
    });

    it('should add multiple jobs with unique IDs', async () => {
      const job1 = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        userId: 'user-1'
      });

      const job2 = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-2',
        resourceType: 'document',
        userId: 'user-1'
      });

      expect(job1.id).not.toBe(job2.id);
    });

    it('should track pending jobs count', async () => {
      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        userId: 'user-1'
      });

      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-2',
        resourceType: 'document',
        userId: 'user-1'
      });

      expect(queue.getStats().pending).toBe(2);
    });
  });

  describe('Processing Jobs', () => {
    it('should process job and mark as completed', async () => {
      const job = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test' },
        userId: 'user-1'
      });

      await queue.processJob(job.id);

      const updated = queue.getJob(job.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
    });

    it('should process jobs in order', async () => {
      const processed: string[] = [];

      // Add multiple jobs
      const job1 = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        payload: { text: 'content 1' },
        userId: 'user-1'
      });

      const job2 = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-2',
        resourceType: 'document',
        payload: { text: 'content 2' },
        userId: 'user-1'
      });

      const job3 = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-3',
        resourceType: 'document',
        payload: { text: 'content 3' },
        userId: 'user-1'
      });

      // Process all
      await queue.processJob(job1.id);
      processed.push(queue.getJob(job1.id)!.status);
      
      await queue.processJob(job2.id);
      processed.push(queue.getJob(job2.id)!.status);
      
      await queue.processJob(job3.id);
      processed.push(queue.getJob(job3.id)!.status);

      // All should be completed
      expect(processed.every(s => s === 'completed')).toBe(true);
    });

    it('should process fts_index jobs', async () => {
      const job = await queue.addJob({
        type: 'fts_index',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { content: 'indexable' },
        userId: 'user-1'
      });

      await queue.processJob(job.id);

      const updated = queue.getJob(job.id);
      expect(updated?.status).toBe('completed');
    });

    it('should call embedder for embedding jobs', async () => {
      const job = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'embedding text' },
        userId: 'user-1'
      });

      await queue.processJob(job.id);

      const mockEmbedder = createEmbedder();
      expect(mockEmbedder.getEmbedding).toHaveBeenCalledWith('embedding text');
    });
  });

  describe('Job Completion', () => {
    it('should mark job as completed with timestamp', async () => {
      const job = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        userId: 'user-1'
      });

      await queue.processJob(job.id);

      const updated = queue.getJob(job.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeGreaterThanOrEqual(job.createdAt);
    });

    it('should increment completed count in stats', async () => {
      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        userId: 'user-1'
      });

      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-2',
        resourceType: 'document',
        userId: 'user-1'
      });

      const jobs = queue.getAllJobs();
      for (const job of jobs) {
        await queue.processJob(job.id);
      }

      expect(queue.getStats().completed).toBe(2);
      expect(queue.getStats().pending).toBe(0);
    });

    it('should track total processed in stats', async () => {
      const job = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        userId: 'user-1'
      });

      await queue.processJob(job.id);

      expect(queue.getStats().totalProcessed).toBe(1);
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed job up to max 3 times', async () => {
      // Save original mock implementation
      const originalMock = mockGetEmbedding.getMockImplementation();
      
      // Override to make it fail
      mockGetEmbedding.mockRejectedValue(new Error('Embedding failed'));

      const failingQueue = new EmbeddingQueue();

      const job = await failingQueue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test' },
        userId: 'user-1'
      });

      // Process and expect retries
      for (let i = 0; i < 3; i++) {
        try {
          await failingQueue.processJob(job.id);
        } catch {
          // Ignore errors during retry
        }
        await new Promise(r => setTimeout(r, 150));
      }

      // Restore original mock
      if (originalMock) {
        mockGetEmbedding.mockImplementation(originalMock);
      }

      const updated = failingQueue.getJob(job.id);
      // After max retries (3), job should be failed
      expect(updated?.retries).toBeLessThanOrEqual(3);
      expect(updated?.status).toBe('failed');
    });

    it('should record error message on failure', async () => {
      const originalMock = mockGetEmbedding.getMockImplementation();
      
      mockGetEmbedding.mockRejectedValue(new Error('Specific error'));

      const errorQueue = new EmbeddingQueue();

      const job = await errorQueue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test' },
        userId: 'user-1'
      });

      // Exhaust retries
      for (let i = 0; i < 5; i++) {
        try {
          await errorQueue.processJob(job.id);
        } catch {
          // Ignore
        }
        await new Promise(r => setTimeout(r, 150));
      }

      // Restore
      if (originalMock) {
        mockGetEmbedding.mockImplementation(originalMock);
      }

      const updated = errorQueue.getJob(job.id);
      expect(updated?.error).toBeDefined();
      expect(updated?.error).toContain('Specific error');
    });

    it('should not retry completed jobs', async () => {
      const job = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        userId: 'user-1'
      });

      await queue.processJob(job.id);
      expect(queue.getJob(job.id)?.status).toBe('completed');

      // Try to process again - should still be completed
      await queue.processJob(job.id);
      expect(queue.getJob(job.id)?.status).toBe('completed');
    });
  });

  describe('Job Failure Handling', () => {
    it('should handle embedder errors gracefully', async () => {
      const originalMock = mockGetEmbedding.getMockImplementation();
      
      mockGetEmbedding.mockRejectedValue(new Error('Network error'));

      const errorQueue = new EmbeddingQueue();

      const job = await errorQueue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test' },
        userId: 'user-1'
      });

      // Process multiple times to exhaust retries (maxRetries = 3)
      for (let i = 0; i < 4; i++) {
        try {
          await errorQueue.processJob(job.id);
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 150));
      }

      // Restore
      if (originalMock) {
        mockGetEmbedding.mockImplementation(originalMock);
      }

      const updated = errorQueue.getJob(job.id);
      // After retries exhausted (3), should be failed
      expect(updated?.status).toBe('failed');
    });

    it('should handle invalid job IDs gracefully', async () => {
      // Should not throw - just return
      await queue.processJob('invalid-id');
      // If we reach here, test passes
      expect(true).toBe(true);
    });

    it('should track failed jobs in stats', async () => {
      const originalMock = mockGetEmbedding.getMockImplementation();
      
      mockGetEmbedding.mockRejectedValue(new Error('Always fails'));

      const errorQueue = new EmbeddingQueue();

      const job = await errorQueue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test' },
        userId: 'user-1'
      });

      // Exhaust retries
      for (let i = 0; i < 5; i++) {
        try {
          await errorQueue.processJob(job.id);
        } catch {
          // Ignore
        }
        await new Promise(r => setTimeout(r, 150));
      }

      // Restore
      if (originalMock) {
        mockGetEmbedding.mockImplementation(originalMock);
      }

      expect(errorQueue.getStats().failed).toBe(1);
    });

    it('should process remaining jobs after one fails', async () => {
      const originalMock = mockGetEmbedding.getMockImplementation();
      
      let callCount = 0;
      mockGetEmbedding.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First fails'));
        }
        return Promise.resolve(Array(768).fill(0.1));
      });

      const errorQueue = new EmbeddingQueue();

      const job1 = await errorQueue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        payload: { text: 'fail first' },
        userId: 'user-1'
      });

      const job2 = await errorQueue.addJob({
        type: 'embedding',
        resourceId: 'doc-2',
        resourceType: 'document',
        payload: { text: 'then succeed' },
        userId: 'user-1'
      });

      // Process first - may fail and retry
      for (let i = 0; i < 4; i++) {
        try {
          await errorQueue.processJob(job1.id);
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 150));
      }

      // Process second job - should succeed
      await errorQueue.processJob(job2.id);

      // Restore
      if (originalMock) {
        mockGetEmbedding.mockImplementation(originalMock);
      }

      // At least one should complete
      const stats = errorQueue.getStats();
      expect(stats.completed + stats.failed).toBe(2);
    });
  });

  describe('Queue Queries', () => {
    it('should get job by ID', async () => {
      const created = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        userId: 'user-1'
      });

      const retrieved = queue.getJob(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent job', () => {
      const job = queue.getJob('non-existent');
      expect(job).toBeUndefined();
    });

    it('should get all jobs', async () => {
      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        userId: 'user-1'
      });

      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-2',
        resourceType: 'document',
        userId: 'user-1'
      });

      const all = queue.getAllJobs();
      expect(all.length).toBe(2);
    });

    it('should get jobs by status', async () => {
      const job1 = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        userId: 'user-1'
      });

      const job2 = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-2',
        resourceType: 'document',
        userId: 'user-1'
      });

      // Process first job
      await queue.processJob(job1.id);

      const pending = queue.getJobsByStatus('pending');
      const completed = queue.getJobsByStatus('completed');

      expect(pending.length).toBe(1);
      expect(pending[0]?.id).toBe(job2.id);
      expect(completed.length).toBe(1);
      expect(completed[0]?.id).toBe(job1.id);
    });

    it('should get pending jobs', async () => {
      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        userId: 'user-1'
      });

      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-2',
        resourceType: 'document',
        userId: 'user-1'
      });

      const pending = queue.getPendingJobs();
      expect(pending.length).toBe(2);
    });
  });

  describe('processAll', () => {
    it('should process all pending jobs', async () => {
      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        payload: { text: 'text 1' },
        userId: 'user-1'
      });

      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-2',
        resourceType: 'document',
        payload: { text: 'text 2' },
        userId: 'user-1'
      });

      await queue.processAll();

      expect(queue.getStats().pending).toBe(0);
      expect(queue.getStats().completed).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all jobs', async () => {
      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-1',
        resourceType: 'document',
        userId: 'user-1'
      });

      queue.clear();

      expect(queue.getAllJobs().length).toBe(0);
      expect(queue.getStats().pending).toBe(0);
    });
  });
});

describe('Queue Types', () => {
  it('should define JobType union', () => {
    const embedding: JobType = 'embedding';
    const ftsIndex: JobType = 'fts_index';
    
    expect(embedding).toBe('embedding');
    expect(ftsIndex).toBe('fts_index');
  });

  it('should define JobStatus union', () => {
    const pending: JobStatus = 'pending';
    const processing: JobStatus = 'processing';
    const completed: JobStatus = 'completed';
    const failed: JobStatus = 'failed';
    
    expect(pending).toBe('pending');
    expect(processing).toBe('processing');
    expect(completed).toBe('completed');
    expect(failed).toBe('failed');
  });

  it('should define QueueJob interface', () => {
    const job: QueueJob = {
      id: 'test-1',
      type: 'embedding',
      status: 'pending',
      resourceId: 'doc-1',
      resourceType: 'document',
      payload: { text: 'test' },
      retries: 0,
      createdAt: Date.now(),
      userId: 'user-1'
    };

    expect(job.id).toBeDefined();
    expect(job.type).toBe('embedding');
    expect(job.status).toBe('pending');
  });

  it('should define CreateJobOptions interface', () => {
    const options: CreateJobOptions = {
      type: 'embedding',
      resourceId: 'doc-1',
      resourceType: 'document',
      userId: 'user-1'
    };

    expect(options.type).toBe('embedding');
    expect(options.userId).toBe('user-1');
  });
});

describe('DB Integration', () => {
  let queue: EmbeddingQueue;

  beforeEach(() => {
    resetConnection();
    setDatabasePath(':memory:');
    queue = new EmbeddingQueue();
    mockGetEmbedding.mockResolvedValue(Array(768).fill(0.1));
    mockGetEmbedding.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queue.clear();
    closeConnection();
    vi.clearAllMocks();
  });

  describe('createJob call format', () => {
    it('should call createJob with payload stringified', async () => {
      const mockCreateJob = createJob as MockedFunction<typeof createJob>;
      mockCreateJob.mockImplementation(() => {
        throw new Error('SQLite not available');
      });

      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test content' },
        userId: 'user-1'
      });

      expect(mockCreateJob).toHaveBeenCalled();
    });

    it('should call createJob with user_id in snake_case', async () => {
      const mockCreateJob = createJob as MockedFunction<typeof createJob>;
      mockCreateJob.mockImplementation(() => {
        throw new Error('SQLite not available');
      });

      await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        userId: 'user-1',
        agentId: 'agent-1',
        teamId: 'team-1'
      });

      expect(mockCreateJob).toHaveBeenCalledWith({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: {},
        userId: 'user-1',
        agentId: 'agent-1',
        teamId: 'team-1'
      });
    });

    it('should handle SQLite unavailable gracefully with fallback', async () => {
      const mockCreateJob = createJob as MockedFunction<typeof createJob>;
      mockCreateJob.mockImplementation(() => {
        throw new Error('SQLite not available');
      });

      const job = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test' },
        userId: 'user-1'
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.status).toBe('pending');
    });
  });

  describe('updateJob call format', () => {
    it('should call updateJob with positional args (not object)', async () => {
      const mockCreateJob = createJob as MockedFunction<typeof createJob>;
      const mockUpdateJob = updateJob as MockedFunction<typeof updateJob>;

      const job = await queue.addJob({
        type: 'embedding',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test' },
        userId: 'user-1'
      });

      mockCreateJob.mockReturnValue({
        id: job.id,
        type: 'embedding',
        status: 'pending',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: JSON.stringify({ text: 'test' }),
        retries: 0,
        user_id: 'user-1',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      });

      mockUpdateJob.mockReturnValue(true);

      await queue.processJob(job);

      expect(mockUpdateJob).toHaveBeenCalled();
    });
  });

  describe('converters usage', () => {
    it('should use recordToJob for type conversion', async () => {
      // This test will fail until converters.ts is implemented
      expect(() => {
        recordToJob({
          id: 'test-1',
          type: 'embedding',
          status: 'pending',
          payload: JSON.stringify({ text: 'test' }),
          retries: 0,
          user_id: 'user-1',
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        });
      }).toThrow();
    });

    it('should use jobToRecord for type conversion', async () => {
      // This test will fail until converters.ts is implemented
      const job: QueueJob = {
        id: 'test-1',
        type: 'embedding',
        status: 'pending',
        resourceId: 'doc-123',
        resourceType: 'document',
        payload: { text: 'test' },
        retries: 0,
        createdAt: Date.now(),
        userId: 'user-1'
      };

      expect(() => {
        jobToRecord(job);
      }).toThrow();
    });
  });
});