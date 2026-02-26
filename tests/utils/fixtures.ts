import type { TimelineDocument, SceneRef, SceneDocumentBase, ProjectSettings } from '@/types/timeline_types';
import type { AnalysisCache } from '@/types/analysis_types';

export function createTestSettings(overrides: Partial<ProjectSettings> = {}): ProjectSettings {
  return {
    version: 1,
    fps: 60,
    renderWidth: 1920,
    renderHeight: 1080,
    seed: 'test-seed',
    fontFamily: 'system-ui',
    fontFallbacks: ['sans-serif'],
    fontStyle: 'normal',
    fontWeight: 400,
    ...overrides,
  };
}

export function createTestSceneRef(overrides: Partial<SceneRef> = {}): SceneRef {
  return {
    id: 'scene-1',
    type: 'wordcloud',
    name: 'Test Scene',
    startFrame: 0,
    durationFrames: 300,
    ...overrides,
  };
}

export function createTestTimeline(overrides: Partial<TimelineDocument> = {}): TimelineDocument {
  return {
    settings: createTestSettings(),
    scenes: [],
    ...overrides,
  };
}

export function createTestSceneDoc(overrides: Partial<SceneDocumentBase> = {}): SceneDocumentBase {
  return {
    id: 'scene-1',
    type: 'wordcloud',
    name: 'Test Scene',
    seed: 'test-seed',
    params: {},
    tracks: [],
    ...overrides,
  };
}

export function createTestAnalysisCache(overrides: Partial<AnalysisCache> = {}): AnalysisCache {
  const fps = overrides.fps ?? 60;
  const durationSec = overrides.durationSec ?? 5;
  const totalFrames = overrides.totalFrames ?? Math.floor(durationSec * fps);

  return {
    fps,
    durationSec,
    totalFrames,
    energyPerFrame: overrides.energyPerFrame ?? new Array(totalFrames).fill(0.5),
    isOnsetPerFrame: overrides.isOnsetPerFrame ?? new Array(totalFrames).fill(false),
    onsetIndexPerFrame: overrides.onsetIndexPerFrame ?? new Array(totalFrames).fill(0),
    ...overrides,
  };
}
