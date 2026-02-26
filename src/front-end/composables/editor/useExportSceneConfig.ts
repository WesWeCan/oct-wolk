import { type Ref } from 'vue';
import type { TimelineDocument } from '@/types/timeline_types';
import type { useFrameEvaluation } from './useFrameEvaluation';
import type { useSceneManagement } from './useSceneManagement';
import type { useRenderWorker } from './useRenderWorker';
import { buildFontFamilyChain } from './useWorkerSceneConfig';

export function useExportSceneConfig(
  timeline: Ref<TimelineDocument | null>,
  frameEval: ReturnType<typeof useFrameEvaluation>,
  scenes: ReturnType<typeof useSceneManagement>,
  renderWorker: ReturnType<typeof useRenderWorker>,
) {
  const configureSceneForExportFrame = async (frame: number): Promise<{ isEmpty: boolean }> => {
    if (!timeline.value) return { isEmpty: true };

    const active = frameEval.getActiveScenesAtFrame(frame);
    const isEmpty = active.a.id === 'none' && !active.b;

    if (isEmpty) return { isEmpty: true };

    const seed = String(timeline.value.settings.seed || 'seed');
    const fontFamilyChain = buildFontFamilyChain(timeline.value.settings);
    const style = String(timeline.value.settings.fontStyle || 'normal');
    const weight = timeline.value.settings.fontWeight ?? 400;

    if (active.a && active.a.id !== 'none') await scenes.ensureSceneDoc(active.a.id);
    if (active.b && active.b.id !== 'none') await scenes.ensureSceneDoc(active.b.id);

    const pool = frameEval.getWordPoolAtFrame(frame);
    const wordsA = (active.a && active.a.id !== 'none') ? pool : [];
    const wordsB = (active.b && active.b.id !== 'none') ? pool : [];

    const aParamsBase = active.a && active.a.id !== 'none' ? (scenes.sceneDocs.value[active.a.id]?.params || {}) : null;
    const bParamsBase = active.b && active.b.id !== 'none' ? (scenes.sceneDocs.value[active.b.id]?.params || {}) : null;

    const localPath = timeline.value.settings.fontLocalPath || null;
    const aParams = aParamsBase ? { ...aParamsBase, words: wordsA, fontFamilyChain, fontStyle: style, fontWeight: weight, fontLocalPath: localPath } : null;
    const bParams = bParamsBase ? { ...bParamsBase, words: wordsB, fontFamilyChain, fontStyle: style, fontWeight: weight, fontLocalPath: localPath } : null;

    renderWorker.configureScene({
      seed,
      fontFamilyChain,
      a: {
        sceneType: active.a.type,
        params: aParams || {}
      },
      b: bParams && active.b ? {
        sceneType: active.b.type,
        params: bParams
      } : null
    });

    return { isEmpty: false };
  };

  return {
    configureSceneForExportFrame,
  };
}
