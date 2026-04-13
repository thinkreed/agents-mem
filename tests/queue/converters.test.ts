/**
 * @file tests/queue/converters.test.ts
 * @description Queue job converters TDD tests (Wave 1)
 */

import { describe, it, expect } from 'vitest';

// Type-only imports since converters.ts doesn't exist yet
import type { QueueJob } from '../../src/queue/types';
import type { QueueJobRecord } from '../../src/sqlite/queue_jobs';

describe('recordToJob', () => {
  // Module reset handled by tests/setup.ts

  it('converts snake_case user_id to camelCase userId', () => {
    // Import dynamically to ensure we test the module
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceId": "doc-1", "resourceType": "document"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.userId).toBe('user-123');
  });

  it('converts snake_case agent_id to camelCase agentId', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceId": "doc-1", "resourceType": "document"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: 'agent-456',
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.agentId).toBe('agent-456');
  });

  it('converts snake_case team_id to camelCase teamId', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceId": "doc-1", "resourceType": "document"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: 'team-789',
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.teamId).toBe('team-789');
  });

  it('converts created_at timestamp from seconds to milliseconds', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceId": "doc-1", "resourceType": "document"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.createdAt).toBe(1700000000 * 1000);
  });

  it('parses payload string to object', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceId": "doc-1", "resourceType": "document", "extra": "data"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.payload).toEqual({
      resourceId: 'doc-1',
      resourceType: 'document',
      extra: 'data'
    });
  });

  it('extracts resourceId from payload JSON', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceId": "doc-456", "resourceType": "document"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.resourceId).toBe('doc-456');
  });

  it('extracts resourceType from payload JSON', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceId": "doc-1", "resourceType": "asset"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.resourceType).toBe('asset');
  });

  it('falls back to record.id when resourceId missing in payload', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-fallback-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceType": "document"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.resourceId).toBe('job-fallback-123');
  });

  it('falls back to "unknown" when resourceType missing in payload', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceId": "doc-1"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.resourceType).toBe('unknown');
  });

  it('handles null optional fields (agent_id, team_id)', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: '{"resourceId": "doc-1", "resourceType": "document"}',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.agentId).toBeUndefined();
    expect(job.teamId).toBeUndefined();
  });

  it('handles malformed JSON payload gracefully (returns empty object)', () => {
    const { recordToJob } = require('../../src/queue/converters');
    
    const record: QueueJobRecord = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      payload: 'not-valid-json{',
      retries: 0,
      user_id: 'user-123',
      agent_id: undefined,
      team_id: undefined,
      created_at: 1700000000,
      updated_at: 1700000000,
    };
    
    const job = recordToJob(record);
    expect(job.payload).toEqual({});
  });
});

describe('jobToRecord', () => {
  // Module reset handled by tests/setup.ts

  it('converts camelCase to snake_case', () => {
    const { jobToRecord } = require('../../src/queue/converters');
    
    const job: QueueJob = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      resourceId: 'doc-1',
      resourceType: 'document',
      payload: { key: 'value' },
      retries: 0,
      userId: 'user-123',
      agentId: 'agent-456',
      teamId: 'team-789',
      createdAt: 1700000000000,
      startedAt: undefined,
      completedAt: undefined,
    };
    
    const record = jobToRecord(job);
    expect(record.user_id).toBe('user-123');
    expect(record.agent_id).toBe('agent-456');
    expect(record.team_id).toBe('team-789');
  });

  it('stringifies payload object to JSON string', () => {
    const { jobToRecord } = require('../../src/queue/converters');
    
    const job: QueueJob = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      resourceId: 'doc-1',
      resourceType: 'document',
      payload: { key: 'value', nested: { a: 1 } },
      retries: 0,
      userId: 'user-123',
      createdAt: 1700000000000,
    };
    
    const record = jobToRecord(job);
    const payloadObj = JSON.parse(record.payload);
    expect(payloadObj.key).toBe('value');
    expect(payloadObj.nested).toEqual({ a: 1 });
    expect(payloadObj.resourceId).toBe('doc-1');
    expect(payloadObj.resourceType).toBe('document');
  });

  it('includes resourceId and resourceType in payload JSON', () => {
    const { jobToRecord } = require('../../src/queue/converters');
    
    const job: QueueJob = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      resourceId: 'doc-456',
      resourceType: 'asset',
      payload: { extra: 'data' },
      retries: 0,
      userId: 'user-123',
      createdAt: 1700000000000,
    };
    
    const record = jobToRecord(job);
    const payloadObj = JSON.parse(record.payload);
    expect(payloadObj.resourceId).toBe('doc-456');
    expect(payloadObj.resourceType).toBe('asset');
    expect(payloadObj.extra).toBe('data');
  });

  it('converts timestamp from milliseconds to seconds (Math.floor)', () => {
    const { jobToRecord } = require('../../src/queue/converters');
    
    const job: QueueJob = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      resourceId: 'doc-1',
      resourceType: 'document',
      payload: {},
      retries: 0,
      userId: 'user-123',
      createdAt: 1700000000123, // milliseconds
    };
    
    const record = jobToRecord(job);
    expect(record.created_at).toBe(1700000000); // seconds (floored)
  });

  it('handles undefined optional fields', () => {
    const { jobToRecord } = require('../../src/queue/converters');
    
    const job: QueueJob = {
      id: 'job-123',
      type: 'embedding',
      status: 'pending',
      resourceId: 'doc-1',
      resourceType: 'document',
      payload: {},
      retries: 0,
      userId: 'user-123',
      agentId: undefined,
      teamId: undefined,
      createdAt: 1700000000000,
    };
    
    const record = jobToRecord(job);
    expect(record.agent_id).toBeUndefined();
    expect(record.team_id).toBeUndefined();
  });
});