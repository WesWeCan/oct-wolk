import { describe, it, expect } from 'vitest';
import {
  sortKeyframes,
  upsertKeyframe,
  removeKeyframeAtIndex,
  evalStepAtFrame,
  evalInterpolatedAtFrame,
  extractFrames,
  parseHexColor,
} from '@/front-end/utils/tracks';
import type { PropertyTrack, Keyframe } from '@/types/timeline_types';

const track = (kfs: Keyframe[]): PropertyTrack => ({
  propertyPath: 'test.prop',
  keyframes: kfs,
});

describe('sortKeyframes', () => {
  it('sorts by frame ascending', () => {
    const result = sortKeyframes([{ frame: 30, value: 'c' }, { frame: 10, value: 'a' }, { frame: 20, value: 'b' }]);
    expect(result.map(k => k.frame)).toEqual([10, 20, 30]);
  });

  it('does not mutate original', () => {
    const original = [{ frame: 2, value: 'b' }, { frame: 1, value: 'a' }];
    sortKeyframes(original);
    expect(original[0].frame).toBe(2);
  });
});

describe('upsertKeyframe', () => {
  it('adds new keyframe at correct position', () => {
    const t = track([{ frame: 0, value: 1 }, { frame: 60, value: 3 }]);
    const result = upsertKeyframe(t, 30, 2);
    expect(result.keyframes.length).toBe(3);
    expect(result.keyframes[1]).toEqual({ frame: 30, value: 2 });
  });

  it('updates existing keyframe at same frame', () => {
    const t = track([{ frame: 0, value: 1 }, { frame: 30, value: 2 }]);
    const result = upsertKeyframe(t, 30, 99);
    expect(result.keyframes.length).toBe(2);
    expect(result.keyframes[1].value).toBe(99);
  });
});

describe('removeKeyframeAtIndex', () => {
  it('removes at valid index', () => {
    const t = track([{ frame: 0, value: 'a' }, { frame: 30, value: 'b' }, { frame: 60, value: 'c' }]);
    const result = removeKeyframeAtIndex(t, 1);
    expect(result.keyframes.length).toBe(2);
    expect(result.keyframes.map(k => k.value)).toEqual(['a', 'c']);
  });

  it('ignores invalid index', () => {
    const t = track([{ frame: 0, value: 'a' }]);
    const result = removeKeyframeAtIndex(t, 5);
    expect(result.keyframes.length).toBe(1);
  });
});

describe('evalStepAtFrame', () => {
  it('returns fallback for null track', () => {
    expect(evalStepAtFrame(null, 10, 'default')).toBe('default');
  });

  it('returns fallback for empty keyframes', () => {
    expect(evalStepAtFrame(track([]), 10, 'default')).toBe('default');
  });

  it('returns value of most recent keyframe (step)', () => {
    const t = track([{ frame: 0, value: 'start' }, { frame: 30, value: 'mid' }, { frame: 60, value: 'end' }]);
    expect(evalStepAtFrame(t, 45, 'default')).toBe('mid');
  });

  it('returns first keyframe value when before all keyframes', () => {
    const t = track([{ frame: 10, value: 'a' }]);
    expect(evalStepAtFrame(t, 5, 'default')).toBe('a');
  });
});

describe('evalInterpolatedAtFrame', () => {
  it('returns fallback for null track', () => {
    expect(evalInterpolatedAtFrame(null, 10, 0)).toBe(0);
  });

  it('interpolates linearly between keyframes', () => {
    const t = track([
      { frame: 0, value: 0 },
      { frame: 100, value: 100 },
    ]);
    expect(evalInterpolatedAtFrame(t, 50, 0)).toBeCloseTo(50, 1);
  });

  it('returns first value before first keyframe', () => {
    const t = track([{ frame: 10, value: 42 }, { frame: 20, value: 84 }]);
    expect(evalInterpolatedAtFrame(t, 5, 0)).toBe(42);
  });

  it('returns last value after last keyframe', () => {
    const t = track([{ frame: 10, value: 42 }, { frame: 20, value: 84 }]);
    expect(evalInterpolatedAtFrame(t, 999, 0)).toBe(84);
  });

  it('handles exact keyframe match', () => {
    const t = track([
      { frame: 0, value: 0 },
      { frame: 50, value: 50 },
      { frame: 100, value: 100 },
    ]);
    expect(evalInterpolatedAtFrame(t, 50, 0)).toBe(50);
  });

  it('interpolates arrays element-wise', () => {
    const t = track([
      { frame: 0, value: [0, 10] },
      { frame: 100, value: [100, 110] },
    ]);
    const result = evalInterpolatedAtFrame(t, 50, [0, 0]) as number[];
    expect(result[0]).toBeCloseTo(50, 1);
    expect(result[1]).toBeCloseTo(60, 1);
  });
});

describe('parseHexColor', () => {
  it('parses #rrggbb', () => {
    expect(parseHexColor('#ff8000')).toEqual([255, 128, 0, 1]);
  });

  it('parses shorthand #rgb', () => {
    expect(parseHexColor('#f00')).toEqual([255, 0, 0, 1]);
  });

  it('parses #rrggbbaa', () => {
    const result = parseHexColor('#ff000080');
    expect(result).toBeTruthy();
    expect(result![0]).toBe(255);
    expect(result![3]).toBeCloseTo(128 / 255, 2);
  });

  it('returns null for non-hex strings', () => {
    expect(parseHexColor('red')).toBeNull();
    expect(parseHexColor('rgb(255,0,0)')).toBeNull();
    expect(parseHexColor('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseHexColor(42 as any)).toBeNull();
  });
});

describe('evalInterpolatedAtFrame – color interpolation', () => {
  it('interpolates hex colors at midpoint', () => {
    const t = track([
      { frame: 0, value: '#000000' },
      { frame: 100, value: '#ff8040' },
    ]);
    const result = evalInterpolatedAtFrame(t, 50, '#000000');
    expect(result).toBe('#804020');
  });

  it('returns exact color at keyframe boundary', () => {
    const t = track([
      { frame: 0, value: '#ff0000' },
      { frame: 100, value: '#0000ff' },
    ]);
    expect(evalInterpolatedAtFrame(t, 0, '#000000')).toBe('#ff0000');
    expect(evalInterpolatedAtFrame(t, 100, '#000000')).toBe('#0000ff');
  });

  it('respects step interpolation for colors', () => {
    const t = track([
      { frame: 0, value: '#ff0000', interpolation: 'step' as any },
      { frame: 100, value: '#0000ff' },
    ]);
    expect(evalInterpolatedAtFrame(t, 50, '#000000')).toBe('#ff0000');
  });

  it('falls back to next value for non-hex strings', () => {
    const t = track([
      { frame: 0, value: 'red' },
      { frame: 100, value: 'blue' },
    ]);
    expect(evalInterpolatedAtFrame(t, 50, 'black')).toBe('blue');
  });

  it('interpolates shorthand #rgb colors', () => {
    const t = track([
      { frame: 0, value: '#000' },
      { frame: 100, value: '#fff' },
    ]);
    const result = evalInterpolatedAtFrame(t, 50, '#000');
    expect(result).toBe('#808080');
  });
});

describe('extractFrames', () => {
  it('returns sorted frame numbers', () => {
    const t = track([{ frame: 60, value: 'c' }, { frame: 0, value: 'a' }, { frame: 30, value: 'b' }]);
    expect(extractFrames(t)).toEqual([0, 30, 60]);
  });

  it('returns empty for null track', () => {
    expect(extractFrames(null)).toEqual([]);
  });
});
