import { describe, expect, it } from 'vitest';
import {
    CANVAS_DIMENSION_PRESETS,
    clampRenderDimension,
    dimensionPresetSelectValue,
    RENDER_DIMENSION_BOUNDS,
} from '@/front-end/utils/dimensionPresets';

describe('dimensionPresetSelectValue', () => {
    it('returns preset key when dimensions match exactly', () => {
        expect(dimensionPresetSelectValue(1920, 1080)).toBe('1920x1080');
        expect(dimensionPresetSelectValue(1080, 1920)).toBe('1080x1920');
    });

    it('returns custom for non-preset sizes', () => {
        expect(dimensionPresetSelectValue(800, 600)).toBe('custom');
        expect(dimensionPresetSelectValue(1920, 1081)).toBe('custom');
    });

    it('every preset value resolves to itself', () => {
        for (const p of CANVAS_DIMENSION_PRESETS) {
            const [w, h] = p.value.split('x').map(Number);
            expect(dimensionPresetSelectValue(w, h)).toBe(p.value);
        }
    });
});

describe('clampRenderDimension', () => {
    it('clamps to bounds and rounds', () => {
        expect(clampRenderDimension(100, 1920)).toBe(100);
        expect(clampRenderDimension(10, 1920)).toBe(RENDER_DIMENSION_BOUNDS.min);
        expect(clampRenderDimension(99999, 1920)).toBe(RENDER_DIMENSION_BOUNDS.max);
        expect(clampRenderDimension(63.7, 64)).toBe(64);
    });

    it('uses fallback for non-finite input', () => {
        expect(clampRenderDimension(Number.NaN, 1234)).toBe(1234);
        expect(clampRenderDimension(Number.POSITIVE_INFINITY, 500)).toBe(500);
    });
});
