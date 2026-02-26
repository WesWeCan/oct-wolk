import { type Ref } from 'vue';
import type { TimelineDocument, SceneDocumentBase } from '@/types/timeline_types';
import type { useFrameEvaluation } from './useFrameEvaluation';
import type { useSceneManagement } from './useSceneManagement';
import type { useRenderWorker } from './useRenderWorker';
import type { useTimelinePlayback } from './useTimelinePlayback';
import { hashWords } from '@/front-end/utils/hash/hashWords';
import { stableStringify } from '@/front-end/utils/hash/stableStringify';

export function buildFontFamilyChain(settings: TimelineDocument['settings']): string {
  const primary = String(settings.fontFamily || 'system-ui');
  const fallbacks = Array.isArray(settings.fontFallbacks)
    ? settings.fontFallbacks as string[]
    : [];
  const names = [primary, ...fallbacks].filter(Boolean);
  if (settings.fontLocalPath) names.unshift('ProjectFont');
  const quote = (s: string) => /[^a-zA-Z0-9-]/.test(s) ? '"' + s.replace(/"/g, '\\"') + '"' : s;
  return names.map(quote).join(', ');
}

export function computeConfigKeyForFrame(
  f: number,
  frameEval: ReturnType<typeof useFrameEvaluation>,
  sceneDocs: Record<string, SceneDocumentBase>,
  settings: TimelineDocument['settings'] | undefined,
): string {
  const mix = frameEval.getActiveScenesAtFrame(f);
  const pairKey = (mix.a?.id || 'none') + '|' + (mix.b?.id || '');

  const pool = frameEval.getWordPoolAtFrame(f);
  const wordsKey = 'pool:' + hashWords(pool);

  const aParams = mix.a && mix.a.id !== 'none' ? (sceneDocs[mix.a.id]?.params || {}) : {};
  const bParams = mix.b && mix.b.id !== 'none' ? (sceneDocs[mix.b.id]?.params || {}) : {};

  const exclude = new Set<string>(['words']);
  const aKey = stableStringify(aParams, exclude);
  const bKey = stableStringify(bParams, exclude);
  const paramsKey = `a:${aKey}|b:${bKey}`;

  const ffPrimary = String(settings?.fontFamily || '');
  const ffFallbacks = Array.isArray(settings?.fontFallbacks) ? (settings!.fontFallbacks as string[]).join('|') : '';
  const ffLocal = String(settings?.fontLocalPath || '');
  const fontKey = `font:${ffPrimary}|${ffFallbacks}|${ffLocal}`;

  return pairKey + '|' + wordsKey + '|' + paramsKey + '|' + fontKey;
}

export function useWorkerSceneConfig(
  timeline: Ref<TimelineDocument | null>,
  playback: ReturnType<typeof useTimelinePlayback>,
  frameEval: ReturnType<typeof useFrameEvaluation>,
  scenes: ReturnType<typeof useSceneManagement>,
  renderWorker: ReturnType<typeof useRenderWorker>,
) {
  let lastConfiguredKey = '';

  const getConfigKey = (frame: number): string => {
    return computeConfigKeyForFrame(
      frame,
      frameEval,
      scenes.sceneDocs.value,
      timeline.value?.settings,
    );
  };

  const configureWorkerScene = async () => {
    if (!timeline.value) return;

    const seed = String(timeline.value.settings.seed || 'seed');
    const fontFamilyChain = buildFontFamilyChain(timeline.value.settings);
    const style = String(timeline.value.settings.fontStyle || 'normal');
    const weight = timeline.value.settings.fontWeight ?? 400;

    const frame = playback.frame.value;
    const active = frameEval.getActiveScenesAtFrame(frame);

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

    const configKey = getConfigKey(frame);

    if (active.a.id === 'none' && !active.b) {
      lastConfiguredKey = configKey;
      return;
    }

    if (configKey === lastConfiguredKey) return;

    lastConfiguredKey = configKey;

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
  };

  const needsReconfigure = (frame: number): boolean => {
    return getConfigKey(frame) !== lastConfiguredKey;
  };

  const resetConfigKey = () => {
    lastConfiguredKey = '';
  };

  return {
    configureWorkerScene,
    getConfigKey,
    needsReconfigure,
    resetConfigKey,
    buildFontFamilyChain: () => timeline.value ? buildFontFamilyChain(timeline.value.settings) : '',
  };
}
