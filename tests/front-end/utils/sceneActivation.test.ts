import { describe, it, expect } from 'vitest';
import { computeActiveScenesForFrame } from '@/front-end/utils/timeline/sceneActivation';
import { createTestSceneRef } from '../../utils/fixtures';

describe('computeActiveScenesForFrame', () => {
  it('returns dummy scene with zero alpha for empty timeline', () => {
    const result = computeActiveScenesForFrame(0, []);
    expect(result.a.id).toBe('none');
    expect(result.b).toBeNull();
    expect(result.alphaA).toBe(0);
    expect(result.alphaB).toBe(0);
  });

  it('returns dummy scene for frame outside all scenes', () => {
    const scenes = [createTestSceneRef({ startFrame: 100, durationFrames: 50 })];
    const result = computeActiveScenesForFrame(0, scenes);
    expect(result.a.id).toBe('none');
    expect(result.alphaA).toBe(0);
  });

  it('returns correct scene for frame inside a scene', () => {
    const scenes = [
      createTestSceneRef({ id: 'a', startFrame: 0, durationFrames: 100 }),
      createTestSceneRef({ id: 'b', startFrame: 100, durationFrames: 200 }),
    ];
    const result = computeActiveScenesForFrame(50, scenes);
    expect(result.a.id).toBe('a');
    expect(result.alphaA).toBe(1);
    expect(result.b).toBeNull();
  });

  it('returns second scene when frame is at exact boundary', () => {
    const scenes = [
      createTestSceneRef({ id: 'a', startFrame: 0, durationFrames: 100 }),
      createTestSceneRef({ id: 'b', startFrame: 100, durationFrames: 100 }),
    ];
    const result = computeActiveScenesForFrame(100, scenes);
    expect(result.a.id).toBe('b');
  });

  it('handles gap between scenes (frame in gap)', () => {
    const scenes = [
      createTestSceneRef({ id: 'a', startFrame: 0, durationFrames: 50 }),
      createTestSceneRef({ id: 'b', startFrame: 100, durationFrames: 50 }),
    ];
    const result = computeActiveScenesForFrame(75, scenes);
    expect(result.a.id).toBe('none');
  });

  it('returns first scene at frame 0 for single-scene timeline', () => {
    const scenes = [createTestSceneRef({ id: 'only', startFrame: 0, durationFrames: 300 })];
    const result = computeActiveScenesForFrame(0, scenes);
    expect(result.a.id).toBe('only');
    expect(result.alphaA).toBe(1);
  });

  it('returns dummy at last frame + 1 (exclusive end)', () => {
    const scenes = [createTestSceneRef({ id: 'a', startFrame: 0, durationFrames: 100 })];
    const result = computeActiveScenesForFrame(100, scenes);
    expect(result.a.id).toBe('none');
  });
});
