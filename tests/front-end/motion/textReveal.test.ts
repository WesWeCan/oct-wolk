import { describe, expect, it } from 'vitest';
import {
    computeTextRevealProgress,
    getTextRevealFraction,
    sliceStyledSpansByCharacters,
    applyTextRevealToSpans,
    DEFAULT_TEXT_REVEAL_CONFIG,
    DEFAULT_TEXT_REVEAL_PARAMS,
    resolveTextRevealParams,
    textRevealConfigFromParams,
} from '@/front-end/utils/motion/textReveal';
import type { TextRevealConfig } from '@/front-end/utils/motion/textReveal';
import type { StyledSpan } from '@/front-end/utils/motion/parseTipTapToSpans';
import { createDefaultSubtitleEnter, createDefaultSubtitleExit } from '@/front-end/motion-blocks/subtitle/defaults';

const typewriterConfig = (
    overrides: Partial<TextRevealConfig> = {},
): TextRevealConfig => ({
    mode: 'typewriter',
    enterPortion: 1,
    exitPortion: 1,
    showCursor: false,
    ...overrides,
});

const spans = (texts: string[]): StyledSpan[] =>
    texts.map((text) => ({ text }));

describe('getTextRevealFraction', () => {
    it('returns 1 when mode is none regardless of progress', () => {
        expect(getTextRevealFraction(0, 0, DEFAULT_TEXT_REVEAL_CONFIG)).toBe(1);
        expect(getTextRevealFraction(0.5, 0.5, DEFAULT_TEXT_REVEAL_CONFIG)).toBe(1);
    });

    it('returns enterProgress when only entering (exitProgress 0)', () => {
        const cfg = typewriterConfig();
        expect(getTextRevealFraction(0, 0, cfg)).toBe(0);
        expect(getTextRevealFraction(0.5, 0, cfg)).toBe(0.5);
        expect(getTextRevealFraction(1, 0, cfg)).toBe(1);
    });

    it('returns (1 - exitProgress) when fully entered and exiting', () => {
        const cfg = typewriterConfig();
        expect(getTextRevealFraction(1, 0.3, cfg)).toBeCloseTo(0.7);
        expect(getTextRevealFraction(1, 1, cfg)).toBe(0);
    });

    it('uses enterPortion to compress the typing window', () => {
        const cfg = typewriterConfig({ enterPortion: 0.5 });
        expect(getTextRevealFraction(0.25, 0, cfg)).toBeCloseTo(0.5);
        expect(getTextRevealFraction(0.5, 0, cfg)).toBe(1);
        expect(getTextRevealFraction(0.8, 0, cfg)).toBe(1);
    });

    it('uses exitPortion to compress the deleting window', () => {
        const cfg = typewriterConfig({ exitPortion: 0.5 });
        expect(getTextRevealFraction(1, 0.25, cfg)).toBeCloseTo(0.5);
        expect(getTextRevealFraction(1, 0.5, cfg)).toBe(0);
        expect(getTextRevealFraction(1, 0.8, cfg)).toBe(0);
    });

    it('takes the min when both enter and exit are partial', () => {
        const cfg = typewriterConfig();
        expect(getTextRevealFraction(0.3, 0.4, cfg)).toBeCloseTo(0.3);
    });

    it('handles NaN/Infinity by falling back', () => {
        const cfg = typewriterConfig();
        expect(getTextRevealFraction(NaN, 0, cfg)).toBe(1);
        expect(getTextRevealFraction(0.5, NaN, cfg)).toBe(0.5);
    });
});

describe('resolveTextRevealParams', () => {
    it('returns shared defaults for missing values', () => {
        expect(resolveTextRevealParams(null)).toEqual(DEFAULT_TEXT_REVEAL_PARAMS);
    });

    it('normalizes invalid values safely', () => {
        expect(resolveTextRevealParams({
            textRevealMode: 'garbage',
            textRevealEnterPortion: -5,
            textRevealExitPortion: 10,
        })).toEqual({
            textRevealMode: 'none',
            textRevealEnterPortion: 0.01,
            textRevealExitPortion: 1,
            textRevealShowCursor: false,
        });
    });
});

describe('textRevealConfigFromParams', () => {
    it('maps shared params into runtime config', () => {
        expect(textRevealConfigFromParams({
            textRevealMode: 'typewriter',
            textRevealEnterPortion: 0.6,
            textRevealExitPortion: 0.4,
        })).toEqual({
            mode: 'typewriter',
            enterPortion: 0.6,
            exitPortion: 0.4,
            showCursor: false,
        });
    });
});

describe('computeTextRevealProgress', () => {
    const item = { id: 'item-1', text: 'hello', startMs: 0, endMs: 1000 };

    it('tracks enter timing even when motion channels are disabled', () => {
        const enter = createDefaultSubtitleEnter();
        const exit = createDefaultSubtitleExit();
        enter.fade.enabled = false;
        enter.move.enabled = false;
        enter.scale.enabled = false;

        const progress = computeTextRevealProgress(item, 5, 60, enter, exit);
        expect(progress.enterProgress).toBeGreaterThan(0);
        expect(progress.enterProgress).toBeLessThan(1);
    });

    it('tracks exit timing even when motion channels are disabled', () => {
        const enter = createDefaultSubtitleEnter();
        const exit = createDefaultSubtitleExit();
        exit.fade.enabled = false;
        exit.move.enabled = false;
        exit.scale.enabled = false;

        const progress = computeTextRevealProgress(item, 59, 60, enter, exit);
        expect(progress.exitProgress).toBeGreaterThan(0);
    });
});

describe('sliceStyledSpansByCharacters', () => {
    it('returns empty array for 0 visible chars', () => {
        expect(sliceStyledSpansByCharacters(spans(['abc']), 0)).toEqual([]);
    });

    it('returns full spans when visibleChars >= total', () => {
        const input = spans(['ab', 'cd']);
        expect(sliceStyledSpansByCharacters(input, 10)).toEqual(input);
    });

    it('slices within a single span', () => {
        const result = sliceStyledSpansByCharacters(spans(['abcde']), 3);
        expect(result).toEqual([{ text: 'abc' }]);
    });

    it('slices across multiple spans preserving styling', () => {
        const input: StyledSpan[] = [
            { text: 'ab', bold: true },
            { text: 'cde', italic: true },
        ];
        const result = sliceStyledSpansByCharacters(input, 3);
        expect(result).toEqual([
            { text: 'ab', bold: true },
            { text: 'c', italic: true },
        ]);
    });

    it('handles multi-byte characters safely', () => {
        const result = sliceStyledSpansByCharacters(spans(['🎵🎶🎸']), 2);
        expect(result).toEqual([{ text: '🎵🎶' }]);
    });
});

describe('applyTextRevealToSpans', () => {
    it('returns all spans when mode is none', () => {
        const input = spans(['hello']);
        const result = applyTextRevealToSpans(input, 0, 0, DEFAULT_TEXT_REVEAL_CONFIG);
        expect(result.spans).toEqual(input);
        expect(result.visibleChars).toBe(5);
        expect(result.totalChars).toBe(5);
        expect(result.cursorCharIndex).toBeNull();
    });

    it('returns all spans when fully entered and not exiting', () => {
        const input = spans(['hello']);
        const result = applyTextRevealToSpans(input, 1, 0, typewriterConfig());
        expect(result.spans).toEqual(input);
        expect(result.visibleChars).toBe(5);
        expect(result.cursorCharIndex).toBeNull();
    });

    it('returns partial spans during enter', () => {
        const input = spans(['hello']);
        const result = applyTextRevealToSpans(input, 0.4, 0, typewriterConfig());
        expect(result.visibleChars).toBe(2);
        expect(result.spans[0].text).toBe('he');
        expect(result.cursorCharIndex).toBeNull();
    });

    it('returns partial spans during exit', () => {
        const input = spans(['hello']);
        const result = applyTextRevealToSpans(input, 1, 0.6, typewriterConfig());
        expect(result.visibleChars).toBe(2);
        expect(result.spans[0].text).toBe('he');
        expect(result.cursorCharIndex).toBeNull();
    });

    it('returns empty spans when fully exited', () => {
        const input = spans(['hello']);
        const result = applyTextRevealToSpans(input, 1, 1, typewriterConfig());
        expect(result.spans).toEqual([]);
        expect(result.visibleChars).toBe(0);
        expect(result.cursorCharIndex).toBeNull();
    });

    it('respects enterPortion so typing finishes earlier', () => {
        const input = spans(['abcde']);
        const cfg = typewriterConfig({ enterPortion: 0.5 });
        const halfway = applyTextRevealToSpans(input, 0.5, 0, cfg);
        expect(halfway.visibleChars).toBe(5);

        const quarter = applyTextRevealToSpans(input, 0.25, 0, cfg);
        expect(quarter.visibleChars).toBe(3);
    });

    it('respects exitPortion so deleting finishes earlier', () => {
        const input = spans(['abcde']);
        const cfg = typewriterConfig({ exitPortion: 0.5 });
        const halfExit = applyTextRevealToSpans(input, 1, 0.5, cfg);
        expect(halfExit.visibleChars).toBe(0);
        expect(halfExit.spans).toEqual([]);

        const quarterExit = applyTextRevealToSpans(input, 1, 0.25, cfg);
        expect(quarterExit.visibleChars).toBe(3);
    });

    it('returns all spans for empty input', () => {
        const result = applyTextRevealToSpans([], 0.5, 0, typewriterConfig());
        expect(result.spans).toEqual([]);
        expect(result.totalChars).toBe(0);
        expect(result.cursorCharIndex).toBeNull();
    });

    it('returns a cursor boundary while typing when enabled', () => {
        const input = spans(['hello']);
        const result = applyTextRevealToSpans(input, 0.4, 0, typewriterConfig({ showCursor: true }));
        expect(result.visibleChars).toBe(2);
        expect(result.cursorCharIndex).toBe(2);
    });

    it('does not show a cursor before reveal has started', () => {
        const input = spans(['hello']);
        const result = applyTextRevealToSpans(input, 0, 0, typewriterConfig({ showCursor: true }));
        expect(result.visibleChars).toBe(0);
        expect(result.cursorCharIndex).toBeNull();
    });

    it('returns a cursor boundary while deleting when enabled', () => {
        const input = spans(['hello']);
        const result = applyTextRevealToSpans(input, 1, 0.6, typewriterConfig({ showCursor: true }));
        expect(result.visibleChars).toBe(2);
        expect(result.cursorCharIndex).toBe(2);
    });
});
