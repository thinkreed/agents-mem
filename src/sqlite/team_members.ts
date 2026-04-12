/**
 * @file src/sqlite/team_members.ts
 * @description Team members table CRUD operations
 */

import { getConnection } from './connection';

/**
 * Team member record type
 */
export interface TeamMemberRecord {
  team_id: string;
  agent_id: string;
  role: string;
  permissions?: string;
  joined_at: number;
}

/**
 * Team member input
 */
export interface TeamMemberInput {
  team_id: string;
  agent_id: string;
  role?: string;
  permissions?: string;
}

/**
 * Add team member
 */
export function addTeamMember(input: TeamMemberInput): TeamMemberRecord {
  const db = getConnection();
  const now = Math.floor(Date.now() / 1000);
  const role = input.role ?? 'member';
  
  db.run(
    `INSERT INTO team_members (team_id, agent_id, role, permissions, joined_at)
     VALUES (?, ?, ?, ?, ?)`,
    [input.team_id, input.agent_id, role, input.permissions ?? null, now]
  );
  
  return {
    team_id: input.team_id,
    agent_id: input.agent_id,
    role,
    permissions: input.permissions,
    joined_at: now
  };
}

/**
 * Get all members of a team
 */
export function getTeamMembers(teamId: string): TeamMemberRecord[] {
  const db = getConnection();
  
  return db.query<TeamMemberRecord>(
    'SELECT * FROM team_members WHERE team_id = ? ORDER BY joined_at ASC',
    [teamId]
  );
}

/**
 * Get teams for an agent
 */
export function getAgentTeams(agentId: string): TeamMemberRecord[] {
  const db = getConnection();
  
  return db.query<TeamMemberRecord>(
    'SELECT * FROM team_members WHERE agent_id = ?',
    [agentId]
  );
}

/**
 * Update team member role
 */
export function updateTeamMemberRole(teamId: string, agentId: string, role: string): TeamMemberRecord | undefined {
  const db = getConnection();
  
  db.run(
    `UPDATE team_members SET role = ? WHERE team_id = ? AND agent_id = ?`,
    [role, teamId, agentId]
  );
  
  return db.queryOne<TeamMemberRecord>(
    'SELECT * FROM team_members WHERE team_id = ? AND agent_id = ?',
    [teamId, agentId]
  );
}

/**
 * Remove team member
 */
export function removeTeamMember(teamId: string, agentId: string): boolean {
  const db = getConnection();
  
  const result = db.run(
    'DELETE FROM team_members WHERE team_id = ? AND agent_id = ?',
    [teamId, agentId]
  );
  
  return result.changes > 0;
}

/**
 * Check if agent is team member
 */
export function isTeamMember(teamId: string, agentId: string): boolean {
  const db = getConnection();
  
  const member = db.queryOne<TeamMemberRecord>(
    'SELECT * FROM team_members WHERE team_id = ? AND agent_id = ?',
    [teamId, agentId]
  );
  
  return member !== null && member !== undefined;
}

/**
 * Delete all members for a team
 */
export function deleteTeamMembersByTeam(teamId: string): number {
  const db = getConnection();
  
  const result = db.run('DELETE FROM team_members WHERE team_id = ?', [teamId]);
  
  return result.changes;
}