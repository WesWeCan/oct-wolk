import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';

const documentsRoot = '/tmp/test-wolk-presets-documents';
const userDataRoot = '/tmp/test-wolk-presets-userData';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => name === 'documents' ? documentsRoot : userDataRoot),
    getVersion: vi.fn(() => '3.0.0'),
  },
  shell: { openPath: vi.fn() },
}));

import {
  exportMotionPresetArchive,
  exportMotionPresetBundleArchive,
  importMotionPresetArchiveFromPath,
} from '@/back-end/internal-processes/motion-preset-archive';
import {
  listAllMotionPresetDocuments,
  listMotionPresets,
  saveMotionPreset,
} from '@/back-end/internal-processes/motion-preset-storage';

describe('motion preset archive import/export', () => {
  beforeEach(() => {
    fs.rmSync(documentsRoot, { recursive: true, force: true });
    fs.rmSync(userDataRoot, { recursive: true, force: true });
    fs.rmSync('/tmp/test-wolk-preset-archives', { recursive: true, force: true });
  });

  it('imports a single preset archive and generates a new id on collision', async () => {
    const saved = saveMotionPreset({
      blockType: 'subtitle',
      version: 1,
      name: 'Hero Subtitle',
      payload: { startMs: 0, endMs: 1000 },
    });

    const archivePath = '/tmp/test-wolk-preset-archives/hero.wolkdpreset';
    fs.mkdirSync('/tmp/test-wolk-preset-archives', { recursive: true });
    await exportMotionPresetArchive('subtitle', saved.id, archivePath);

    const imported = await importMotionPresetArchiveFromPath(archivePath);

    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe('Hero Subtitle');
    expect(imported[0].id).not.toBe(saved.id);
    expect(listMotionPresets('subtitle')).toHaveLength(2);
  });

  it('exports and imports a preset bundle across block types', async () => {
    saveMotionPreset({
      blockType: 'subtitle',
      version: 1,
      name: 'Subtitle One',
      payload: { startMs: 0, endMs: 1000 },
    });
    saveMotionPreset({
      blockType: 'cloud',
      version: 1,
      name: 'Cloud One',
      payload: { startMs: 50, endMs: 1500, params: { layout: 'spiral' } },
    });

    const archivePath = '/tmp/test-wolk-preset-archives/all.wolkpresets';
    fs.mkdirSync('/tmp/test-wolk-preset-archives', { recursive: true });
    const exportedCount = await exportMotionPresetBundleArchive(archivePath);

    expect(exportedCount).toBe(2);

    const imported = await importMotionPresetArchiveFromPath(archivePath);

    expect(imported).toHaveLength(2);
    expect(listAllMotionPresetDocuments()).toHaveLength(4);
    expect(imported.map((preset) => preset.blockType).sort()).toEqual(['cloud', 'subtitle']);
  });
});
