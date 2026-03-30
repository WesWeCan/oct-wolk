import { describe, it, expect, vi } from 'vitest';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => name === 'documents' ? '/tmp/test-wolk-documents' : '/tmp/test-wolk-userData'),
  },
  shell: { openPath: vi.fn() },
}));

import { isPathInsideRoot, sanitizeFileName } from '@/back-end/internal-processes/internal-storage';
import { DOCUMENT_STORAGE_FOLDER } from '@/types/storage_types';

describe('isPathInsideRoot', () => {
  const root = '/tmp/WOLK/songs';

  it('returns true for path directly inside root', () => {
    expect(isPathInsideRoot('/tmp/WOLK/songs/abc/audio.mp3', root)).toBe(true);
  });

  it('returns true for root itself', () => {
    expect(isPathInsideRoot(root, root)).toBe(true);
  });

  it('returns false for path outside root', () => {
    expect(isPathInsideRoot('/etc/passwd', root)).toBe(false);
  });

  it('returns false for traversal attack', () => {
    expect(isPathInsideRoot('/tmp/WOLK/songs/../../etc/passwd', root)).toBe(false);
  });

  it('returns false for sibling directory', () => {
    expect(isPathInsideRoot('/tmp/WOLK/exports/file.txt', root)).toBe(false);
  });
});

describe('sanitizeFileName', () => {
  it('rejects path traversal with ..', () => {
    expect(() => sanitizeFileName('../../etc/passwd', DOCUMENT_STORAGE_FOLDER.SONGS)).toThrow();
  });

  it('rejects absolute paths', () => {
    expect(() => sanitizeFileName('/etc/passwd', DOCUMENT_STORAGE_FOLDER.SONGS)).toThrow();
  });

  it('rejects hidden files', () => {
    expect(() => sanitizeFileName('.hidden', DOCUMENT_STORAGE_FOLDER.SONGS)).toThrow();
  });

  it('accepts normal filenames', () => {
    const result = sanitizeFileName('audio.mp3', DOCUMENT_STORAGE_FOLDER.SONGS);
    expect(result).toBe('audio.mp3');
  });
});
