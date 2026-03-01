import { randomUUID } from '@/front-end/utils/uuid';
import type { LyricTrack, TimelineItem } from '@/types/project_types';
import { TRACK_COLORS } from '@/types/project_types';

const TRACK_KIND_BASE_COLORS: Record<'word' | 'sentence' | 'verse', string> = {
    word: '#4fc3f7',
    sentence: '#81c784',
    verse: '#e57373',
};

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

const MIN_ITEM_DURATION_MS = 10;

function parseRawLyricsVersesAndLines(rawLyrics: string): string[][] {
    return rawLyrics
        .split(/\n\s*\n/)
        .map((verse) => verse
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0))
        .filter((lines) => lines.length > 0);
}

function collapseLinesToCount(lines: string[], targetCount: number): string[] {
    if (targetCount <= 0 || lines.length === 0) return [];
    if (lines.length <= targetCount) return lines;

    const groups: string[] = [];
    for (let i = 0; i < targetCount; i++) {
        const start = Math.floor((i * lines.length) / targetCount);
        const end = Math.floor(((i + 1) * lines.length) / targetCount);
        const merged = lines.slice(start, end).join(' ').trim();
        if (merged.length > 0) groups.push(merged);
    }
    return groups;
}

function collapseTokensToCount(tokens: string[], targetCount: number): string[] {
    if (targetCount <= 0 || tokens.length === 0) return [];
    if (tokens.length <= targetCount) return tokens;

    const groups: string[] = [];
    for (let i = 0; i < targetCount; i++) {
        const start = Math.floor((i * tokens.length) / targetCount);
        const end = Math.floor(((i + 1) * tokens.length) / targetCount);
        const merged = tokens.slice(start, end).join(' ').trim();
        if (merged.length > 0) groups.push(merged);
    }
    return groups;
}

function tokenizeLyricWords(text: string): string[] {
    return text
        .split(/\s+/)
        .map((token) => token.replace(/[^\p{L}\p{N}'’`-]/gu, '').trim())
        .filter((token) => token.length > 0);
}

/**
 * Split by whitespace / punctuation boundaries -> one item per word.
 */
export function generateWordTrack(rawLyrics: string, audioDurationMs: number, existingTrackCount: number): LyricTrack {
    const words = rawLyrics
        .split(/[\s]+/)
        .map(w => w.replace(/[^\p{L}\p{N}''`-]/gu, '').trim())
        .filter(w => w.length > 0);

    return {
        id: randomUUID(),
        name: `Words ${existingTrackCount + 1}`,
        color: TRACK_KIND_BASE_COLORS.word,
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
        color: TRACK_KIND_BASE_COLORS.sentence,
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
        color: TRACK_KIND_BASE_COLORS.verse,
        kind: 'verse',
        items: makeItems(verses, audioDurationMs),
        muted: false,
        solo: false,
        locked: false,
    };
}

/**
 * Generate a new line track from a selected verse track.
 * Lines come from raw lyrics (one line per Enter) and are constrained
 * to each verse item's existing timeline window.
 */
export function generateLineTrackFromVerseTrack(
    rawLyrics: string,
    sourceVerseTrack: LyricTrack,
    existingTrackCount: number,
): LyricTrack {
    const versesWithLines = parseRawLyricsVersesAndLines(rawLyrics);
    const sourceVerseItems = [...sourceVerseTrack.items].sort((a, b) => a.startMs - b.startMs);
    const verseCount = Math.min(versesWithLines.length, sourceVerseItems.length);
    const items: TimelineItem[] = [];

    for (let verseIndex = 0; verseIndex < verseCount; verseIndex++) {
        const verseItem = sourceVerseItems[verseIndex];
        const linesRaw = versesWithLines[verseIndex];
        const verseDuration = Math.max(0, verseItem.endMs - verseItem.startMs);
        if (verseDuration < MIN_ITEM_DURATION_MS || linesRaw.length === 0) continue;

        const maxLineCount = Math.max(1, Math.floor(verseDuration / MIN_ITEM_DURATION_MS));
        const lines = collapseLinesToCount(linesRaw, Math.min(linesRaw.length, maxLineCount));
        if (lines.length === 0) continue;

        const durationPerLine = verseDuration / lines.length;
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const startMs = Math.round(verseItem.startMs + lineIndex * durationPerLine);
            const isLast = lineIndex === lines.length - 1;
            const endMs = isLast
                ? verseItem.endMs
                : Math.round(verseItem.startMs + (lineIndex + 1) * durationPerLine);
            if (endMs - startMs < MIN_ITEM_DURATION_MS) continue;

            items.push({
                id: randomUUID(),
                text: lines[lineIndex],
                startMs,
                endMs,
            });
        }
    }

    return {
        id: randomUUID(),
        name: `Lines ${existingTrackCount + 1}`,
        color: TRACK_KIND_BASE_COLORS.sentence,
        kind: 'sentence',
        items,
        muted: false,
        solo: false,
        locked: false,
    };
}

/**
 * Generate a new word track from a selected line track.
 * Words are tokenized from raw lyric lines (fallback to line-item text)
 * and constrained to each source line item's timeline window.
 */
export function generateWordTrackFromLineTrack(
    rawLyrics: string,
    sourceLineTrack: LyricTrack,
    existingTrackCount: number,
): LyricTrack {
    const rawLines = parseRawLyricsVersesAndLines(rawLyrics).flat();
    const sourceLineItems = [...sourceLineTrack.items].sort((a, b) => a.startMs - b.startMs);
    const lineCount = sourceLineItems.length;
    const items: TimelineItem[] = [];

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
        const lineItem = sourceLineItems[lineIndex];
        const sourceText = rawLines[lineIndex] ?? lineItem.text;
        const wordsRaw = tokenizeLyricWords(sourceText);
        const lineDuration = Math.max(0, lineItem.endMs - lineItem.startMs);
        if (lineDuration < MIN_ITEM_DURATION_MS || wordsRaw.length === 0) continue;

        const maxWordCount = Math.max(1, Math.floor(lineDuration / MIN_ITEM_DURATION_MS));
        const words = collapseTokensToCount(wordsRaw, Math.min(wordsRaw.length, maxWordCount));
        if (words.length === 0) continue;

        const durationPerWord = lineDuration / words.length;
        for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
            const startMs = Math.round(lineItem.startMs + wordIndex * durationPerWord);
            const isLast = wordIndex === words.length - 1;
            const endMs = isLast
                ? lineItem.endMs
                : Math.round(lineItem.startMs + (wordIndex + 1) * durationPerWord);
            if (endMs - startMs < MIN_ITEM_DURATION_MS) continue;

            items.push({
                id: randomUUID(),
                text: words[wordIndex],
                startMs,
                endMs,
            });
        }
    }

    return {
        id: randomUUID(),
        name: `Words ${existingTrackCount + 1}`,
        color: TRACK_KIND_BASE_COLORS.word,
        kind: 'word',
        items,
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
