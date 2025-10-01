import type { Keyframe, PropertyTrack } from '@/types/timeline_types';
import { ease } from '@/front-end/utils/easing';

export function sortKeyframes<T>(keyframes: Keyframe<T>[]): Keyframe<T>[] {
    return keyframes.slice().sort((a, b) => ((a.frame | 0) - (b.frame | 0)));
}

export function upsertKeyframe<T>(track: PropertyTrack<T>, frame: number, value: T): PropertyTrack<T> {
    const list = Array.isArray(track.keyframes) ? track.keyframes.slice() : [];
    const f = Math.max(0, frame | 0);
    const idx = list.findIndex(k => (k.frame | 0) === f);
    if (idx >= 0) list[idx] = { frame: f, value } as Keyframe<T>; else list.push({ frame: f, value } as Keyframe<T>);
    return { propertyPath: track.propertyPath, keyframes: sortKeyframes(list) };
}

export function removeKeyframeAtIndex<T>(track: PropertyTrack<T>, index: number): PropertyTrack<T> {
    const list = Array.isArray(track.keyframes) ? track.keyframes.slice() : [];
    if (index >= 0 && index < list.length) list.splice(index, 1);
    return { propertyPath: track.propertyPath, keyframes: list };
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
 * Interpolates between two values (number or tuple-like array of numbers).
 */
function lerpValue(a: any, b: any, t: number): any {
    const u = Math.min(1, Math.max(0, t));
    if (typeof a === 'number' && typeof b === 'number') {
        return a + (b - a) * u;
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
    // Fallback: if types mismatch, prefer b
    return b;
}

/**
 * Apply interpolation mode to normalized t
 */
function applyInterpolation(t: number, interpolation?: Keyframe['interpolation']): number {
    if (!interpolation) return t;
    if (typeof interpolation === 'string') {
        return ease(t, interpolation as any);
    }
    // cubic with handles not yet implemented: linear fallback
    return t;
}

/**
 * Evaluate a property track at a specific frame with step/linear/ease interpolation.
 * Supports both numbers and tuple-like arrays of numbers.
 */
export function evalInterpolatedAtFrame<T>(
    track: PropertyTrack<T> | null | undefined,
    frame: number,
    fallback: T
): T {
    if (!track || !Array.isArray(track.keyframes) || track.keyframes.length === 0) return fallback;
    const list = sortKeyframes(track.keyframes);
    const f = frame | 0;
    // Find index of keyframe at or before f
    let i = -1;
    for (let k = 0; k < list.length; k++) {
        if ((list[k].frame | 0) <= f) i = k; else break;
    }
    if (i < 0) return (list[0].value as T);
    if (i >= list.length - 1) return (list[i].value as T);
    const a = list[i];
    const b = list[i + 1];
    if ((b.frame | 0) === (a.frame | 0)) return (b.value as T);
    const rawT = (f - (a.frame | 0)) / Math.max(1, (b.frame | 0) - (a.frame | 0));
    const interpT = applyInterpolation(rawT, a.interpolation || 'linear');
    return lerpValue(a.value as any, b.value as any, interpT) as T;
}


