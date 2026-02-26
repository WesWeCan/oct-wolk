import { describe, it, expect } from 'vitest';

/**
 * Contract test: Ensure every electronAPI method exposed in preload
 * has a corresponding ipcMain.handle in internal-processes.
 *
 * This test parses the source files to verify the contract.
 */
import fs from 'fs';
import path from 'path';

const readSource = (relPath: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../src', relPath), 'utf-8');

describe('Preload ↔ IPC handler contract', () => {
  const preloadSrc = readSource('preload.ts');
  const ipcSrc = readSource('back-end/internal-processes/internal-processes.ts');

  const invokeChannelRegex = /ipcRenderer\.invoke\(['"]([^'"]+)['"]/g;
  const handleChannelRegex = /ipcMain\.handle\(['"]([^'"]+)['"]/g;

  const preloadChannels = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = invokeChannelRegex.exec(preloadSrc)) !== null) {
    preloadChannels.add(match[1]);
  }

  const handlerChannels = new Set<string>();
  while ((match = handleChannelRegex.exec(ipcSrc)) !== null) {
    handlerChannels.add(match[1]);
  }

  it('finds at least 10 preload channels', () => {
    expect(preloadChannels.size).toBeGreaterThanOrEqual(10);
  });

  it('finds at least 10 handler channels', () => {
    expect(handlerChannels.size).toBeGreaterThanOrEqual(10);
  });

  for (const channel of preloadChannels) {
    it(`preload channel "${channel}" has a matching ipcMain.handle`, () => {
      expect(handlerChannels.has(channel)).toBe(true);
    });
  }

  it('no orphan handlers without preload exposure (informational)', () => {
    const orphans = [...handlerChannels].filter(ch => !preloadChannels.has(ch));
    // This is informational — orphans are not necessarily bugs (e.g., internal-only handlers)
    // but they're worth knowing about.
    if (orphans.length > 0) {
      console.log('Orphan IPC handlers (no preload exposure):', orphans);
    }
    expect(true).toBe(true);
  });
});
