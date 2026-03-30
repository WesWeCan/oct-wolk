import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const documentsRoot = '/tmp/test-wolk-storage-documents';
const userDataRoot = '/tmp/test-wolk-storage-userData';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => name === 'documents' ? documentsRoot : userDataRoot),
  },
  shell: { openPath: vi.fn() },
}));

import { getInternalStoragePath, initStorage } from '@/back-end/internal-processes/internal-storage';

describe('internal storage migration', () => {
  beforeEach(() => {
    fs.rmSync(documentsRoot, { recursive: true, force: true });
    fs.rmSync(userDataRoot, { recursive: true, force: true });
  });

  it('moves the current userData storage into Documents/WOLK and flattens docStorage', async () => {
    const currentStorageRoot = path.join(userDataRoot, 'wolk');
    fs.mkdirSync(path.join(currentStorageRoot, 'docStorage', 'songs', 'project-1'), { recursive: true });
    fs.mkdirSync(path.join(currentStorageRoot, 'docStorage', 'exports'), { recursive: true });
    fs.mkdirSync(path.join(currentStorageRoot, 'docStorage', 'presets', 'subtitle'), { recursive: true });
    fs.writeFileSync(path.join(currentStorageRoot, 'docStorage', 'songs', 'project-1', 'audio.mp3'), 'audio');
    fs.writeFileSync(path.join(currentStorageRoot, 'docStorage', 'exports', 'render.mp4'), 'video');
    fs.writeFileSync(path.join(currentStorageRoot, 'docStorage', 'presets', 'subtitle', 'hero.json'), '{}');
    fs.writeFileSync(path.join(currentStorageRoot, 'settings.json'), '{}');

    await initStorage();

    const documentsStorageRoot = getInternalStoragePath();
    expect(documentsStorageRoot).toBe(path.join(documentsRoot, 'WOLK'));
    expect(fs.existsSync(path.join(documentsStorageRoot, 'songs', 'project-1', 'audio.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(documentsStorageRoot, 'exports', 'render.mp4'))).toBe(true);
    expect(fs.existsSync(path.join(documentsStorageRoot, 'presets', 'subtitle', 'hero.json'))).toBe(true);
    expect(fs.existsSync(path.join(documentsStorageRoot, 'settings.json'))).toBe(true);
    expect(fs.existsSync(currentStorageRoot)).toBe(false);
  });

  it('moves the legacy Documents storage when no userData storage exists', async () => {
    const legacyStorageRoot = path.join(documentsRoot, '__oct_files', 'wolk');
    fs.mkdirSync(path.join(legacyStorageRoot, 'docStorage', 'songs', 'project-2'), { recursive: true });
    fs.writeFileSync(path.join(legacyStorageRoot, 'docStorage', 'songs', 'project-2', 'audio.mp3'), 'audio');

    await initStorage();

    const documentsStorageRoot = getInternalStoragePath();
    expect(fs.existsSync(path.join(documentsStorageRoot, 'songs', 'project-2', 'audio.mp3'))).toBe(true);
    expect(fs.existsSync(legacyStorageRoot)).toBe(false);
  });
});
