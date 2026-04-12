/**
 * @file tests/sqlite/users.test.ts
 * @description Users table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  listUsers,
  UserRecord
} from '../../src/sqlite/users';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Users Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('createUser', () => {
    it('should create user with required fields', () => {
      const user = createUser({
        id: 'user-1',
        name: 'Test User'
      });
      
      expect(user).toBeDefined();
      expect(user.id).toBe('user-1');
      expect(user.name).toBe('Test User');
    });

    it('should create user with all fields', () => {
      const user = createUser({
        id: 'user-2',
        name: 'Full User',
        email: 'test@example.com',
        preferences: '{"theme": "dark"}'
      });
      
      expect(user.email).toBe('test@example.com');
      expect(user.preferences).toBe('{"theme": "dark"}');
    });

    it('should set timestamps', () => {
      const user = createUser({
        id: 'user-3',
        name: 'Timestamp User'
      });
      
      expect(user.created_at).toBeDefined();
      expect(user.updated_at).toBeDefined();
      expect(user.created_at).toBeGreaterThan(0);
    });
  });

  describe('getUserById', () => {
    it('should get user by id', () => {
      createUser({ id: 'user-4', name: 'Get User' });
      
      const user = getUserById('user-4');
      
      expect(user).toBeDefined();
      expect(user?.name).toBe('Get User');
    });

    it('should return undefined for non-existent user', () => {
      const user = getUserById('non-existent');
      
      expect(user).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should get user by email', () => {
      createUser({
        id: 'user-5',
        name: 'Email User',
        email: 'email@test.com'
      });
      
      const user = getUserByEmail('email@test.com');
      
      expect(user).toBeDefined();
      expect(user?.id).toBe('user-5');
    });

    it('should return undefined for non-existent email', () => {
      const user = getUserByEmail('nonexistent@test.com');
      
      expect(user).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user name', () => {
      createUser({ id: 'user-6', name: 'Original' });
      
      const updated = updateUser('user-6', { name: 'Updated' });
      
      expect(updated?.name).toBe('Updated');
    });

    it('should update user email', () => {
      createUser({ id: 'user-7', name: 'Email Update', email: 'old@test.com' });
      
      const updated = updateUser('user-7', { email: 'new@test.com' });
      
      expect(updated?.email).toBe('new@test.com');
    });

    it('should update timestamp', () => {
      createUser({ id: 'user-8', name: 'Timestamp Update' });
      const original = getUserById('user-8');
      
      // Wait a bit to ensure different timestamp
      const updated = updateUser('user-8', { name: 'Updated Name' });
      
      expect(updated?.updated_at).toBeGreaterThanOrEqual(original!.updated_at);
    });

    it('should return undefined for non-existent user', () => {
      const updated = updateUser('non-existent', { name: 'Updated' });
      
      expect(updated).toBeUndefined();
    });
  });

  describe('deleteUser', () => {
    it('should delete user', () => {
      createUser({ id: 'user-9', name: 'Delete User' });
      
      const result = deleteUser('user-9');
      
      expect(result).toBe(true);
      expect(getUserById('user-9')).toBeNull();
    });

    it('should return false for non-existent user', () => {
      const result = deleteUser('non-existent');
      
      expect(result).toBe(false);
    });
  });

  describe('listUsers', () => {
    it('should list all users', () => {
      createUser({ id: 'user-10', name: 'User A' });
      createUser({ id: 'user-11', name: 'User B' });
      
      const users = listUsers();
      
      expect(users.length).toBe(2);
    });

    it('should return empty array when no users', () => {
      const users = listUsers();
      
      expect(users).toEqual([]);
    });
  });
});