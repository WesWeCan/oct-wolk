import { describe, it, expect } from 'vitest';
import { evalGlobalWordPoolAtFrame } from '@/front-end/utils/timeline/wordPoolEvaluation';
import type { PropertyTrack } from '@/types/timeline_types';

const fullBank = ['hello', 'world', 'test', 'words'];

describe('evalGlobalWordPoolAtFrame', () => {
  it('returns full word bank when no track', () => {
    expect(evalGlobalWordPoolAtFrame(0, null, fullBank)).toEqual(fullBank);
  });

  it('returns full word bank when track has empty keyframes', () => {
    const track: PropertyTrack<string[]> = { propertyPath: 'pool', keyframes: [] };
    expect(evalGlobalWordPoolAtFrame(0, track, fullBank)).toEqual(fullBank);
  });

  it('returns keyframe value at exact frame', () => {
    const track: PropertyTrack<string[]> = {
      propertyPath: 'pool',
      keyframes: [
        { frame: 0, value: ['a', 'b'] },
        { frame: 60, value: ['c', 'd'] },
      ],
    };
    expect(evalGlobalWordPoolAtFrame(60, track, fullBank)).toEqual(['c', 'd']);
  });

  it('returns most recent keyframe value between frames', () => {
    const track: PropertyTrack<string[]> = {
      propertyPath: 'pool',
      keyframes: [
        { frame: 0, value: ['start'] },
        { frame: 100, value: ['end'] },
      ],
    };
    expect(evalGlobalWordPoolAtFrame(50, track, fullBank)).toEqual(['start']);
  });

  it('returns first keyframe when frame is before all keyframes', () => {
    const track: PropertyTrack<string[]> = {
      propertyPath: 'pool',
      keyframes: [{ frame: 50, value: ['later'] }],
    };
    expect(evalGlobalWordPoolAtFrame(10, track, fullBank)).toEqual(['later']);
  });

  it('handles unsorted keyframes', () => {
    const track: PropertyTrack<string[]> = {
      propertyPath: 'pool',
      keyframes: [
        { frame: 100, value: ['b'] },
        { frame: 0, value: ['a'] },
      ],
    };
    expect(evalGlobalWordPoolAtFrame(50, track, fullBank)).toEqual(['a']);
  });
});
