/**
 * @file tests/production/crud_team.test.ts
 * @description Production-grade test for team resource CRUD
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { handleMemCreate, handleMemRead, handleMemUpdate, handleMemDelete } from '../../src/tools/crud_handlers';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { resetConnection } from '../../src/sqlite/connection';

const TEST_TIMEOUT = 30000;

describe('Team Resource - Full CRUD + Validation', () => {
  const testUserId = 'test-user-team-crud';
  const testOwnerId = 'test-team-owner';
  const createdTeamIds: string[] = [];

  beforeAll(async () => {
    resetConnection();
    resetManager();
    runMigrations();

    // Create users first (foreign key requirement)
    const { createUser, getUserById } = await import('../../src/sqlite/users');
    if (!getUserById(testUserId)) {
      createUser({ id: testUserId, name: testUserId });
    }
    if (!getUserById(testOwnerId)) {
      createUser({ id: testOwnerId, name: testOwnerId });
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    for (const id of createdTeamIds) {
      try { await handleMemDelete({ resource: 'team', id, scope: { userId: testUserId } }); } catch { /* ignore */ }
    }
  }, TEST_TIMEOUT);

  // ============================================================
  // CREATE - Validation
  // ============================================================
  describe('CREATE - Validation', () => {
    it('should reject missing name', async () => {
      const result = await handleMemCreate({
        resource: 'team',
        data: { ownerId: testOwnerId },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('name is required');
    });

    it('should reject missing ownerId', async () => {
      const result = await handleMemCreate({
        resource: 'team',
        data: { name: 'Test Team' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('ownerId is required');
    });
  });

  // ============================================================
  // CREATE - Success
  // ============================================================
  describe('CREATE - Success', () => {
    it('should create team with name and ownerId', async () => {
      const result = await handleMemCreate({
        resource: 'team',
        data: { name: 'Test Team Alpha', ownerId: testOwnerId },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.name).toBe('Test Team Alpha');
      expect(parsed.owner_user_id).toBe(testOwnerId);
      createdTeamIds.push(parsed.id);
    });

    it('should create multiple teams', async () => {
      const teamNames = ['Engineering Team', 'Marketing Team', 'Design Team', 'Sales Team'];
      for (const name of teamNames) {
        const result = await handleMemCreate({
          resource: 'team',
          data: { name, ownerId: testOwnerId },
          scope: { userId: testUserId }
        });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.id).toBeDefined();
        expect(parsed.name).toBe(name);
        createdTeamIds.push(parsed.id);
      }
    });
  });

  // ============================================================
  // READ - By ID
  // ============================================================
  describe('READ - By ID', () => {
    it('should read team by ID', async () => {
      if (createdTeamIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'team',
        query: { id: createdTeamIds[0] },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(createdTeamIds[0]);
      expect(parsed.name).toBeDefined();
    });

    it('should read team with members', async () => {
      if (createdTeamIds.length === 0) return;
      const result = await handleMemRead({
        resource: 'team',
        query: { id: createdTeamIds[0], filters: { members: true } },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.team).toBeDefined();
      expect(parsed.members).toBeDefined();
      expect(Array.isArray(parsed.members)).toBe(true);
      // Owner should be added as member during creation
      expect(parsed.members.length).toBeGreaterThanOrEqual(1);
    });

    it('should return error for non-existent team ID', async () => {
      const result = await handleMemRead({
        resource: 'team',
        query: { id: 'non-existent-team' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Team not found');
    });
  });

  // ============================================================
  // READ - List
  // ============================================================
  describe('READ - List', () => {
    it('should list all teams', async () => {
      const result = await handleMemRead({
        resource: 'team',
        query: { list: true },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // READ - Invalid Query
  // ============================================================
  describe('READ - Invalid Query', () => {
    it('should reject missing query', async () => {
      const result = await handleMemRead({
        resource: 'team',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('query is required');
    });

    it('should reject invalid query keys', async () => {
      const result = await handleMemRead({
        resource: 'team',
        query: { search: 'test' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('Invalid query for team');
    });
  });

  // ============================================================
  // UPDATE
  // ============================================================
  describe('UPDATE', () => {
    it('should update team name', async () => {
      if (createdTeamIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'team',
        id: createdTeamIds[0],
        data: { name: 'Updated Team Name' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.name).toContain('Updated');
    });

    it('should update team member role', async () => {
      if (createdTeamIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'team',
        id: createdTeamIds[0],
        data: { memberId: testOwnerId, role: 'admin' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.teamId).toBe(createdTeamIds[0]);
      expect(parsed.memberId).toBe(testOwnerId);
      expect(parsed.role).toBe('admin');
    });

    it('should reject update non-existent team', async () => {
      const result = await handleMemUpdate({
        resource: 'team',
        id: 'non-existent-team',
        data: { name: 'Updated' },
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('Team not found');
    });

    it('should reject missing id', async () => {
      const result = await handleMemUpdate({
        resource: 'team',
        data: { name: 'Updated' },
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });

    it('should reject empty data', async () => {
      if (createdTeamIds.length === 0) return;
      const result = await handleMemUpdate({
        resource: 'team',
        id: createdTeamIds[0],
        data: {},
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('data is required');
    });
  });

  // ============================================================
  // DELETE
  // ============================================================
  describe('DELETE', () => {
    it('should delete team with cascade (members)', async () => {
      if (createdTeamIds.length === 0) return;
      const teamId = createdTeamIds.pop()!;
      const result = await handleMemDelete({
        resource: 'team',
        id: teamId,
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.deletedMembers).toBeDefined();
    });

    it('should return success:false for non-existent team (idempotent)', async () => {
      const result = await handleMemDelete({
        resource: 'team',
        id: 'non-existent-team-delete',
        scope: { userId: testUserId }
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Team not found');
    });

    it('should reject missing id', async () => {
      const result = await handleMemDelete({
        resource: 'team',
        scope: { userId: testUserId }
      } as any);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('id is required');
    });
  });
});
