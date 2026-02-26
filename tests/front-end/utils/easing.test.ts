import { describe, it, expect } from 'vitest';
import { ease } from '@/front-end/utils/easing';

describe('ease', () => {
  it('linear returns input unchanged', () => {
    expect(ease(0, 'linear')).toBe(0);
    expect(ease(0.5, 'linear')).toBe(0.5);
    expect(ease(1, 'linear')).toBe(1);
  });

  it('easeIn starts slow', () => {
    expect(ease(0, 'easeIn')).toBe(0);
    expect(ease(0.5, 'easeIn')).toBe(0.25);
    expect(ease(1, 'easeIn')).toBe(1);
  });

  it('easeOut starts fast', () => {
    expect(ease(0, 'easeOut')).toBe(0);
    expect(ease(0.5, 'easeOut')).toBe(0.75);
    expect(ease(1, 'easeOut')).toBe(1);
  });

  it('easeInOut is symmetric', () => {
    expect(ease(0, 'easeInOut')).toBe(0);
    expect(ease(1, 'easeInOut')).toBe(1);
    expect(ease(0.5, 'easeInOut')).toBe(0.5);
  });

  it('clamps values below 0', () => {
    expect(ease(-1, 'linear')).toBe(0);
    expect(ease(-0.5, 'easeIn')).toBe(0);
  });

  it('clamps values above 1', () => {
    expect(ease(2, 'linear')).toBe(1);
    expect(ease(1.5, 'easeOut')).toBe(1);
  });
});
