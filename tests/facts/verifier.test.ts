/**
 * @file tests/facts/verifier.test.ts
 * @description Fact verifier tests using real SQLite
 * 
 * NOTE: We use real SQLite database instead of mocks to avoid cross-file mock pollution.
 * Each test uses isolated :memory: database with proper setup/teardown.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyFact, verifyFacts } from '../../src/facts/verifier';
import { resetConnection, closeConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';
import { createUser } from '../../src/sqlite/users';
import { createFact, getFactById } from '../../src/sqlite/facts';
import { createDocument, getDocumentById } from '../../src/sqlite/documents';
import { createMessage, getMessageById } from '../../src/sqlite/messages';
import { createConversation, getConversationById } from '../../src/sqlite/conversations';

describe('Fact Verifier', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'Test User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('verifyFact', () => {
    it('should return false for non-existent fact', async () => {
      const result = await verifyFact('non-existent-id');

      expect(result).toBe(false);
    });

    it('should return true and update existing fact', async () => {
      // Create source document first
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Test Document',
        content: 'This is a test fact content for verification.'
      });

      // Create a fact that matches the source
      createFact({
        id: 'fact-1',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Test fact content',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      const result = await verifyFact('fact-1');

      expect(result).toBe(true);

      // Verify fact was updated
      const fact = getFactById('fact-1');
      expect(fact?.verified).toBeTruthy(); // SQLite returns 1 for true
    });

    it('should call updateFact with verified true', async () => {
      // Create conversation first (required for message)
      createConversation({
        id: 'conv-base',
        user_id: 'user-1',
        agent_id: 'agent-1'
      });

      // Create source message
      createMessage({
        id: 'msg-1',
        conversation_id: 'conv-base',
        role: 'user',
        content: 'This is another fact that we can verify.'
      });

      // Create a fact that matches the message
      createFact({
        id: 'fact-2',
        user_id: 'user-1',
        source_type: 'messages',
        source_id: 'msg-1',
        content: 'Another fact',
        fact_type: 'preference',
        entities: '["user-2"]',
        importance: 0.7,
        confidence: 0.9,
        verified: false
      });

      await verifyFact('fact-2');

      // Verify fact was updated with verified true
      const fact = getFactById('fact-2');
      expect(fact?.verified).toBeTruthy();
    });
  });

  describe('verifyFacts', () => {
    it('should handle multiple IDs and return results', async () => {
      // Create source documents first
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Document A',
        content: 'This contains Fact A information.'
      });

      createDocument({
        id: 'doc-2',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Document B',
        content: 'This contains Fact B details.'
      });

      // Create two facts that match their sources
      createFact({
        id: 'fact-a',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Fact A',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      createFact({
        id: 'fact-b',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-2',
        content: 'Fact B',
        fact_type: 'decision',
        entities: '[]',
        importance: 0.6,
        confidence: 0.9,
        verified: false
      });

      const result = await verifyFacts(['fact-a', 'fact-b', 'fact-c']);

      expect(result).toEqual({
        'fact-a': true,
        'fact-b': true,
        'fact-c': false
      });

      // Verify facts were updated
      const factA = getFactById('fact-a');
      const factB = getFactById('fact-b');
      expect(factA?.verified).toBeTruthy();
      expect(factB?.verified).toBeTruthy();
    });

    it('should handle empty array', async () => {
      const result = await verifyFacts([]);

      expect(result).toEqual({});
    });

    it('should handle all non-existent facts', async () => {
      const result = await verifyFacts(['missing-1', 'missing-2']);

      expect(result).toEqual({
        'missing-1': false,
        'missing-2': false
      });
    });

    it('should handle mixed results', async () => {
      // Create source document
      createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Test Document',
        content: 'This is an existing fact in the document.'
      });

      // Create one existing fact that matches
      createFact({
        id: 'existing',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-1',
        content: 'Existing fact',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      const result = await verifyFacts(['missing', 'existing']);

      expect(result).toEqual({
        'missing': false,
        'existing': true
      });

      // Verify existing fact was updated
      const fact = getFactById('existing');
      expect(fact?.verified).toBeTruthy();
    });
  });

  describe('verifyFact with source cross-check', () => {
    it('should verify fact when content matches source document', async () => {
      // Create source document
      createDocument({
        id: 'doc-match',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Test Document',
        content: 'The user prefers dark mode for all applications.'
      });

      // Create fact that matches source content
      createFact({
        id: 'fact-match',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-match',
        content: 'User prefers dark mode',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.7,
        confidence: 0.6, // initial confidence
        verified: false
      });

      const result = await verifyFact('fact-match');

      // Should be verified since content matches
      expect(result).toBe(true);

      // Check fact was updated (SQLite returns 1 for true)
      const fact = getFactById('fact-match');
      expect(fact?.verified).toBe(1);
      expect(fact?.confidence).toBe(0.9); // confidence recalculated
    });

    it('should mark fact as unverified when content does not match source', async () => {
      // Create source document
      createDocument({
        id: 'doc-nomatch',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Test Document',
        content: 'The user prefers light mode for reading.'
      });

      // Create fact with content NOT in source
      createFact({
        id: 'fact-nomatch',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-nomatch',
        content: 'User prefers dark mode',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.7,
        confidence: 0.8,
        verified: false
      });

      const result = await verifyFact('fact-nomatch');

      // Should NOT be verified since content doesn't match
      expect(result).toBe(false);

      // Check fact was updated (SQLite returns 0 for false)
      const fact = getFactById('fact-nomatch');
      expect(fact?.verified).toBe(0);
      expect(fact?.confidence).toBe(0.4); // confidence lowered
    });

    it('should set low confidence when source document is missing', async () => {
      // Create fact referencing non-existent document
      createFact({
        id: 'fact-missing-doc',
        user_id: 'user-1',
        source_type: 'documents',
        source_id: 'doc-nonexistent',
        content: 'Some claim',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.8,
        verified: false
      });

      const result = await verifyFact('fact-missing-doc');

      // Cannot verify when source is missing
      expect(result).toBe(false);

      // Check fact was updated with low confidence (SQLite returns 0 for false)
      const fact = getFactById('fact-missing-doc');
      expect(fact?.verified).toBe(0);
      expect(fact?.confidence).toBe(0.3); // lowest confidence for missing source
    });

    it('should cross-check fact with source message', async () => {
      // Create conversation first
      createConversation({
        id: 'conv-1',
        user_id: 'user-1',
        agent_id: 'agent-1'
      });

      // Create source message
      createMessage({
        id: 'msg-match',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'I prefer using TypeScript for all new projects.'
      });

      // Create fact from message - content must be contained in message
      createFact({
        id: 'fact-msg-match',
        user_id: 'user-1',
        source_type: 'messages',
        source_id: 'msg-match',
        content: 'prefer using TypeScript',
        fact_type: 'preference',
        entities: '[]',
        importance: 0.8,
        confidence: 0.5,
        verified: false
      });

      const result = await verifyFact('fact-msg-match');

      expect(result).toBe(true);

      // SQLite returns 1 for true
      const fact = getFactById('fact-msg-match');
      expect(fact?.verified).toBe(1);
      expect(fact?.confidence).toBe(0.9);
    });

    it('should cross-check fact with source conversation', async () => {
      // Create source conversation
      createConversation({
        id: 'conv-verify',
        user_id: 'user-1',
        agent_id: 'agent-1',
        title: 'Discussion about architecture'
      });

      // Create fact from conversation
      createFact({
        id: 'fact-conv',
        user_id: 'user-1',
        source_type: 'conversations',
        source_id: 'conv-verify',
        content: 'Discussion about architecture',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.6,
        confidence: 0.5,
        verified: false
      });

      const result = await verifyFact('fact-conv');

      // Note: Conversation title is matched against fact content
      expect(result).toBe(true);

      // SQLite returns 1 for true
      const fact = getFactById('fact-conv');
      expect(fact?.verified).toBe(1);
      expect(fact?.confidence).toBe(0.9);
    });

    it('should handle missing source message', async () => {
      createFact({
        id: 'fact-missing-msg',
        user_id: 'user-1',
        source_type: 'messages',
        source_id: 'msg-nonexistent',
        content: 'Some claim from message',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.7,
        verified: false
      });

      const result = await verifyFact('fact-missing-msg');

      expect(result).toBe(false);

      // SQLite returns 0 for false
      const fact = getFactById('fact-missing-msg');
      expect(fact?.verified).toBe(0);
      expect(fact?.confidence).toBe(0.3);
    });

    it('should handle missing source conversation', async () => {
      createFact({
        id: 'fact-missing-conv',
        user_id: 'user-1',
        source_type: 'conversations',
        source_id: 'conv-nonexistent',
        content: 'Some claim from conversation',
        fact_type: 'observation',
        entities: '[]',
        importance: 0.5,
        confidence: 0.7,
        verified: false
      });

      const result = await verifyFact('fact-missing-conv');

      expect(result).toBe(false);

      // SQLite returns 0 for false
      const fact = getFactById('fact-missing-conv');
      expect(fact?.verified).toBe(0);
      expect(fact?.confidence).toBe(0.3);
    });
  });
});