import type { QueueJob, JobType, JobStatus } from './types';
import type { QueueJobRecord } from '../sqlite/queue_jobs';

export function recordToJob(record: QueueJobRecord): QueueJob {
  let payloadObj: Record<string, unknown>;
  try {
    payloadObj = typeof record.payload === 'string'
      ? JSON.parse(record.payload)
      : record.payload;
  } catch {
    payloadObj = {};
  }

  return {
    id: record.id,
    type: record.type as JobType,
    status: record.status as JobStatus,
    resourceId: (payloadObj.resourceId as string) || record.id,
    resourceType: (payloadObj.resourceType as string) || 'unknown',
    payload: payloadObj,
    retries: record.retries,
    error: record.error ?? undefined,
    createdAt: record.created_at * 1000,
    userId: record.user_id,
    agentId: record.agent_id ?? undefined,
    teamId: record.team_id ?? undefined,
  };
}

export function jobToRecord(job: QueueJob): Partial<QueueJobRecord> {
  const payload = {
    ...job.payload,
    resourceId: job.resourceId,
    resourceType: job.resourceType,
  };

  return {
    id: job.id,
    type: job.type,
    status: job.status,
    payload: JSON.stringify(payload),
    retries: job.retries,
    error: job.error,
    user_id: job.userId,
    agent_id: job.agentId,
    team_id: job.teamId,
    created_at: Math.floor(job.createdAt / 1000),
  };
}
