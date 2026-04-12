/**
 * @file tests/sqlite/teams.test.ts
 * @description Teams table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTeam,
  getTeamById,
  getTeamsByOwner,
  updateTeam,
  deleteTeam,
  listTeams,
  TeamRecord
} from '../../src/sqlite/teams';
import { createUser } from '../../src/sqlite/users';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Teams Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'Owner' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('createTeam', () => {
    it('should create team with required fields', () => {
      const team = createTeam({
        id: 'team-1',
        name: 'Test Team',
        owner_user_id: 'user-1'
      });
      
      expect(team).toBeDefined();
      expect(team.id).toBe('team-1');
      expect(team.name).toBe('Test Team');
      expect(team.owner_user_id).toBe('user-1');
    });

    it('should create team with all fields', () => {
      const team = createTeam({
        id: 'team-2',
        name: 'Full Team',
        owner_user_id: 'user-1',
        description: 'Team description',
        visibility: 'public'
      });
      
      expect(team.description).toBe('Team description');
      expect(team.visibility).toBe('public');
    });

    it('should default to private visibility', () => {
      const team = createTeam({
        id: 'team-3',
        name: 'Default Team',
        owner_user_id: 'user-1'
      });
      
      expect(team.visibility).toBe('private');
    });
  });

  describe('getTeamById', () => {
    it('should get team by id', () => {
      createTeam({ id: 'team-4', name: 'Get Team', owner_user_id: 'user-1' });
      
      const team = getTeamById('team-4');
      
      expect(team).toBeDefined();
      expect(team?.name).toBe('Get Team');
    });

    it('should return undefined for non-existent team', () => {
      const team = getTeamById('non-existent');
      
      expect(team).toBeNull();
    });
  });

  describe('getTeamsByOwner', () => {
    it('should get teams by owner', () => {
      createTeam({ id: 'team-5', name: 'Team A', owner_user_id: 'user-1' });
      createTeam({ id: 'team-6', name: 'Team B', owner_user_id: 'user-1' });
      
      const teams = getTeamsByOwner('user-1');
      
      expect(teams.length).toBe(2);
    });
  });

  describe('updateTeam', () => {
    it('should update team name', () => {
      createTeam({ id: 'team-7', name: 'Original', owner_user_id: 'user-1' });
      
      const updated = updateTeam('team-7', { name: 'Updated' });
      
      expect(updated?.name).toBe('Updated');
    });

    it('should update visibility', () => {
      createTeam({ id: 'team-8', name: 'Vis Team', owner_user_id: 'user-1' });
      
      const updated = updateTeam('team-8', { visibility: 'public' });
      
      expect(updated?.visibility).toBe('public');
    });
  });

  describe('deleteTeam', () => {
    it('should delete team', () => {
      createTeam({ id: 'team-9', name: 'Delete Team', owner_user_id: 'user-1' });
      
      const result = deleteTeam('team-9');
      
      expect(result).toBe(true);
      expect(getTeamById('team-9')).toBeNull();
    });
  });

  describe('listTeams', () => {
    it('should list all teams', () => {
      createTeam({ id: 'team-10', name: 'Team A', owner_user_id: 'user-1' });
      createTeam({ id: 'team-11', name: 'Team B', owner_user_id: 'user-1' });
      
      const teams = listTeams();
      
      expect(teams.length).toBe(2);
    });
  });
});