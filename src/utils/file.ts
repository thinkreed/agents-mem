/**
 * @file src/utils/file.ts
 * @description File system utilities for agents-mem
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Get home directory
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Get data directory (default: ~/.agents_mem/)
 */
export function getDataDir(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  return joinPath(getHomeDir(), '.agents_mem');
}

/**
 * Get vector directory (default: ~/.agents_mem/vectors/)
 */
export function getVectorDir(customDataDir?: string): string {
  const baseDir = getDataDir(customDataDir);
  return joinPath(baseDir, 'vectors');
}

/**
 * Get SQLite database path (default: ~/.agents_mem/agents_mem.db)
 */
export function getSQLitePath(customDataDir?: string): string {
  const baseDir = getDataDir(customDataDir);
  return joinPath(baseDir, 'agents_mem.db');
}

/**
 * Join multiple path segments
 */
export function joinPath(...segments: string[]): string {
  const nonEmpty = segments.filter(s => s.length > 0);
  return path.join(...nonEmpty);
}

/**
 * Resolve path to absolute
 */
export function resolvePath(relativePath: string, baseDir?: string): string {
  if (isAbsolutePath(relativePath)) {
    return relativePath;
  }
  const base = baseDir ?? process.cwd();
  return path.resolve(base, relativePath);
}

/**
 * Check if path is absolute
 */
export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

/**
 * Normalize path (handle separators, remove trailing slash)
 */
export function normalizePath(filePath: string): string {
  let normalized = path.normalize(filePath);
  // Remove trailing separator
  if (normalized.endsWith(path.sep) && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Ensure directory exists (create if needed)
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Check if file exists (async)
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Read file content (async)
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf-8');
}

/**
 * Write content to file (async)
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  // Ensure parent directory exists
  const dirPath = path.dirname(filePath);
  await fs.promises.mkdir(dirPath, { recursive: true });
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

/**
 * Delete file (async)
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Get file size (async)
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.promises.stat(filePath);
  return stats.size;
}

/**
 * MIME type mapping
 */
const MIME_TYPES: Record<string, string> = {
  // Text
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  
  // Application
  json: 'application/json',
  pdf: 'application/pdf',
  zip: 'application/zip',
  
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  
  // Documents
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/**
 * Get MIME type from file extension
 */
export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase().slice(1);
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}