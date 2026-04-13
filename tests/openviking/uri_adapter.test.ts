/**
 * @file tests/openviking/uri_adapter.test.ts
 * @description Tests for URI conversion between mem:// and viking://
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getURIAdapter, resetURIAdapter } from '../../src/openviking/uri_adapter';
import type { URIAdapter } from '../../src/openviking/uri_adapter';
import type { Scope } from '../../src/core/types';
import type { EntityType } from '../../src/core/types';

describe('URIAdapter', () => {
  let adapter: URIAdapter;

  beforeEach(() => {
    resetURIAdapter();
    adapter = getURIAdapter();
  });

  describe('toVikingURI', () => {
    it('should convert document URI', () => {
      const memUri = 'mem://user123/_/_/documents/doc-abc';
      const scope: Scope = { userId: 'user123' };
      const adapter = getURIAdapter();
      const vikingUri = adapter.toVikingURI(memUri, scope, 'default');
      
      expect(vikingUri).toContain('viking://');
      expect(vikingUri).toContain('default');
      expect(vikingUri).toContain('user123');
      expect(vikingUri).toContain('resources');
      expect(vikingUri).toContain('doc-abc');
    });

    it('should convert with agent scope', () => {
      const memUri = 'mem://user123/agent456/_/documents/doc-xyz';
      const scope: Scope = { userId: 'user123', agentId: 'agent456' };
      const adapter = getURIAdapter();
      const vikingUri = adapter.toVikingURI(memUri, scope, 'myaccount');
      
      expect(vikingUri).toContain('viking://myaccount');
      expect(vikingUri).toContain('agent456');
    });

    it('should convert fact URI to memories', () => {
      const memUri = 'mem://user123/_/_/facts/fact-001';
      const scope: Scope = { userId: 'user123' };
      const adapter = getURIAdapter();
      const vikingUri = adapter.toVikingURI(memUri, scope);
      
      expect(vikingUri).toContain('memories');
      expect(vikingUri).toContain('fact-001');
    });
  });

  describe('toMemURI', () => {
    it('should convert viking document URI back to mem', () => {
      const vikingUri = 'viking://default/user123/resources/documents/doc-abc';
      const scope: Scope = { userId: 'user123' };
      const memUri = adapter.toMemURI(vikingUri, scope);
      
      expect(memUri).toContain('mem://');
      expect(memUri).toContain('user123');
      expect(memUri).toContain('doc-abc');
    });
  });

  describe('extractIdFromVikingURI', () => {
    it('should extract ID from URI', () => {
      const vikingUri = 'viking://default/user123/resources/documents/my-doc-id';
      const id = adapter.extractIdFromVikingURI(vikingUri);
      
      expect(id).toBe('my-doc-id');
    });

    it('should extract ID from nested path', () => {
      const vikingUri = 'viking://account/user/resources/documents/subdir/doc-123';
      const id = adapter.extractIdFromVikingURI(vikingUri);
      
      expect(id).toBe('doc-123');
    });
  });

  describe('buildTargetUri', () => {
    it('should build target URI for document', () => {
      const scope: Scope = { userId: 'user123' };
      const adapter = getURIAdapter();
      const targetUri = adapter.buildTargetUri(scope, 'documents' as EntityType, 'account');
      
      expect(targetUri).toContain('viking://account');
      expect(targetUri).toContain('user123');
      expect(targetUri).toContain('resources');
    });

    it('should build target URI with agent', () => {
      const scope: Scope = { userId: 'user123', agentId: 'agent456' };
      const adapter = getURIAdapter();
      const targetUri = adapter.buildTargetUri(scope, 'facts' as EntityType);
      
      expect(targetUri).toContain('agent456');
      expect(targetUri).toContain('memories');
    });
  });

  describe('error handling', () => {
    it('should throw on invalid mem URI', () => {
      expect(() => {
        adapter.toVikingURI('invalid-uri', { userId: 'user' });
      }).toThrow('Invalid mem:// URI');
    });

    it('should throw on invalid viking URI', () => {
      expect(() => {
        adapter.toMemURI('invalid-uri', { userId: 'user' });
      }).toThrow('Invalid viking:// URI');
    });
  });
});