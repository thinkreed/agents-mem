/**
 * @file src/sqlite/documents.ts
 * @description Documents table CRUD operations
 */

import { getConnection } from './connection';
import { generateUUID } from '../utils/uuid';
import { Scope } from '../core/types';

/**
 * Document record type
 */
export interface DocumentRecord {
  id: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global: boolean;
  doc_type: string;
  source_url?: string;
  source_path?: string;
  title: string;
  content: string;
  metadata?: string;
  lance_id?: string;
  created_at: number;
  updated_at: number;
  content_length: number;
  token_count?: number;
}

/**
 * Document creation input
 */
export interface DocumentInput {
  id?: string;
  user_id: string;
  agent_id?: string;
  team_id?: string;
  is_global?: boolean;
  doc_type: string;
  source_url?: string;
  source_path?: string;
  title: string;
  content: string;
  metadata?: string;
  lance_id?: string;
  token_count?: number;
}

/**
 * Document update input
 */
export interface DocumentUpdate {
  title?: string;
  content?: string;
  metadata?: string;
  lance_id?: string;
  token_count?: number;
}

/**
 * Document search filter
 */
export interface DocumentSearchFilter {
  doc_type?: string;
  title_contains?: string;
}

/**
 * Create document
 */
export function createDocument(input: DocumentInput): DocumentRecord {
  const db = getConnection();
  const id = input.id ?? generateUUID();
  const now = Math.floor(Date.now() / 1000);
  const contentLength = input.content.length;
  const isGlobal = input.is_global ?? false;
  
  db.run(
    `INSERT INTO documents (
      id, user_id, agent_id, team_id, is_global, doc_type, source_url, source_path,
      title, content, metadata, lance_id, created_at, updated_at, content_length, token_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.user_id, input.agent_id ?? null, input.team_id ?? null,
      isGlobal, input.doc_type, input.source_url ?? null, input.source_path ?? null,
      input.title, input.content, input.metadata ?? null, input.lance_id ?? null,
      now, now, contentLength, input.token_count ?? null
    ]
  );
  
  return {
    id,
    user_id: input.user_id,
    agent_id: input.agent_id,
    team_id: input.team_id,
    is_global: isGlobal,
    doc_type: input.doc_type,
    source_url: input.source_url,
    source_path: input.source_path,
    title: input.title,
    content: input.content,
    metadata: input.metadata,
    lance_id: input.lance_id,
    created_at: now,
    updated_at: now,
    content_length: contentLength,
    token_count: input.token_count
  };
}

/**
 * Get document by ID
 */
export function getDocumentById(id: string): DocumentRecord | undefined {
  const db = getConnection();
  
  return db.queryOne<DocumentRecord>(
    'SELECT * FROM documents WHERE id = ?',
    [id]
  );
}

/**
 * Get documents by scope
 */
export function getDocumentsByScope(scope: Scope): DocumentRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM documents WHERE user_id = ?';
  const params: string[] = [scope.userId];
  
  if (scope.agentId) {
    sql += ' AND agent_id = ?';
    params.push(scope.agentId);
  }
  
  if (scope.teamId) {
    sql += ' AND team_id = ?';
    params.push(scope.teamId);
  }
  
  return db.query<DocumentRecord>(sql, params);
}

/**
 * Update document
 */
export function updateDocument(id: string, update: DocumentUpdate): DocumentRecord | undefined {
  const db = getConnection();
  const existing = getDocumentById(id);
  
  if (!existing) return undefined;
  
  const now = Math.floor(Date.now() / 1000);
  const content = update.content ?? existing.content;
  const contentLength = content.length;
  
  db.run(
    `UPDATE documents SET
      title = ?, content = ?, metadata = ?, lance_id = ?, token_count = ?,
      content_length = ?, updated_at = ?
    WHERE id = ?`,
    [
      update.title ?? existing.title,
      content,
      update.metadata ?? existing.metadata,
      update.lance_id ?? existing.lance_id,
      update.token_count ?? existing.token_count,
      contentLength, now, id
    ]
  );
  
  return getDocumentById(id);
}

/**
 * Delete document
 */
export function deleteDocument(id: string): boolean {
  const db = getConnection();
  
  const result = db.run('DELETE FROM documents WHERE id = ?', [id]);
  
  return result.changes > 0;
}

/**
 * Search documents
 */
export function searchDocuments(filter: DocumentSearchFilter): DocumentRecord[] {
  const db = getConnection();
  
  let sql = 'SELECT * FROM documents WHERE 1=1';
  const params: unknown[] = [];
  
  if (filter.doc_type) {
    sql += ' AND doc_type = ?';
    params.push(filter.doc_type);
  }
  
  if (filter.title_contains) {
    sql += ' AND title LIKE ?';
    params.push(`%${filter.title_contains}%`);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  return db.query<DocumentRecord>(sql, params);
}