import type { MotionEnterExit, TimelineItem } from '@/types/project_types';
import { msToFrame, normalizeEnterExit } from '@/front-end/utils/motion/enterExitAnimation';
import type { StyledSpan } from '@/front-end/utils/motion/parseTipTapToSpans';

export type TextRevealMode = 'none' | 'typewriter';

export const DEFAULT_TYPEWRITER_ENTER_WINDOW = 0.3;
export const DEFAULT_TYPEWRITER_EXIT_WINDOW = 0.2;
export const DEFAULT_TYPEWRITER_ENTER_PORTION = 0.3;
export const DEFAULT_TYPEWRITER_EXIT_PORTION = 0.2;

export interface TextRevealParams {
    textRevealMode: TextRevealMode;
    textRevealEnterWindow: number;
    textRevealExitWindow: number;
    textRevealEnterPortion: number;
    textRevealExitPortion: number;
    textRevealShowCursor: boolean;
}

export interface TextRevealConfig {
    mode: TextRevealMode;
    enterPortion: number;
    exitPortion: number;
    showCursor: boolean;
}

export const DEFAULT_TEXT_REVEAL_CONFIG: TextRevealConfig = {
    mode: 'none',
    enterPortion: 1,
    exitPortion: 1,
    showCursor: false,
};

export const DEFAULT_TEXT_REVEAL_PARAMS: TextRevealParams = {
    textRevealMode: DEFAULT_TEXT_REVEAL_CONFIG.mode,
    textRevealEnterWindow: DEFAULT_TYPEWRITER_ENTER_WINDOW,
    textRevealExitWindow: DEFAULT_TYPEWRITER_EXIT_WINDOW,
    textRevealEnterPortion: DEFAULT_TEXT_REVEAL_CONFIG.enterPortion,
    textRevealExitPortion: DEFAULT_TEXT_REVEAL_CONFIG.exitPortion,
    textRevealShowCursor: DEFAULT_TEXT_REVEAL_CONFIG.showCursor,
};

export interface TextRevealProgress {
    enterProgress: number;
    exitProgress: number;
}

export interface TextRevealTimingContext {
    durationItem?: TimelineItem;
    enterStartMs?: number;
    exitEndMs?: number;
}

const clamp01 = (value: unknown, fallback: number): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
};

const isTextRevealMode = (value: unknown): value is TextRevealMode => {
    return value === 'none' || value === 'typewriter';
};

export const resolveTextRevealParams = (
    raw: Record<string, any> | null | undefined,
    enter?: MotionEnterExit | null,
    exit?: MotionEnterExit | null,
): TextRevealParams => {
    const source = raw || {};
    const normalizedEnter = enter ? normalizeEnterExit(enter) : null;
    const normalizedExit = exit ? normalizeEnterExit(exit) : null;
    const usesLegacyTypewriter = enter?.style === 'typewriter' || exit?.style === 'typewriter';
    const revealLooksLikeDefaultNone = (
        source.textRevealMode === undefined
        || source.textRevealMode === DEFAULT_TEXT_REVEAL_PARAMS.textRevealMode
    ) && (
        source.textRevealEnterWindow === undefined
        || clamp01(source.textRevealEnterWindow, DEFAULT_TEXT_REVEAL_PARAMS.textRevealEnterWindow) === DEFAULT_TEXT_REVEAL_PARAMS.textRevealEnterWindow
    ) && (
        source.textRevealExitWindow === undefined
        || clamp01(source.textRevealExitWindow, DEFAULT_TEXT_REVEAL_PARAMS.textRevealExitWindow) === DEFAULT_TEXT_REVEAL_PARAMS.textRevealExitWindow
    ) && (
        source.textRevealEnterPortion === undefined
        || clamp01(source.textRevealEnterPortion, DEFAULT_TEXT_REVEAL_PARAMS.textRevealEnterPortion) === DEFAULT_TEXT_REVEAL_PARAMS.textRevealEnterPortion
    ) && (
        source.textRevealExitPortion === undefined
        || clamp01(source.textRevealExitPortion, DEFAULT_TEXT_REVEAL_PARAMS.textRevealExitPortion) === DEFAULT_TEXT_REVEAL_PARAMS.textRevealExitPortion
    ) && source.textRevealShowCursor !== true;
    const legacyMode = usesLegacyTypewriter && (
        !isTextRevealMode(source.textRevealMode) || revealLooksLikeDefaultNone
    );

    if (legacyMode && revealLooksLikeDefaultNone) {
        return {
            textRevealMode: 'typewriter',
            textRevealEnterWindow: clamp01(normalizedEnter?.fraction, DEFAULT_TYPEWRITER_ENTER_WINDOW) || 0.01,
            textRevealExitWindow: clamp01(normalizedExit?.fraction, DEFAULT_TYPEWRITER_EXIT_WINDOW) || 0.01,
            textRevealEnterPortion: 1,
            textRevealExitPortion: 1,
            textRevealShowCursor: enter?.showCursor === true || exit?.showCursor === true,
        };
    }

    const textRevealMode = legacyMode
        ? 'typewriter'
        : isTextRevealMode(source.textRevealMode)
            ? source.textRevealMode
            : DEFAULT_TEXT_REVEAL_PARAMS.textRevealMode;

    return {
        textRevealMode,
        textRevealEnterWindow: clamp01(
            source.textRevealEnterWindow,
            legacyMode
                ? clamp01(normalizedEnter?.fraction, DEFAULT_TYPEWRITER_ENTER_WINDOW)
                : DEFAULT_TEXT_REVEAL_PARAMS.textRevealEnterWindow,
        ) || 0.01,
        textRevealExitWindow: clamp01(
            source.textRevealExitWindow,
            legacyMode
                ? clamp01(normalizedExit?.fraction, DEFAULT_TYPEWRITER_EXIT_WINDOW)
                : DEFAULT_TEXT_REVEAL_PARAMS.textRevealExitWindow,
        ) || 0.01,
        textRevealEnterPortion: clamp01(
            source.textRevealEnterPortion,
            legacyMode ? 1 : DEFAULT_TEXT_REVEAL_PARAMS.textRevealEnterPortion,
        ) || 0.01,
        textRevealExitPortion: clamp01(
            source.textRevealExitPortion,
            legacyMode ? 1 : DEFAULT_TEXT_REVEAL_PARAMS.textRevealExitPortion,
        ) || 0.01,
        textRevealShowCursor: source.textRevealShowCursor === true || (legacyMode && (enter?.showCursor === true || exit?.showCursor === true)),
    };
};

export const textRevealConfigFromParams = (
    raw: TextRevealParams | Record<string, any> | null | undefined,
    enter?: MotionEnterExit | null,
    exit?: MotionEnterExit | null,
): TextRevealConfig => {
    const params = resolveTextRevealParams(raw, enter, exit);
    return {
        mode: params.textRevealMode,
        enterPortion: params.textRevealEnterPortion,
        exitPortion: params.textRevealExitPortion,
        showCursor: params.textRevealShowCursor,
    };
};

export const computeTextRevealProgress = (
    item: TimelineItem,
    currentFrame: number,
    fps: number,
    raw: TextRevealParams | Record<string, any> | null | undefined,
    enter?: MotionEnterExit | null,
    exit?: MotionEnterExit | null,
    timing?: TextRevealTimingContext,
): TextRevealProgress => {
    const params = resolveTextRevealParams(raw, enter, exit);
    if (params.textRevealMode === 'none') {
        return { enterProgress: 1, exitProgress: 0 };
    }
    const durationItem = timing?.durationItem ?? item;
    const durationStartFrame = msToFrame(durationItem.startMs, fps);
    const durationEndFrame = Math.max(durationStartFrame + 1, msToFrame(durationItem.endMs, fps));
    const enterStartFrame = msToFrame(timing?.enterStartMs ?? item.startMs, fps);
    const exitEndFrame = msToFrame(timing?.exitEndMs ?? item.endMs, fps);
    const itemDurationFrames = Math.max(1, durationEndFrame - durationStartFrame);
    const elapsed = currentFrame - enterStartFrame;
    const remaining = exitEndFrame - currentFrame;

    const enterFrames = Math.max(1, Math.round(itemDurationFrames * params.textRevealEnterWindow));
    const exitFrames = Math.max(1, Math.round(itemDurationFrames * params.textRevealExitWindow));

    const enterProgress = elapsed < enterFrames
        ? elapsed / Math.max(1, enterFrames)
        : 1;
    const exitProgress = remaining < exitFrames
        ? 1 - remaining / Math.max(1, exitFrames)
        : 0;

    return {
        enterProgress: clamp01(enterProgress, 1),
        exitProgress: clamp01(exitProgress, 0),
    };
};

/**
 * Compute the fraction of characters that should be visible (0..1).
 *
 * `enterPortion` / `exitPortion` compress the typing/deleting into a
 * sub-range of the overall enter/exit progress so movement and fade can
 * continue after the reveal finishes.
 */
export const getTextRevealFraction = (
    enterProgress: number,
    exitProgress: number,
    config: TextRevealConfig,
): number => {
    if (config.mode === 'none') return 1;

    const ep = clamp01(config.enterPortion, 1);
    const xp = clamp01(config.exitPortion, 1);
    const enter = clamp01(enterProgress, 1);
    const exit = clamp01(exitProgress, 0);

    const enterReveal = ep > 0 ? clamp01(enter / ep, 1) : 1;
    const exitReveal = xp > 0
        ? clamp01(1 - exit / xp, 1)
        : (exit > 0 ? 0 : 1);

    return Math.min(enterReveal, exitReveal);
};

/**
 * Slice styled spans to expose only the first `visibleChars` characters,
 * preserving span ordering, styling, and multi-byte safety.
 */
export const sliceStyledSpansByCharacters = (
    spans: StyledSpan[],
    visibleChars: number,
): StyledSpan[] => {
    if (visibleChars <= 0) return [];

    const result: StyledSpan[] = [];
    let remaining = visibleChars;

    for (const span of spans) {
        if (remaining <= 0) break;
        const chars = Array.from(span.text);
        if (chars.length <= remaining) {
            result.push(span);
            remaining -= chars.length;
            continue;
        }
        result.push({ ...span, text: chars.slice(0, remaining).join('') });
        remaining = 0;
    }

    return result.filter((s) => s.text.length > 0);
};

export interface TextRevealResult {
    spans: StyledSpan[];
    visibleChars: number;
    totalChars: number;
    cursorCharIndex: number | null;
}

/**
 * Apply text reveal to styled spans. Returns the visible spans together
 * with character-count metadata useful for cursor rendering later.
 */
function shouldShowRevealCursor(
    enterProgress: number,
    exitProgress: number,
    enabled: boolean,
): boolean {
    if (!enabled) return false;
    const enter = clamp01(enterProgress, 1);
    const exit = clamp01(exitProgress, 0);
    const showEnterCursor = enter > 0 && enter < 1;
    const showExitCursor = exit > 0 && exit < 1;
    return showExitCursor || showEnterCursor;
}

export const applyTextRevealToSpans = (
    spans: StyledSpan[],
    enterProgress: number,
    exitProgress: number,
    config: TextRevealConfig,
): TextRevealResult => {
    const totalChars = spans.reduce((sum, s) => sum + Array.from(s.text).length, 0);

    if (config.mode === 'none' || totalChars <= 0) {
        return { spans, visibleChars: totalChars, totalChars, cursorCharIndex: null };
    }

    const fraction = getTextRevealFraction(enterProgress, exitProgress, config);

    if (fraction >= 1) {
        return {
            spans,
            visibleChars: totalChars,
            totalChars,
            cursorCharIndex: shouldShowRevealCursor(enterProgress, exitProgress, config.showCursor)
                ? totalChars
                : null,
        };
    }

    const visibleChars = fraction <= 0
        ? 0
        : Math.max(1, Math.ceil(totalChars * fraction));

    return {
        spans: sliceStyledSpansByCharacters(spans, visibleChars),
        visibleChars,
        totalChars,
        cursorCharIndex: shouldShowRevealCursor(enterProgress, exitProgress, config.showCursor)
            ? visibleChars
            : null,
    };
};
