/**
 * @file tests/helpers/test_container.ts
 * @description Test container setup for dependency injection
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { TOKENS } from '../../src/core/tokens';
import {
  MockDatabaseConnection,
  MockOpenVikingClient,
  MockEmbedder,
  MockLLMClient,
  MockAuditLogger,
  MockLogBuffer,
} from './mocks';

/**
 * Setup test container with mock implementations
 */
export function setupTestContainer(): void {
  // Clear all registrations
  container.reset();

  // Register mock implementations
  container.register(TOKENS.DatabaseConnection, { useClass: MockDatabaseConnection });
  container.register(TOKENS.OpenVikingClient, { useClass: MockOpenVikingClient });
  container.register(TOKENS.Embedder, { useClass: MockEmbedder });
  container.register(TOKENS.LLMClient, { useClass: MockLLMClient });
  container.register(TOKENS.AuditLogger, { useClass: MockAuditLogger });
  container.register(TOKENS.LogBuffer, { useClass: MockLogBuffer });
}

/**
 * Teardown test container
 */
export function teardownTestContainer(): void {
  container.reset();
}

/**
 * Register a custom mock for a specific token
 */
export function registerMock<T>(token: string, mock: T): void {
  container.register(token, { useValue: mock });
}

/**
 * Get mock instance by token
 */
export function getMock<T>(token: string): T {
  return container.resolve(token) as T;
}

/**
 * Get specific mock instance by class
 */
export function getMockInstance<T>(cls: new (...args: unknown[]) => T): T {
  return container.resolve(cls);
}
