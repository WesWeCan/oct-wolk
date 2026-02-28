import { randomUUID } from '@/front-end/utils/uuid';
import type { LyricTrack, TimelineItem, LyricTrackKind } from '@/types/project_types';
import { TRACK_COLORS } from '@/types/project_types';

let colorIndex = 0;
const nextColor = (): string => {
    const c = TRACK_COLORS[colorIndex % TRACK_COLORS.length];
    colorIndex++;
    return c;
};

function makeItems(texts: string[], totalDurationMs: number): TimelineItem[] {
    if (texts.length === 0 || totalDurationMs <= 0) return [];
    const durationPer = totalDurationMs / texts.length;

    return texts.map((text, i) => ({
        id: randomUUID(),
        text,
        startMs: Math.round(i * durationPer),
        endMs: Math.round((i + 1) * durationPer),
    }));
}

/**
 * Split by whitespace / punctuation boundaries -> one item per word.
 */
export function generateWordTrack(rawLyrics: string, audioDurationMs: number, existingTrackCount: number): LyricTrack {
    const words = rawLyrics
        .split(/[\s]+/)
        .map(w => w.replace(/[^\p{L}\p{N}''`\-]/gu, '').trim())
        .filter(w => w.length > 0);

    return {
        id: randomUUID(),
        name: `Words ${existingTrackCount + 1}`,
        color: nextColor(),
        kind: 'word',
        items: makeItems(words, audioDurationMs),
        muted: false,
        solo: false,
        locked: false,
    };
}

/**
 * Split by line breaks / sentence boundaries -> one item per sentence/line.
 */
export function generateSentenceTrack(rawLyrics: string, audioDurationMs: number, existingTrackCount: number): LyricTrack {
    const sentences = rawLyrics
        .split(/\n|(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    return {
        id: randomUUID(),
        name: `Sentences ${existingTrackCount + 1}`,
        color: nextColor(),
        kind: 'sentence',
        items: makeItems(sentences, audioDurationMs),
        muted: false,
        solo: false,
        locked: false,
    };
}

/**
 * Split by double newlines / stanza boundaries -> one item per verse.
 */
export function generateVerseTrack(rawLyrics: string, audioDurationMs: number, existingTrackCount: number): LyricTrack {
    const verses = rawLyrics
        .split(/\n\s*\n/)
        .map(v => v.trim())
        .filter(v => v.length > 0);

    return {
        id: randomUUID(),
        name: `Verses ${existingTrackCount + 1}`,
        color: nextColor(),
        kind: 'verse',
        items: makeItems(verses, audioDurationMs),
        muted: false,
        solo: false,
        locked: false,
    };
}

/**
 * Create an empty custom track.
 */
export function createCustomTrack(existingTrackCount: number): LyricTrack {
    return {
        id: randomUUID(),
        name: `Custom ${existingTrackCount + 1}`,
        color: nextColor(),
        kind: 'custom',
        items: [],
        muted: false,
        solo: false,
        locked: false,
    };
}
