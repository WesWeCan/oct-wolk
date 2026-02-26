import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { useExportSceneConfig } from '@/front-end/composables/editor/useExportSceneConfig';
import { createTestTimeline } from '../../utils/fixtures';

describe('useExportSceneConfig', () => {
  const mockFrameEval = {
    getActiveScenesAtFrame: vi.fn(),
    getWordPoolAtFrame: vi.fn().mockReturnValue(['hello']),
  } as any;

  const mockScenes = {
    sceneDocs: ref<Record<string, any>>({}),
    ensureSceneDoc: vi.fn(),
  } as any;

  const mockRenderWorker = {
    configureScene: vi.fn(),
  } as any;

  it('returns isEmpty true when no timeline', async () => {
    const timeline = ref(null);
    const config = useExportSceneConfig(timeline as any, mockFrameEval, mockScenes, mockRenderWorker);
    const result = await config.configureSceneForExportFrame(0);
    expect(result.isEmpty).toBe(true);
  });

  it('returns isEmpty true for frame with no active scene', async () => {
    mockFrameEval.getActiveScenesAtFrame.mockReturnValue({
      a: { id: 'none', type: 'wordcloud' },
      b: null,
      alphaA: 0,
      alphaB: 0,
    });
    const timeline = ref(createTestTimeline());
    const config = useExportSceneConfig(timeline as any, mockFrameEval, mockScenes, mockRenderWorker);
    const result = await config.configureSceneForExportFrame(0);
    expect(result.isEmpty).toBe(true);
    expect(mockRenderWorker.configureScene).not.toHaveBeenCalled();
  });

  it('configures worker and returns isEmpty false for active scene', async () => {
    mockFrameEval.getActiveScenesAtFrame.mockReturnValue({
      a: { id: 'scene-1', type: 'wordcloud' },
      b: null,
      alphaA: 1,
      alphaB: 0,
    });
    mockScenes.sceneDocs.value = { 'scene-1': { params: { color: 'blue' } } };

    const timeline = ref(createTestTimeline());
    const config = useExportSceneConfig(timeline as any, mockFrameEval, mockScenes, mockRenderWorker);

    mockRenderWorker.configureScene.mockClear();
    const result = await config.configureSceneForExportFrame(50);
    expect(result.isEmpty).toBe(false);
    expect(mockRenderWorker.configureScene).toHaveBeenCalledOnce();
  });
});
