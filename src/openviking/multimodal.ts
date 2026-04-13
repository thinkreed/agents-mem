/**
 * @file src/openviking/multimodal.ts
 * @description Multimodal upload support for OpenViking integration
 * 
 * OpenViking supports:
 * - Images (VLM generates descriptions automatically)
 * - Videos (extracted frames + descriptions)
 * - Audio (transcription + descriptions)
 * 
 * These are processed by VLM (Vision Language Model) like doubao-embedding-vision
 */

import { getOpenVikingClient } from './http_client';
import { getScopeMapper } from './scope_mapper';
import type { Scope } from '../core/types';
import type { OpenVikingConfig } from './types';

/**
 * Supported multimodal MIME types
 */
export const SUPPORTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
  video: ['video/mp4', 'video/webm', 'video/avi', 'video/mov'],
  audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/m4a'],
} as const;

/**
 * Multimodal type
 */
export type MultimodalType = 'image' | 'video' | 'audio';

/**
 * Multimodal upload result
 */
export interface MultimodalUploadResult {
  /** Viking URI for the uploaded file */
  uri: string;
  /** VLM-generated description/abstract */
  description: string;
  /** Processing task ID */
  taskId?: string;
  /** MIME type detected */
  mimeType: string;
  /** Size in bytes */
  size: number;
}

/**
 * Detect multimodal type from MIME type
 */
export function detectMultimodalType(mimeType: string): MultimodalType | null {
  if (SUPPORTED_MIME_TYPES.image.includes(mimeType as typeof SUPPORTED_MIME_TYPES.image[number])) {
    return 'image';
  }
  if (SUPPORTED_MIME_TYPES.video.includes(mimeType as typeof SUPPORTED_MIME_TYPES.video[number])) {
    return 'video';
  }
  if (SUPPORTED_MIME_TYPES.audio.includes(mimeType as typeof SUPPORTED_MIME_TYPES.audio[number])) {
    return 'audio';
  }
  return null;
}

/**
 * Multimodal uploader class
 */
export class MultimodalUploader {
  private config: OpenVikingConfig;
  
  constructor(config?: Partial<OpenVikingConfig>) {
    // Use default config from getOpenVikingClient
    this.config = {} as OpenVikingConfig;
  }
  
  /**
   * Upload image file
   * 
   * OpenViking will:
   * 1. Store the image file
   * 2. Use VLM (doubao-embedding-vision) to generate description
   * 3. Create embeddings for semantic search
   * 4. Generate L0/L1/L2 tiered content
   */
  async uploadImage(
    data: ArrayBuffer,
    mimeType: string,
    scope: Scope,
    filename?: string
  ): Promise<MultimodalUploadResult> {
    const client = getOpenVikingClient();
    const mapper = getScopeMapper();
    
    // Build target URI
    const targetUri = mapper.buildTargetForType(scope, 'resources') + '/images';
    
    // Upload via OpenViking
    const result = await client.uploadMultimodal(data, mimeType, targetUri);
    
    // Wait for processing to complete (VLM description generation)
    if (result.taskId) {
      const taskResult = await this.waitForTask(result.taskId);
      return {
        uri: result.uri,
        description: (taskResult.result?.description as string) ?? '',
        taskId: result.taskId,
        mimeType,
        size: data.byteLength,
      };
    }
    
    return {
      uri: result.uri,
      description: '',
      mimeType,
      size: data.byteLength,
    };
  }
  
  /**
   * Upload video file
   * 
   * OpenViking extracts key frames and generates descriptions
   */
  async uploadVideo(
    data: ArrayBuffer,
    mimeType: string,
    scope: Scope,
    filename?: string
  ): Promise<MultimodalUploadResult> {
    const client = getOpenVikingClient();
    const mapper = getScopeMapper();
    
    const targetUri = mapper.buildTargetForType(scope, 'resources') + '/videos';
    const result = await client.uploadMultimodal(data, mimeType, targetUri);
    
    if (result.taskId) {
      const taskResult = await this.waitForTask(result.taskId);
      return {
        uri: result.uri,
        description: (taskResult.result?.description as string) ?? '',
        taskId: result.taskId,
        mimeType,
        size: data.byteLength,
      };
    }
    
    return {
      uri: result.uri,
      description: '',
      mimeType,
      size: data.byteLength,
    };
  }
  
  /**
   * Upload audio file
   * 
   * OpenViking transcribes audio and generates description
   */
  async uploadAudio(
    data: ArrayBuffer,
    mimeType: string,
    scope: Scope,
    filename?: string
  ): Promise<MultimodalUploadResult> {
    const client = getOpenVikingClient();
    const mapper = getScopeMapper();
    
    const targetUri = mapper.buildTargetForType(scope, 'resources') + '/audio';
    const result = await client.uploadMultimodal(data, mimeType, targetUri);
    
    if (result.taskId) {
      const taskResult = await this.waitForTask(result.taskId);
return {
      uri: result.uri,
      description: (taskResult.result?.description as string) ?? '',
      taskId: result.taskId,
      mimeType,
      size: data.byteLength,
    };
    }
    
    return {
      uri: result.uri,
      description: '',
      mimeType,
      size: data.byteLength,
    };
  }
  
  /**
   * Generic upload - auto-detect type
   */
  async upload(
    data: ArrayBuffer,
    mimeType: string,
    scope: Scope,
    filename?: string
  ): Promise<MultimodalUploadResult> {
    const type = detectMultimodalType(mimeType);
    
    switch (type) {
      case 'image':
        return this.uploadImage(data, mimeType, scope, filename);
      case 'video':
        return this.uploadVideo(data, mimeType, scope, filename);
      case 'audio':
        return this.uploadAudio(data, mimeType, scope, filename);
      default:
        throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  }
  
  /**
   * Wait for async task completion
   */
  private async waitForTask(taskId: string, timeoutMs = 60000): Promise<{
    status: string;
    result?: Record<string, unknown>;
  }> {
    const client = getOpenVikingClient();
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const task = await client.getTask(taskId);
      
      if (task.status === 'completed') {
        return { status: 'completed', result: task.result };
      }
      
      if (task.status === 'failed') {
        throw new Error(`Task failed: ${task.error}`);
      }
      
      // Wait 1 second before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Task timeout: processing took too long');
  }
}

/**
 * Singleton uploader instance
 */
let uploaderInstance: MultimodalUploader | null = null;

/**
 * Get singleton multimodal uploader
 */
export function getMultimodalUploader(): MultimodalUploader {
  if (!uploaderInstance) {
    uploaderInstance = new MultimodalUploader();
  }
  return uploaderInstance;
}

/**
 * Reset uploader (for testing)
 */
export function resetMultimodalUploader(): void {
  uploaderInstance = null;
}