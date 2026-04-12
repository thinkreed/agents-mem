/**
 * @file src/sqlite/users.ts
 * @description Users table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';

/**
 * User record type
 */
export interface UserRecord {
  id: string;
  name: string;
  email?: string;
  preferences?: string;
  created_at: number;
  updated_at: number;
}

/**
 * User creation input
 */
export interface UserInput {
  id?: string;
  name: string;
  email?: string;
  preferences?: string;
}

/**
 * User update input
 */
export interface UserUpdate {
  name?: string;
  email?: string;
  preferences?: string;
}

/**
 * Create user
 */
export function createUser(input: UserInput): UserRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  
  db.run(
    `INSERT INTO users (id, name, email, preferences, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.email ?? null, input.preferences ?? null, now, now]
  );
  
  return {
    id,
    name: input.name,
    email: input.email,
    preferences: input.preferences,
    created_at: now,
    updated_at: now
  };
}

/**
 * Get user by ID
 */
export function getUserById(id: string): UserRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<UserRecord>(
    'SELECT * FROM users WHERE id = ?',
    [id]
  );
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): UserRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<UserRecord>(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
}

/**
 * Update user
 */
export function updateUser(id: string, update: UserUpdate): UserRecord | undefined {
  const db = getConnection();
  const existing = getUserById(id);
  
  if (!existing) return undefined;
  
  const now = Math.floor(Date.now() / 1000);
  const name = update.name ?? existing.name;
  const email = update.email ?? existing.email;
  const preferences = update.preferences ?? existing.preferences;
  
  db.run(
    `UPDATE users SET name = ?, email = ?, preferences = ?, updated_at = ? WHERE id = ?`,
    [name, email, preferences, now, id]
  );
  
  return {
    ...existing,
    name,
    email,
    preferences,
    updated_at: now
  };
}

/**
 * Delete user
 */
export function deleteUser(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM users WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * List all users
 */
export function listUsers(): UserRecord[] {
  const db = getConnection();
  
  return db.query<UserRecord>('SELECT * FROM users ORDER BY created_at DESC');
}