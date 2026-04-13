/**
 * @file src/openviking/index.ts
 * @description OpenViking integration module entry point
 */

// Types
export type {
  OpenVikingConfig,
  VikingResourceType,
  VikingURI,
  AddResourceParams,
  AddResourceResult,
  SearchParams,
  MatchedContext,
  FindResult,
  ContentResult,
  VikingError,
} from './types';

export { DEFAULT_OPENVIKING_CONFIG } from './types';

// Config
export {
  loadConfigFromEnv,
  getEffectiveConfig,
  getConfig,
  initConfig,
  resetConfig,
  validateConfig,
} from './config';

// HTTP Client
export {
  OpenVikingHTTPClient,
  getOpenVikingClient,
  initClient,
  resetClient,
} from './http_client';

// URI Adapter
export type { URIAdapter } from './uri_adapter';
export {
  getURIAdapter,
  resetURIAdapter,
} from './uri_adapter';

// Scope Mapper
export type { VikingScope } from './scope_mapper';
export {
  ScopeMapper,
  getScopeMapper,
  resetScopeMapper,
} from './scope_mapper';

// Multimodal
export type { MultimodalUploadResult, MultimodalType } from './multimodal';
export {
  MultimodalUploader,
  SUPPORTED_MIME_TYPES,
  detectMultimodalType,
  getMultimodalUploader,
  resetMultimodalUploader,
} from './multimodal';