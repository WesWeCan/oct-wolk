import type { MotionAnimationStyle, MotionEnterExit, MotionStyle, MotionTransform } from '@/types/project_types';
import { normalizeEnterExit } from '@/front-end/utils/motion/enterExitAnimation';

export const DEFAULT_SUBTITLE_STYLE: MotionStyle = {
    fontFamily: 'system-ui',
    fontFallbacks: [],
    fontSize: 72,
    fontWeight: 400,
    fontStyle: 'normal',
    fontName: undefined,
    fontLocalPath: undefined,
    underline: false,
    textCase: 'none',
    letterSpacing: 0,
    lineHeight: 1.2,
    color: '#ffffff',
    opacity: 1,
    globalOpacity: 1,
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    backgroundPadding: 0,
    backgroundBorderRadius: 0,
    textAlign: 'center',
    writingMode: 'horizontal',
    outlineWidth: 0,
    outlineColor: '#000000',
    boundsMode: 'safeArea',
    wrapMode: 'word',
    maxLines: 5,
    overflowBehavior: 'none',
    safeAreaPadding: 40,
    safeAreaOffsetX: 0,
    safeAreaOffsetY: 0,
};

export const DEFAULT_SUBTITLE_TRANSFORM: MotionTransform = {
    anchorX: 'center',
    anchorY: 'center',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0,
};

export const DEFAULT_SUBTITLE_ENTER_EXIT: MotionEnterExit = {
    fraction: 0.3,
    minFrames: 3,
    maxFrames: 30,
    easing: 'easeOut',
    showCursor: false,
    fade: {
        enabled: true,
        opacityStart: 0,
        opacityEnd: 1,
    },
    move: {
        enabled: false,
        direction: 'up',
        distancePx: 24,
    },
    scale: {
        enabled: false,
        amount: 0.12,
    },
    style: 'fade',
    opacityStart: 0,
    opacityEnd: 1,
};

export function createDefaultSubtitleEnter(): MotionEnterExit {
    return {
        ...DEFAULT_SUBTITLE_ENTER_EXIT,
        fade: { ...DEFAULT_SUBTITLE_ENTER_EXIT.fade, enabled: true, opacityStart: 0, opacityEnd: 1 },
        move: { ...DEFAULT_SUBTITLE_ENTER_EXIT.move },
        scale: { ...DEFAULT_SUBTITLE_ENTER_EXIT.scale },
        showCursor: false,
        opacityStart: 0,
        opacityEnd: 1,
    };
}

export function createDefaultSubtitleExit(): MotionEnterExit {
    return {
        ...DEFAULT_SUBTITLE_ENTER_EXIT,
        fade: { ...DEFAULT_SUBTITLE_ENTER_EXIT.fade, enabled: true, opacityStart: 1, opacityEnd: 0 },
        move: { ...DEFAULT_SUBTITLE_ENTER_EXIT.move },
        scale: { ...DEFAULT_SUBTITLE_ENTER_EXIT.scale },
        showCursor: false,
        opacityStart: 1,
        opacityEnd: 0,
    };
}

const deriveStyleFromComposer = (
    style: MotionAnimationStyle | undefined,
    normalized: ReturnType<typeof normalizeEnterExit>,
): MotionAnimationStyle => {
    if (style === 'typewriter') return 'typewriter';
    if (normalized.move.enabled) {
        if (normalized.move.direction === 'up') return 'slideUp';
        if (normalized.move.direction === 'down') return 'slideDown';
        if (normalized.move.direction === 'left') return 'slideLeft';
        return 'slideRight';
    }
    if (normalized.scale.enabled) return 'scale';
    if (normalized.fade.enabled) return 'fade';
    return 'none';
};

export function normalizeSubtitleEnterExit(
    config: MotionEnterExit | null | undefined,
    which: 'enter' | 'exit',
): MotionEnterExit {
    const fallback = which === 'enter' ? createDefaultSubtitleEnter() : createDefaultSubtitleExit();
    const isTypewriter = config?.style === 'typewriter';
    const merged: MotionEnterExit = {
        ...fallback,
        ...(config ?? {}),
        fade: {
            ...fallback.fade,
            ...(isTypewriter ? { enabled: false, opacityStart: 1, opacityEnd: 1 } : {}),
            ...(config?.fade ?? {}),
        },
        move: {
            ...fallback.move,
            ...(isTypewriter ? { enabled: false } : {}),
            ...(config?.move ?? {}),
        },
        scale: {
            ...fallback.scale,
            ...(isTypewriter ? { enabled: false } : {}),
            ...(config?.scale ?? {}),
        },
    };
    const normalized = normalizeEnterExit(merged);

    return {
        fraction: normalized.fraction,
        minFrames: normalized.minFrames,
        maxFrames: normalized.maxFrames,
        easing: normalized.easing as MotionEnterExit['easing'],
        showCursor: config?.showCursor ?? fallback.showCursor ?? false,
        fade: { ...normalized.fade },
        move: { ...normalized.move },
        scale: { ...normalized.scale },
        style: deriveStyleFromComposer(config?.style, normalized),
        opacityStart: normalized.fade.opacityStart,
        opacityEnd: normalized.fade.opacityEnd,
    };
}
