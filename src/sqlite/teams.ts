/**
 * @file src/sqlite/teams.ts
 * @description Teams table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';

/**
 * Team record type
 */
export interface TeamRecord {
  id: string;
  name: string;
  description?: string;
  owner_user_id: string;
  visibility: string;
  created_at: number;
}

/**
 * Team creation input
 */
export interface TeamInput {
  id?: string;
  name: string;
  description?: string;
  owner_user_id: string;
  visibility?: string;
}

/**
 * Team update input
 */
export interface TeamUpdate {
  name?: string;
  description?: string;
  visibility?: string;
}

/**
 * Create team
 */
export function createTeam(input: TeamInput): TeamRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  const visibility = input.visibility ?? 'private';
  
  db.run(
    `INSERT INTO teams (id, name, description, owner_user_id, visibility, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.description ?? null, input.owner_user_id, visibility, now]
  );
  
  return {
    id,
    name: input.name,
    description: input.description,
    owner_user_id: input.owner_user_id,
    visibility,
    created_at: now
  };
}

/**
 * Get team by ID
 */
export function getTeamById(id: string): TeamRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<TeamRecord>(
    'SELECT * FROM teams WHERE id = ?',
    [id]
  );
}

/**
 * Get teams by owner user ID
 */
export function getTeamsByOwner(userId: string): TeamRecord[] {
  const db = getConnection();
  
  return db.query<TeamRecord>(
    'SELECT * FROM teams WHERE owner_user_id = ? ORDER BY created_at DESC',
    [userId]
  );
}

/**
 * Update team
 */
export function updateTeam(id: string, update: TeamUpdate): TeamRecord | undefined {
  const db = getConnection();
  const existing = getTeamById(id);
  
  if (!existing) return undefined;
  
  const name = update.name ?? existing.name;
  const description = update.description ?? existing.description;
  const visibility = update.visibility ?? existing.visibility;
  
  db.run(
    `UPDATE teams SET name = ?, description = ?, visibility = ? WHERE id = ?`,
    [name, description, visibility, id]
  );
  
  return {
    ...existing,
    name,
    description,
    visibility
  };
}

/**
 * Delete team
 */
export function deleteTeam(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM teams WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * List all teams
 */
export function listTeams(): TeamRecord[] {
  const db = getConnection();
  
  return db.query<TeamRecord>('SELECT * FROM teams ORDER BY created_at DESC');
}