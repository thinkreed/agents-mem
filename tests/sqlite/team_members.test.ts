/**
 * @file tests/sqlite/team_members.test.ts
 * @description Team members table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  addTeamMember,
  getTeamMembers,
  getAgentTeams,
  updateTeamMemberRole,
  removeTeamMember,
  isTeamMember,
  TeamMemberRecord
} from '../../src/sqlite/team_members';
import { createUser } from '../../src/sqlite/users';
import { createAgent } from '../../src/sqlite/agents';
import { createTeam } from '../../src/sqlite/teams';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Team Members Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'Owner' });
    createAgent({ id: 'agent-1', user_id: 'user-1', name: 'Agent A' });
    createAgent({ id: 'agent-2', user_id: 'user-1', name: 'Agent B' });
    createTeam({ id: 'team-1', name: 'Team A', owner_user_id: 'user-1' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('addTeamMember', () => {
    it('should add team member', () => {
      const member = addTeamMember({
        team_id: 'team-1',
        agent_id: 'agent-1'
      });
      
      expect(member).toBeDefined();
      expect(member.team_id).toBe('team-1');
      expect(member.agent_id).toBe('agent-1');
      expect(member.role).toBe('member');
    });

    it('should add member with custom role', () => {
      const member = addTeamMember({
        team_id: 'team-1',
        agent_id: 'agent-2',
        role: 'admin'
      });
      
      expect(member.role).toBe('admin');
    });
  });

  describe('getTeamMembers', () => {
    it('should get all team members', () => {
      addTeamMember({ team_id: 'team-1', agent_id: 'agent-1' });
      addTeamMember({ team_id: 'team-1', agent_id: 'agent-2' });
      
      const members = getTeamMembers('team-1');
      
      expect(members.length).toBe(2);
    });
  });

  describe('getAgentTeams', () => {
    it('should get teams for agent', () => {
      addTeamMember({ team_id: 'team-1', agent_id: 'agent-1' });
      
      const teams = getAgentTeams('agent-1');
      
      expect(teams.length).toBe(1);
      expect(teams[0].team_id).toBe('team-1');
    });
  });

  describe('updateTeamMemberRole', () => {
    it('should update member role', () => {
      addTeamMember({ team_id: 'team-1', agent_id: 'agent-1' });
      
      const updated = updateTeamMemberRole('team-1', 'agent-1', 'admin');
      
      expect(updated?.role).toBe('admin');
    });
  });

  describe('removeTeamMember', () => {
    it('should remove team member', () => {
      addTeamMember({ team_id: 'team-1', agent_id: 'agent-1' });
      
      const result = removeTeamMember('team-1', 'agent-1');
      
      expect(result).toBe(true);
      expect(getTeamMembers('team-1').length).toBe(0);
    });
  });

  describe('isTeamMember', () => {
    it('should return true for member', () => {
      addTeamMember({ team_id: 'team-1', agent_id: 'agent-1' });
      
      expect(isTeamMember('team-1', 'agent-1')).toBe(true);
    });

    it('should return false for non-member', () => {
      expect(isTeamMember('team-1', 'agent-2')).toBe(false);
    });
  });
});