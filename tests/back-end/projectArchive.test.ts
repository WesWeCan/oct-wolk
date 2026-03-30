import { beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const documentsRoot = '/tmp/test-wolk-project-documents';
const userDataRoot = '/tmp/test-wolk-project-userData';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => name === 'documents' ? documentsRoot : userDataRoot),
    getVersion: vi.fn(() => '3.0.0'),
  },
  shell: { openPath: vi.fn() },
}));

import { exportProjectArchive, importProjectArchiveFromPath } from '@/back-end/internal-processes/project-archive';
import { createProject, getProjectDir, loadProject, saveProject, saveProjectAsset, saveProjectAudio } from '@/back-end/internal-processes/project-storage';

const createMaliciousArchive = async (archivePath: string): Promise<void> => {
  const script = [
    'import sys, zipfile',
    'archive_path = sys.argv[1]',
    "with zipfile.ZipFile(archive_path, 'w') as zf:",
    "    zf.writestr('../escape.txt', 'boom')",
  ].join('\n');
  const result = spawnSync('python3', ['-c', script, archivePath], { stdio: 'pipe', encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to create malicious archive');
  }
};

describe('project archive import/export', () => {
  beforeEach(() => {
    fs.rmSync(documentsRoot, { recursive: true, force: true });
    fs.rmSync(userDataRoot, { recursive: true, force: true });
    fs.rmSync('/tmp/test-wolk-project-archives', { recursive: true, force: true });
  });

  it('exports and re-imports a project archive while remapping wolk asset urls', async () => {
    const created = createProject({ title: 'Archive Roundtrip' });
    const updatedWithAudio = saveProjectAudio(created.id, Buffer.from('audio-data') as unknown as ArrayBuffer, 'track.mp3');
    const uploadedAsset = saveProjectAsset(created.id, Buffer.from('image-data') as unknown as ArrayBuffer, 'background.png');
    const fontsDir = path.join(getProjectDir(created.id), 'fonts');
    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'custom.ttf'), Buffer.from('font-data'));

    const saved = saveProject({
      ...updatedWithAudio,
      backgroundImage: uploadedAsset.url,
      font: {
        ...updatedWithAudio.font,
        localPath: `wolk://${created.id}/fonts/custom.ttf`,
      },
    });

    const archivePath = '/tmp/test-wolk-project-archives/exported-project.wolk';
    await exportProjectArchive(saved.id, archivePath);

    const imported = await importProjectArchiveFromPath(archivePath);

    expect(imported.id).not.toBe(saved.id);
    expect(imported.song.title).toBe('Archive Roundtrip');
    expect(imported.song.audioSrc).toBe(`wolk://${imported.id}/audio.mp3`);
    expect(imported.backgroundImage).toBe(`wolk://${imported.id}/assets/background.png`);
    expect(imported.font.localPath).toBe(`wolk://${imported.id}/fonts/custom.ttf`);
    expect(fs.existsSync(path.join(getProjectDir(imported.id), 'audio.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(getProjectDir(imported.id), 'assets', 'background.png'))).toBe(true);
    expect(fs.existsSync(path.join(getProjectDir(imported.id), 'fonts', 'custom.ttf'))).toBe(true);
    expect(loadProject(imported.id)?.song.audioSrc).toBe(`wolk://${imported.id}/audio.mp3`);
  });

  it('rejects archives with zip-slip entries', async () => {
    const archivePath = '/tmp/test-wolk-project-archives/malicious-project.wolk';
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    await createMaliciousArchive(archivePath);

    await expect(importProjectArchiveFromPath(archivePath)).rejects.toThrow(/relative path|Unsafe archive entry path/);
  });
});
