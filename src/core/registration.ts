/**
 * @file src/core/registration.ts
 * @description Service registration for tsyringe dependency injection
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { TOKENS } from './tokens';

// Import service classes
import { DatabaseConnection } from '../sqlite/connection';
import { OpenVikingHTTPClient } from '../openviking/http_client';
import { OllamaEmbedder } from '../embedder/ollama';
import { OllamaLLMClient } from '../llm/ollama';
import { TieredGenerator } from '../tiered/generator';
import { FactExtractor } from '../facts/extractor';
import { URIAdapter } from '../openviking/uri_adapter';
import { ScopeMapper } from '../openviking/scope_mapper';
import { AuditLogger } from '../utils/audit_logger';
import { LogBuffer } from '../utils/log_buffer';

/**
 * Register all services to tsyringe container
 */
export function registerServices(): void {
  // Infrastructure layer - singletons
  container.register(TOKENS.DatabaseConnection, { useClass: DatabaseConnection });
  container.register(TOKENS.OpenVikingClient, { useClass: OpenVikingHTTPClient });
  container.register(TOKENS.Embedder, { useClass: OllamaEmbedder });
  container.register(TOKENS.LLMClient, { useClass: OllamaLLMClient });

  // Service layer - singletons
  container.register(TOKENS.TieredGenerator, { useClass: TieredGenerator });
  container.register(TOKENS.FactExtractor, { useClass: FactExtractor });
  container.register(TOKENS.URIAdapter, { useClass: URIAdapter });
  container.register(TOKENS.ScopeMapper, { useClass: ScopeMapper });

  // Cross-cutting concerns - singletons
  container.register(TOKENS.AuditLogger, { useClass: AuditLogger });
  container.register(TOKENS.LogBuffer, { useClass: LogBuffer });
}

// Auto-register on import
registerServices();

export { container };
