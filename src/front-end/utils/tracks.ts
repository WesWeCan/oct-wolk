import type { Keyframe, PropertyTrack } from '@/types/timeline_types';

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


