/**
 * @file tests/utils/file.test.ts
 * @description File utility tests (TDD)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  getDataDir,
  getVectorDir,
  getSQLitePath,
  ensureDir,
  joinPath,
  resolvePath,
  isAbsolutePath,
  getHomeDir,
  normalizePath,
  fileExists,
  readFile,
  writeFile,
  deleteFile,
  getFileSize,
  getMimeType
} from '../../src/utils/file';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('File utilities', () => {
  const testDir = path.join(os.tmpdir(), 'agents-mem-test');
  
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getHomeDir', () => {
    it('should return home directory', () => {
      const homeDir = getHomeDir();
      expect(homeDir).toBeDefined();
      expect(homeDir.length).toBeGreaterThan(0);
      expect(isAbsolutePath(homeDir)).toBe(true);
    });

    it('should match os.homedir()', () => {
      expect(getHomeDir()).toBe(os.homedir());
    });
  });

  describe('getDataDir', () => {
    it('should return default data directory', () => {
      const dataDir = getDataDir();
      expect(dataDir).toContain('.agents_mem');
      expect(isAbsolutePath(dataDir)).toBe(true);
    });

    it('should return custom data directory', () => {
      const customDir = getDataDir('/custom/path');
      expect(customDir).toBe('/custom/path');
    });
  });

  describe('getVectorDir', () => {
    it('should return vector directory path', () => {
      const vectorDir = getVectorDir();
      expect(vectorDir).toContain('.agents_mem');
      expect(vectorDir).toContain('vectors');
    });

it('should return custom vector directory', () => {
      const customDir = getVectorDir(path.join('custom', 'data'));
      expect(customDir).toContain('vectors');
    });

    it('should return custom SQLite path', () => {
      const customPath = getSQLitePath(path.join('custom', 'data'));
      expect(customPath).toContain('agents_mem.db');
    });
  });

  describe('getSQLitePath', () => {
    it('should return SQLite database path', () => {
      const sqlitePath = getSQLitePath();
      expect(sqlitePath).toContain('.agents_mem');
      expect(sqlitePath).toContain('agents_mem.db');
    });

    it('should return custom SQLite path', () => {
      const customPath = getSQLitePath(path.join('custom', 'data'));
      expect(customPath).toContain('agents_mem.db');
    });
  });

  describe('joinPath', () => {
    it('should join multiple path segments', () => {
      const result = joinPath('a', 'b', 'c');
      expect(result).toBe(path.join('a', 'b', 'c'));
    });

    it('should handle empty segments', () => {
      const result = joinPath('a', '', 'c');
      expect(result).toBe(path.join('a', 'c'));
    });
  });

  describe('resolvePath', () => {
    it('should resolve relative path to absolute', () => {
      const result = resolvePath('./relative/path');
      expect(isAbsolutePath(result)).toBe(true);
    });

    it('should resolve from base directory', () => {
      const baseDir = path.join(testDir, 'base');
      const result = resolvePath('relative', baseDir);
      expect(result).toContain('base');
      expect(result).toContain('relative');
    });

    it('should return absolute path unchanged', () => {
      const result = resolvePath('/absolute/path');
      expect(result).toBe('/absolute/path');
    });
  });

  describe('isAbsolutePath', () => {
    it('should return true for absolute path', () => {
      expect(isAbsolutePath('/absolute/path')).toBe(true);
      expect(isAbsolutePath('C:\\absolute\\path')).toBe(true);
    });

    it('should return false for relative path', () => {
      expect(isAbsolutePath('relative/path')).toBe(false);
      expect(isAbsolutePath('./relative')).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('should normalize path separators', () => {
      const result = normalizePath('a/b/../c');
      expect(result).toBe(path.normalize('a/b/../c'));
    });

    it('should handle trailing slashes', () => {
      const result = normalizePath('a/b/');
      expect(result.endsWith(path.sep)).toBe(false);
    });
  });

  describe('ensureDir', () => {
    it('should create directory if not exists', () => {
      const newDir = path.join(testDir, 'new-dir');
      
      expect(fs.existsSync(newDir)).toBe(false);
      ensureDir(newDir);
      expect(fs.existsSync(newDir)).toBe(true);
    });

    it('should not fail if directory exists', () => {
      ensureDir(testDir);
      expect(fs.existsSync(testDir)).toBe(true);
    });

    it('should create nested directories', () => {
      const nestedDir = path.join(testDir, 'nested', 'deep', 'dir');
      ensureDir(nestedDir);
      expect(fs.existsSync(nestedDir)).toBe(true);
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(testDir, 'test.txt');
      fs.writeFileSync(filePath, 'test content');
      
      const exists = await fileExists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      
      const exists = await fileExists(filePath);
      expect(exists).toBe(false);
    });

    it('should return false for directory', async () => {
      const exists = await fileExists(testDir);
      expect(exists).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      const filePath = path.join(testDir, 'read-test.txt');
      fs.writeFileSync(filePath, 'Hello World');
      
      const content = await readFile(filePath);
      expect(content).toBe('Hello World');
    });

    it('should read empty file', async () => {
      const filePath = path.join(testDir, 'empty.txt');
      fs.writeFileSync(filePath, '');
      
      const content = await readFile(filePath);
      expect(content).toBe('');
    });

    it('should throw for non-existing file', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      
      await expect(readFile(filePath)).rejects.toThrow();
    });
  });

  describe('writeFile', () => {
    it('should write content to file', async () => {
      const filePath = path.join(testDir, 'write-test.txt');
      
      await writeFile(filePath, 'Test content');
      
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toBe('Test content');
    });

    it('should overwrite existing file', async () => {
      const filePath = path.join(testDir, 'overwrite.txt');
      fs.writeFileSync(filePath, 'Old content');
      
      await writeFile(filePath, 'New content');
      
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toBe('New content');
    });

    it('should create directory if needed', async () => {
      const filePath = path.join(testDir, 'new-dir', 'file.txt');
      
      await writeFile(filePath, 'Content');
      
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      const filePath = path.join(testDir, 'delete-test.txt');
      fs.writeFileSync(filePath, 'test');
      
      await deleteFile(filePath);
      
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not throw for non-existing file', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      
      await deleteFile(filePath);
      
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('getFileSize', () => {
    it('should return file size', async () => {
      const filePath = path.join(testDir, 'size-test.txt');
      fs.writeFileSync(filePath, '1234567890'); // 10 bytes
      
      const size = await getFileSize(filePath);
      expect(size).toBe(10);
    });

    it('should return 0 for empty file', async () => {
      const filePath = path.join(testDir, 'empty-size.txt');
      fs.writeFileSync(filePath, '');
      
      const size = await getFileSize(filePath);
      expect(size).toBe(0);
    });

    it('should throw for non-existing file', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      
      await expect(getFileSize(filePath)).rejects.toThrow();
    });
  });

  describe('getMimeType', () => {
    it('should return mime type for common extensions', () => {
      expect(getMimeType('file.txt')).toBe('text/plain');
      expect(getMimeType('file.json')).toBe('application/json');
      expect(getMimeType('file.md')).toBe('text/markdown');
      expect(getMimeType('file.pdf')).toBe('application/pdf');
      expect(getMimeType('file.png')).toBe('image/png');
      expect(getMimeType('file.jpg')).toBe('image/jpeg');
      expect(getMimeType('file.jpeg')).toBe('image/jpeg');
    });

    it('should return default mime type for unknown extension', () => {
      expect(getMimeType('file.unknown')).toBe('application/octet-stream');
    });

    it('should handle files without extension', () => {
      expect(getMimeType('file')).toBe('application/octet-stream');
    });

    it('should handle uppercase extensions', () => {
      expect(getMimeType('file.TXT')).toBe('text/plain');
      expect(getMimeType('file.JSON')).toBe('application/json');
    });
  });
});