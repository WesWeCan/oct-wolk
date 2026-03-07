import { describe, it, expect, vi } from 'vitest';
import { buildFontFamilyChain, computeConfigKeyForFrame } from '@/front-end/composables/editor/useWorkerSceneConfig';
import type { ProjectSettings } from '@/types/timeline_types';
import { getFontAlias } from '@/front-end/utils/fonts/fontUtils';

vi.mock('@/front-end/utils/hash/hashWords', () => ({
  hashWords: vi.fn((words: string[]) => words.join(',')),
}));

vi.mock('@/front-end/utils/hash/stableStringify', () => ({
  stableStringify: vi.fn((obj: any, _exclude?: Set<string>) => JSON.stringify(obj)),
}));

describe('buildFontFamilyChain', () => {
  it('returns system-ui when no font set', () => {
    const settings = {} as ProjectSettings;
    expect(buildFontFamilyChain(settings)).toBe('system-ui');
  });

  it('returns primary font quoted if special chars', () => {
    const settings = { fontFamily: 'Open Sans', fontFallbacks: [] } as any;
    expect(buildFontFamilyChain(settings)).toBe('"Open Sans"');
  });

  it('chains primary + fallbacks', () => {
    const settings = { fontFamily: 'Roboto', fontFallbacks: ['Arial', 'sans-serif'] } as any;
    expect(buildFontFamilyChain(settings)).toBe('Roboto, Arial, sans-serif');
  });

  it('prepends ProjectFont when fontLocalPath is set', () => {
    const settings = { fontFamily: 'Roboto', fontFallbacks: [], fontLocalPath: '/fonts/custom.woff2' } as any;
    expect(buildFontFamilyChain(settings)).toBe(`${getFontAlias('/fonts/custom.woff2', 'Roboto')}, Roboto`);
  });
});

describe('computeConfigKeyForFrame', () => {
  const mockFrameEval = {
    getActiveScenesAtFrame: vi.fn().mockReturnValue({
      a: { id: 'scene-a', type: 'wordcloud' },
      b: null,
      alphaA: 1,
      alphaB: 0,
    }),
    getWordPoolAtFrame: vi.fn().mockReturnValue(['hello', 'world']),
  } as any;

  const sceneDocs = {
    'scene-a': { params: { color: 'red' } },
  } as any;

  const settings = {
    fontFamily: 'Roboto',
    fontFallbacks: ['Arial'],
    fontLocalPath: '',
  } as any;

  it('returns a string key', () => {
    const key = computeConfigKeyForFrame(0, mockFrameEval, sceneDocs, settings);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('produces same key for same inputs', () => {
    const k1 = computeConfigKeyForFrame(0, mockFrameEval, sceneDocs, settings);
    const k2 = computeConfigKeyForFrame(0, mockFrameEval, sceneDocs, settings);
    expect(k1).toBe(k2);
  });

  it('produces different key when scene changes', () => {
    const k1 = computeConfigKeyForFrame(0, mockFrameEval, sceneDocs, settings);

    const eval2 = {
      ...mockFrameEval,
      getActiveScenesAtFrame: vi.fn().mockReturnValue({
        a: { id: 'scene-b', type: 'wordcloud' },
        b: null,
        alphaA: 1,
        alphaB: 0,
      }),
    };

    const k2 = computeConfigKeyForFrame(0, eval2 as any, sceneDocs, settings);
    expect(k1).not.toBe(k2);
  });

  it('includes font info in key', () => {
    const key = computeConfigKeyForFrame(0, mockFrameEval, sceneDocs, settings);
    expect(key).toContain('font:');
  });
});
