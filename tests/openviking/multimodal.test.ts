/**
 * @file tests/openviking/multimodal.test.ts
 * @description Tests for multimodal upload support
 */

import { describe, it, expect } from 'vitest';
import {
  detectMultimodalType,
  SUPPORTED_MIME_TYPES,
  type MultimodalType,
} from '../../src/openviking/multimodal';

describe('Multimodal', () => {
  describe('detectMultimodalType', () => {
    describe('image types', () => {
      it('should detect jpeg', () => {
        expect(detectMultimodalType('image/jpeg')).toBe('image');
      });

      it('should detect png', () => {
        expect(detectMultimodalType('image/png')).toBe('image');
      });

      it('should detect gif', () => {
        expect(detectMultimodalType('image/gif')).toBe('image');
      });

      it('should detect webp', () => {
        expect(detectMultimodalType('image/webp')).toBe('image');
      });
    });

    describe('video types', () => {
      it('should detect mp4', () => {
        expect(detectMultimodalType('video/mp4')).toBe('video');
      });

      it('should detect webm', () => {
        expect(detectMultimodalType('video/webm')).toBe('video');
      });
    });

    describe('audio types', () => {
      it('should detect mp3', () => {
        expect(detectMultimodalType('audio/mp3')).toBe('audio');
      });

      it('should detect wav', () => {
        expect(detectMultimodalType('audio/wav')).toBe('audio');
      });

      it('should detect flac', () => {
        expect(detectMultimodalType('audio/flac')).toBe('audio');
      });
    });

    describe('unsupported types', () => {
      it('should return null for text', () => {
        expect(detectMultimodalType('text/plain')).toBeNull();
      });

      it('should return null for application', () => {
        expect(detectMultimodalType('application/pdf')).toBeNull();
      });

      it('should return null for unknown', () => {
        expect(detectMultimodalType('unknown/type')).toBeNull();
      });
    });
  });

  describe('SUPPORTED_MIME_TYPES', () => {
    it('should have image types', () => {
      expect(SUPPORTED_MIME_TYPES.image).toContain('image/jpeg');
      expect(SUPPORTED_MIME_TYPES.image).toContain('image/png');
    });

    it('should have video types', () => {
      expect(SUPPORTED_MIME_TYPES.video).toContain('video/mp4');
    });

    it('should have audio types', () => {
      expect(SUPPORTED_MIME_TYPES.audio).toContain('audio/mp3');
      expect(SUPPORTED_MIME_TYPES.audio).toContain('audio/wav');
    });
  });
});