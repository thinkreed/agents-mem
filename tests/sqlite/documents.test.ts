/**
 * @file tests/sqlite/documents.test.ts
 * @description Documents table operations tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDocument,
  getDocumentById,
  getDocumentsByScope,
  updateDocument,
  deleteDocument,
  searchDocuments,
  DocumentRecord
} from '../../src/sqlite/documents';
import { createUser } from '../../src/sqlite/users';
import { getConnection, closeConnection, resetConnection, setDatabasePath } from '../../src/sqlite/connection';
import { runMigrations, resetManager } from '../../src/sqlite/migrations';

describe('Documents Table', () => {
  beforeEach(() => {
    resetConnection();
    resetManager();
    setDatabasePath(':memory:');
    runMigrations();
    createUser({ id: 'user-1', name: 'User' });
  });

  afterEach(() => {
    closeConnection();
    resetManager();
  });

  describe('createDocument', () => {
    it('should create document', () => {
      const doc = createDocument({
        id: 'doc-1',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'Test Document',
        content: 'This is the content'
      });
      
      expect(doc).toBeDefined();
      expect(doc.id).toBe('doc-1');
      expect(doc.doc_type).toBe('article');
      expect(doc.title).toBe('Test Document');
      expect(doc.content).toBe('This is the content');
    });

    it('should calculate content length', () => {
      const doc = createDocument({
        id: 'doc-2',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Length Doc',
        content: '1234567890'
      });
      
      expect(doc.content_length).toBe(10);
    });

    it('should create document with metadata', () => {
      const doc = createDocument({
        id: 'doc-3',
        user_id: 'user-1',
        doc_type: 'url',
        title: 'URL Doc',
        content: 'Content',
        source_url: 'https://example.com',
        metadata: '{"author": "test"}'
      });
      
      expect(doc.source_url).toBe('https://example.com');
      expect(doc.metadata).toBe('{"author": "test"}');
    });
  });

  describe('getDocumentById', () => {
    it('should get document by id', () => {
      createDocument({
        id: 'doc-4',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'Get Doc',
        content: 'Content'
      });
      
      const doc = getDocumentById('doc-4');
      
      expect(doc).toBeDefined();
      expect(doc?.title).toBe('Get Doc');
    });
  });

  describe('getDocumentsByScope', () => {
    it('should get documents by user scope', () => {
      createDocument({
        id: 'doc-5',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'Doc A',
        content: 'Content A'
      });
      
      const docs = getDocumentsByScope({ userId: 'user-1' });
      
      expect(docs.length).toBe(1);
    });

    it('should get documents by user with agent scope', () => {
      createDocument({
        id: 'doc-agent',
        user_id: 'user-1',
        agent_id: 'agent-1',
        doc_type: 'article',
        title: 'Agent Doc',
        content: 'Agent content'
      });
      
      createDocument({
        id: 'doc-no-agent',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'No Agent Doc',
        content: 'No agent content'
      });
      
      const docs = getDocumentsByScope({ userId: 'user-1', agentId: 'agent-1' });
      
      expect(docs.length).toBe(1);
      expect(docs[0].agent_id).toBe('agent-1');
    });

    it('should get documents by user with team scope', () => {
      createDocument({
        id: 'doc-team',
        user_id: 'user-1',
        team_id: 'team-1',
        doc_type: 'article',
        title: 'Team Doc',
        content: 'Team content'
      });
      
      createDocument({
        id: 'doc-no-team',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'No Team Doc',
        content: 'No team content'
      });
      
      const docs = getDocumentsByScope({ userId: 'user-1', teamId: 'team-1' });
      
      expect(docs.length).toBe(1);
      expect(docs[0].team_id).toBe('team-1');
    });
  });

  describe('updateDocument', () => {
    it('should update document content', () => {
      createDocument({
        id: 'doc-6',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'Original',
        content: 'Original content'
      });
      
      const updated = updateDocument('doc-6', {
        content: 'New content',
        title: 'Updated'
      });
      
      expect(updated?.content).toBe('New content');
      expect(updated?.title).toBe('Updated');
      expect(updated?.content_length).toBe(11);
    });
  });

  describe('deleteDocument', () => {
    it('should delete document', () => {
      createDocument({
        id: 'doc-7',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'Delete Doc',
        content: 'Content'
      });
      
      const result = deleteDocument('doc-7');
      
      expect(result).toBe(true);
    });
  });

  describe('searchDocuments', () => {
    it('should search by doc_type', () => {
      createDocument({
        id: 'doc-8',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'Article',
        content: 'Content'
      });
      createDocument({
        id: 'doc-9',
        user_id: 'user-1',
        doc_type: 'note',
        title: 'Note',
        content: 'Content'
      });
      
      const docs = searchDocuments({ doc_type: 'article' });
      
      expect(docs.length).toBe(1);
      expect(docs[0].doc_type).toBe('article');
    });

    it('should search by title_contains', () => {
      createDocument({
        id: 'doc-title-1',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'Introduction to TypeScript',
        content: 'Content'
      });
      createDocument({
        id: 'doc-title-2',
        user_id: 'user-1',
        doc_type: 'article',
        title: 'Python Guide',
        content: 'Content'
      });
      
      const docs = searchDocuments({ title_contains: 'TypeScript' });
      
      expect(docs.length).toBe(1);
      expect(docs[0].title).toContain('TypeScript');
    });
  });
});