import { describe, it, expect } from 'vitest';
import {
  evalBeatForFrame,
  evalWordIndexForFrame,
  computeBeatIndexPerFrame,
  computeOnsetIndexPerFrame,
} from '@/front-end/utils/timeline/frameEvaluation';
import { createTestAnalysisCache } from '../../utils/fixtures';

describe('evalBeatForFrame', () => {
  it('returns live envelope when no cache', () => {
    expect(evalBeatForFrame(10, null, 0.75)).toBe(0.75);
  });

  it('returns energy from cache for valid frame', () => {
    const cache = createTestAnalysisCache({
      totalFrames: 10,
      energyPerFrame: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    });
    expect(evalBeatForFrame(5, cache)).toBe(0.5);
  });

  it('clamps to last frame for out-of-bounds', () => {
    const cache = createTestAnalysisCache({
      totalFrames: 5,
      energyPerFrame: [0, 0.25, 0.5, 0.75, 1.0],
    });
    expect(evalBeatForFrame(999, cache)).toBe(1.0);
  });

  it('clamps negative frames to 0', () => {
    const cache = createTestAnalysisCache({
      totalFrames: 5,
      energyPerFrame: [0.1, 0.2, 0.3, 0.4, 0.5],
    });
    expect(evalBeatForFrame(-5, cache)).toBe(0.1);
  });
});

describe('computeBeatIndexPerFrame', () => {
  it('returns monotonically increasing indices', () => {
    const beats = [0.5, 1.0, 1.5];
    const result = computeBeatIndexPerFrame(beats, 120, 60);

    expect(result.length).toBe(120);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
    }
  });

  it('counts beats at correct frames', () => {
    const beats = [1.0]; // beat at 1 second = frame 60 at 60fps
    const result = computeBeatIndexPerFrame(beats, 120, 60);

    expect(result[0]).toBe(0);
    expect(result[59]).toBe(0);
    expect(result[60]).toBe(1);
    expect(result[119]).toBe(1);
  });

  it('handles empty beats array', () => {
    const result = computeBeatIndexPerFrame([], 60, 60);
    expect(result.length).toBe(60);
    expect(result.every(v => v === 0)).toBe(true);
  });

  it('handles unsorted beats', () => {
    const beats = [2.0, 1.0, 0.5];
    const result = computeBeatIndexPerFrame(beats, 180, 60);
    // Should sort internally: beat count should be 3 by end
    expect(result[179]).toBe(3);
  });
});

describe('computeOnsetIndexPerFrame', () => {
  it('returns cumulative onset count', () => {
    const onsets = [false, true, false, false, true, true, false];
    const result = computeOnsetIndexPerFrame(onsets);

    expect(result).toEqual([0, 1, 1, 1, 2, 3, 3]);
  });

  it('handles all-false', () => {
    const result = computeOnsetIndexPerFrame([false, false, false]);
    expect(result).toEqual([0, 0, 0]);
  });

  it('handles all-true', () => {
    const result = computeOnsetIndexPerFrame([true, true, true]);
    expect(result).toEqual([1, 2, 3]);
  });
});

describe('evalWordIndexForFrame', () => {
  it('uses beat index when available', () => {
    const beatIdx = [0, 0, 1, 1, 2];
    expect(evalWordIndexForFrame(2, beatIdx, null, 60)).toBe(1);
  });

  it('falls back to onset index when no beats', () => {
    const onsetIdx = [0, 1, 1, 2, 3];
    expect(evalWordIndexForFrame(3, null, onsetIdx, 60)).toBe(2);
  });

  it('falls back to frame/30 when neither available', () => {
    expect(evalWordIndexForFrame(60, null, null, 60)).toBe(2); // 60 / floor(60/2) = 60/30 = 2
  });

  it('negative frames produce negative index in fallback path (known behavior)', () => {
    // The fallback path (frame / floor(fps/2)) does NOT clamp negative frames.
    // This documents the current behavior — callers are expected to pass non-negative frames.
    expect(evalWordIndexForFrame(-5, null, null, 60)).toBe(-1);
  });
});
