/**
 * @file src/openviking/config.ts
 * @description OpenViking configuration management
 */

import type { OpenVikingConfig } from './types';
import { DEFAULT_OPENVIKING_CONFIG } from './types';

/**
 * Environment variable mapping
 */
const ENV_MAPPING = {
  enabled: 'OPENVIKING_ENABLED',
  baseUrl: 'OPENVIKING_BASE_URL',
  apiKey: 'OPENVIKING_API_KEY',
  account: 'OPENVIKING_ACCOUNT',
  defaultUser: 'OPENVIKING_DEFAULT_USER',
  timeout: 'OPENVIKING_TIMEOUT',
  maxRetries: 'OPENVIKING_MAX_RETRIES',
} as const;

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<OpenVikingConfig> {
  const config: Partial<OpenVikingConfig> = {};
  
  // Load enabled flag
  const enabledEnv = process.env[ENV_MAPPING.enabled];
  if (enabledEnv !== undefined) {
    config.enabled = enabledEnv === 'true' || enabledEnv === '1';
  }
  
  // Load base URL
  const baseUrlEnv = process.env[ENV_MAPPING.baseUrl];
  if (baseUrlEnv) {
    config.baseUrl = baseUrlEnv;
  }
  
  // Load API key
  const apiKeyEnv = process.env[ENV_MAPPING.apiKey];
  if (apiKeyEnv) {
    config.apiKey = apiKeyEnv;
  }
  
  // Load account
  const accountEnv = process.env[ENV_MAPPING.account];
  if (accountEnv) {
    config.account = accountEnv;
  }
  
  // Load default user
  const defaultUserEnv = process.env[ENV_MAPPING.defaultUser];
  if (defaultUserEnv) {
    config.defaultUser = defaultUserEnv;
  }
  
  // Load timeout
  const timeoutEnv = process.env[ENV_MAPPING.timeout];
  if (timeoutEnv) {
    config.timeout = parseInt(timeoutEnv, 10);
  }
  
  // Load max retries
  const maxRetriesEnv = process.env[ENV_MAPPING.maxRetries];
  if (maxRetriesEnv) {
    config.maxRetries = parseInt(maxRetriesEnv, 10);
  }
  
  // Load embedding config
  const embeddingProviderEnv = process.env.OPENVIKING_EMBEDDING_PROVIDER;
  const embeddingModelEnv = process.env.OPENVIKING_EMBEDDING_MODEL;
  const embeddingDimensionEnv = process.env.OPENVIKING_EMBEDDING_DIMENSION;
  
  if (embeddingProviderEnv || embeddingModelEnv || embeddingDimensionEnv) {
    config.embedding = {
      provider: embeddingProviderEnv ?? DEFAULT_OPENVIKING_CONFIG.embedding.provider,
      model: embeddingModelEnv ?? DEFAULT_OPENVIKING_CONFIG.embedding.model,
      dimension: embeddingDimensionEnv 
        ? parseInt(embeddingDimensionEnv, 10)
        : DEFAULT_OPENVIKING_CONFIG.embedding.dimension,
    };
  }
  
  return config;
}

/**
 * Get effective configuration (default + env overrides)
 */
export function getEffectiveConfig(overrides?: Partial<OpenVikingConfig>): OpenVikingConfig {
  const envConfig = loadConfigFromEnv();
  
  const defaultRerank = {
    provider: 'vikingdb',
    model: 'doubao-rerank',
    threshold: 0.5,
  };
  
  return {
    ...DEFAULT_OPENVIKING_CONFIG,
    ...envConfig,
    ...overrides,
    embedding: {
      ...DEFAULT_OPENVIKING_CONFIG.embedding,
      ...(envConfig.embedding ?? {}),
      ...(overrides?.embedding ?? {}),
    },
    rerank: {
      ...defaultRerank,
      ...(envConfig.rerank ?? {}),
      ...(overrides?.rerank ?? {}),
    },
  };
}

/**
 * Singleton configuration instance
 */
let configInstance: OpenVikingConfig | null = null;

/**
 * Get singleton configuration
 */
export function getConfig(): OpenVikingConfig {
  if (!configInstance) {
    configInstance = getEffectiveConfig();
  }
  return configInstance;
}

/**
 * Initialize configuration with overrides
 */
export function initConfig(overrides?: Partial<OpenVikingConfig>): OpenVikingConfig {
  configInstance = getEffectiveConfig(overrides);
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Validate configuration
 */
export function validateConfig(config: OpenVikingConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields when enabled
  if (config.enabled) {
    if (!config.baseUrl) {
      errors.push('baseUrl is required when OpenViking is enabled');
    }
    
    // Validate URL format
    try {
      new URL(config.baseUrl);
    } catch {
      errors.push('baseUrl must be a valid URL');
    }
    
    // Validate embedding dimension
    if (config.embedding.dimension <= 0 || config.embedding.dimension > 4096) {
      errors.push('embedding.dimension must be between 1 and 4096');
    }
  }
  
  // Validate timeout
  if (config.timeout <= 0 || config.timeout > 300000) {
    errors.push('timeout must be between 1 and 300000 milliseconds');
  }
  
  // Validate max retries
  if (config.maxRetries < 0 || config.maxRetries > 10) {
    errors.push('maxRetries must be between 0 and 10');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}