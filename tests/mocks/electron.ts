import { vi } from 'vitest';

export function createMockElectronAPI() {
  const projects = {
    create: vi.fn().mockResolvedValue({ id: 'test-id', title: 'Test' }),
    save: vi.fn().mockImplementation((project: any) => Promise.resolve(project)),
    load: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    uploadCover: vi.fn().mockResolvedValue({}),
    uploadAudio: vi.fn().mockResolvedValue({}),
    uploadAsset: vi.fn().mockResolvedValue({ url: '', fileName: '' }),
    deleteAsset: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
  };

  return {
    getRandomNumber: vi.fn().mockResolvedValue(42),
    openStorageFolder: vi.fn().mockResolvedValue(undefined),
    projects,
    songs: projects,
    timeline: {
      createOrLoad: vi.fn().mockResolvedValue({ settings: { fps: 60, renderWidth: 1920, renderHeight: 1080, seed: 'test' }, scenes: [] }),
      save: vi.fn().mockImplementation((_id: string, tl: any) => Promise.resolve(tl)),
      listScenes: vi.fn().mockResolvedValue([]),
      saveScene: vi.fn().mockImplementation((_id: string, s: any) => Promise.resolve(s)),
      loadScene: vi.fn().mockResolvedValue(null),
      reset: vi.fn().mockResolvedValue({ ok: true, doc: { settings: {}, scenes: [] } }),
    },
    analysis: {
      loadCache: vi.fn().mockResolvedValue(null),
      saveCache: vi.fn().mockResolvedValue({ ok: true }),
    },
    fonts: {
      list: vi.fn().mockResolvedValue([]),
    },
    export: {
      saveWebM: vi.fn().mockResolvedValue({ filePath: '/tmp/test.webm' }),
      ffmpegAvailable: vi.fn().mockResolvedValue(true),
      getFfmpegInstructions: vi.fn().mockResolvedValue({ platform: 'darwin', instructions: '' }),
      encodeMp4FromWebM: vi.fn().mockResolvedValue({ filePath: '/tmp/test.mp4' }),
      copyFontsForExport: vi.fn().mockResolvedValue({ copied: [] }),
      packageWolk: vi.fn().mockResolvedValue({ filePath: '/tmp/test.wolk' }),
      importWolk: vi.fn().mockResolvedValue({ songId: 'imported-id' }),
      importWolkBytes: vi.fn().mockResolvedValue({ songId: 'imported-id' }),
      openFolder: vi.fn().mockResolvedValue({ success: true }),
      cleanupFrames: vi.fn().mockResolvedValue({ success: true }),
      createFrameExport: vi.fn().mockResolvedValue({ rootDir: '/tmp', framesDir: '/tmp/frames' }),
      saveFrame: vi.fn().mockResolvedValue({ success: true }),
      copyAudioForExport: vi.fn().mockResolvedValue({ success: true }),
      assembleVideo: vi.fn().mockResolvedValue({ success: true }),
    },
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

export function installMockElectronAPI() {
  const mock = createMockElectronAPI();
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.electronAPI = mock;
  return mock;
}
