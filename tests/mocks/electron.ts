import { vi } from 'vitest';

export function createMockElectronAPI() {
  const projects = {
    create: vi.fn().mockResolvedValue({ id: 'test-id', title: 'Test' }),
    save: vi.fn().mockImplementation((project: any) => Promise.resolve(project)),
    load: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    exportWolk: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/test.wolk' }),
    importWolk: vi.fn().mockResolvedValue({ canceled: false, project: { id: 'imported-id', song: { title: 'Imported', audioSrc: '' } } }),
    importWolkBytes: vi.fn().mockResolvedValue({ id: 'imported-id', song: { title: 'Imported', audioSrc: '' } }),
    uploadCover: vi.fn().mockResolvedValue({}),
    uploadAudio: vi.fn().mockResolvedValue({}),
    uploadAsset: vi.fn().mockResolvedValue({ url: '', fileName: '' }),
    deleteAsset: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
  };

  return {
    setMenuContext: vi.fn().mockResolvedValue({ ok: true }),
    performNativeEditCommand: vi.fn().mockResolvedValue({ ok: true }),
    openStorageFolder: vi.fn().mockResolvedValue(undefined),
    openExternalUrl: vi.fn().mockResolvedValue({ success: true }),
    projects,
    fonts: {
      list: vi.fn().mockResolvedValue([]),
    },
    motionPresets: {
      list: vi.fn().mockResolvedValue([]),
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(true),
      exportOne: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/test.wolkdpreset', exportedCount: 1 }),
      importOne: vi.fn().mockResolvedValue({ canceled: false, imported: [] }),
      exportBundle: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/test.wolkpresets', exportedCount: 0 }),
      importBundle: vi.fn().mockResolvedValue({ canceled: false, imported: [] }),
    },
    export: {
      saveWebM: vi.fn().mockResolvedValue({ filePath: '/tmp/test.webm' }),
      ffmpegAvailable: vi.fn().mockResolvedValue(true),
      getFfmpegInstructions: vi.fn().mockResolvedValue({ platform: 'darwin', instructions: '' }),
      encodeMp4FromWebM: vi.fn().mockResolvedValue({ filePath: '/tmp/test.mp4' }),
      copyFontsForExport: vi.fn().mockResolvedValue({ copied: [] }),
      openFolder: vi.fn().mockResolvedValue({ success: true }),
      cleanupFrames: vi.fn().mockResolvedValue({ success: true }),
      createFrameExport: vi.fn().mockResolvedValue({ rootDir: '/tmp', framesDir: '/tmp/frames' }),
      saveFrame: vi.fn().mockResolvedValue({ success: true }),
      copyAudioForExport: vi.fn().mockResolvedValue({ success: true }),
      assembleVideo: vi.fn().mockResolvedValue({ success: true }),
      assembleAlphaVideo: vi.fn().mockResolvedValue({ success: true }),
    },
    onAppMenuAction: vi.fn(() => vi.fn()),
    onMenuCommand: vi.fn(() => vi.fn()),
    onProjectsImported: vi.fn(() => vi.fn()),
  };
}

export function installMockElectronAPI() {
  const mock = createMockElectronAPI();
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.electronAPI = mock;
  return mock;
}
