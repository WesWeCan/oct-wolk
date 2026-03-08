import type { Keyframe, PropertyTrack } from '@/types/keyframe_types';
import { ease } from '@/front-end/utils/easing';

export function sortKeyframes<T>(keyframes: Keyframe<T>[]): Keyframe<T>[] {
    return keyframes.slice().sort((a, b) => ((a.frame | 0) - (b.frame | 0)));
}

export function upsertKeyframe<T>(track: PropertyTrack<T>, frame: number, value: T, interpolation?: Keyframe<T>['interpolation']): PropertyTrack<T> {
    const list = Array.isArray(track.keyframes) ? track.keyframes.slice() : [];
    const f = Math.max(0, frame | 0);
    const idx = list.findIndex(k => (k.frame | 0) === f);
    const kf: Keyframe<T> = { frame: f, value };
    if (interpolation) kf.interpolation = interpolation;
    if (idx >= 0) list[idx] = kf; else list.push(kf);
    return { propertyPath: track.propertyPath, keyframes: sortKeyframes(list), enabled: track.enabled };
}

export function removeKeyframeAtIndex<T>(track: PropertyTrack<T>, index: number): PropertyTrack<T> {
    const list = Array.isArray(track.keyframes) ? track.keyframes.slice() : [];
    if (index >= 0 && index < list.length) list.splice(index, 1);
    return { propertyPath: track.propertyPath, keyframes: list, enabled: track.enabled };
}

export function evalStepAtFrame<T>(track: PropertyTrack<T> | null | undefined, frame: number, fallback: T): T {
    if (!track || !Array.isArray(track.keyframes) || !track.keyframes.length) return fallback;
    const sorted = sortKeyframes(track.keyframes);
    let last = sorted[0];
    const f = frame | 0;
    for (const k of sorted) { if ((k.frame | 0) <= f) last = k; else break; }
    return (last.value as T);
}

export function extractFrames<T>(track: PropertyTrack<T> | null | undefined): number[] {
    if (!track || !Array.isArray(track.keyframes)) return [];
    return track.keyframes.map(k => Math.max(0, (k.frame | 0))).sort((a, b) => a - b);
}

export function hashWords(list: string[]): string {
    // Simple FNV-1a-like hash for arrays of strings
    let h = 2166136261 >>> 0;
    for (let i = 0; i < list.length; i++) {
        const s = list[i];
        for (let j = 0; j < s.length; j++) {
            h ^= s.charCodeAt(j);
            h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        }
    }
    return String(h >>> 0);
}

/**
 * Parse a CSS hex color (#rgb, #rrggbb, #rrggbbaa) into [r, g, b, a] (0-255, alpha 0-1).
 * Returns null for unsupported formats.
 */
export function parseHexColor(s: string): [number, number, number, number] | null {
    if (typeof s !== 'string' || s[0] !== '#') return null;
    const hex = s.slice(1);
    if (hex.length === 3) {
        return [
            parseInt(hex[0] + hex[0], 16),
            parseInt(hex[1] + hex[1], 16),
            parseInt(hex[2] + hex[2], 16),
            1,
        ];
    }
    if (hex.length === 6) {
        return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
            1,
        ];
    }
    if (hex.length === 8) {
        return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
            parseInt(hex.slice(6, 8), 16) / 255,
        ];
    }
    return null;
}

function toHex2(n: number): string {
    const v = Math.round(Math.max(0, Math.min(255, n)));
    return v.toString(16).padStart(2, '0');
}

/**
 * Linearly interpolate two parsed RGBA tuples and return a #rrggbb(aa) string.
 */
function lerpColor(a: [number, number, number, number], b: [number, number, number, number], t: number): string {
    const u = Math.min(1, Math.max(0, t));
    const r = a[0] + (b[0] - a[0]) * u;
    const g = a[1] + (b[1] - a[1]) * u;
    const bl = a[2] + (b[2] - a[2]) * u;
    const al = a[3] + (b[3] - a[3]) * u;
    if (Math.abs(al - 1) < 1e-4) return `#${toHex2(r)}${toHex2(g)}${toHex2(bl)}`;
    return `#${toHex2(r)}${toHex2(g)}${toHex2(bl)}${toHex2(al * 255)}`;
}

/**
 * Interpolates between two values (number, number-array, or CSS hex color string).
 */
function lerpValue(a: any, b: any, t: number): any {
    const u = Math.min(1, Math.max(0, t));
    if (typeof a === 'number' && typeof b === 'number') {
        return a + (b - a) * u;
    }
    if (typeof a === 'string' && typeof b === 'string') {
        const ca = parseHexColor(a);
        const cb = parseHexColor(b);
        if (ca && cb) return lerpColor(ca, cb, u);
        return b;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        const n = Math.min(a.length, b.length);
        const out = new Array(n);
        for (let i = 0; i < n; i++) {
            const av = Number(a[i]);
            const bv = Number(b[i]);
            out[i] = av + (bv - av) * u;
        }
        return out;
    }
    return b;
}

function applyInterpolation(t: number, interpolation?: Keyframe['interpolation']): number {
    if (!interpolation) return t;
    if (typeof interpolation === 'string') {
        if (interpolation === 'step') return 0;
        return ease(t, interpolation as any);
    }
    return t;
}

export function evalInterpolatedAtFrame<T>(
    track: PropertyTrack<T> | null | undefined,
    frame: number,
    fallback: T
): T {
    if (!track || !Array.isArray(track.keyframes) || track.keyframes.length === 0) return fallback;
    const list = sortKeyframes(track.keyframes);
    const f = frame | 0;
    let i = -1;
    for (let k = 0; k < list.length; k++) {
        if ((list[k].frame | 0) <= f) i = k; else break;
    }
    if (i < 0) return (list[0].value as T);
    if (i >= list.length - 1) return (list[i].value as T);
    const a = list[i];
    const b = list[i + 1];
    if (a.interpolation === 'step') return a.value as T;
    if ((b.frame | 0) === (a.frame | 0)) return (b.value as T);
    const rawT = (f - (a.frame | 0)) / Math.max(1, (b.frame | 0) - (a.frame | 0));
    const interpT = applyInterpolation(rawT, a.interpolation || 'linear');
    return lerpValue(a.value as any, b.value as any, interpT) as T;
}


