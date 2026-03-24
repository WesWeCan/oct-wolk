import type {
    MotionAnimationDirection,
    MotionAnimationStyle,
    MotionEnterExit,
    TimelineItem,
} from '@/types/project_types';
import { ease } from '@/front-end/utils/easing';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const applyEasing = (progress: number, easingName: string): number => {
    const t = clamp01(progress);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const bounceOut = (x: number) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (x < 1 / d1) return n1 * x * x;
        if (x < 2 / d1) return n1 * (x - (1.5 / d1)) * (x - (1.5 / d1)) + 0.75;
        if (x < 2.5 / d1) return n1 * (x - (2.25 / d1)) * (x - (2.25 / d1)) + 0.9375;
        return n1 * (x - (2.625 / d1)) * (x - (2.625 / d1)) + 0.984375;
    };
    switch (easingName) {
        case 'linear':
        case 'easeIn':
        case 'easeOut':
        case 'easeInOut':
            return ease(t, easingName);
        case 'easeOutCubic':
            return 1 - Math.pow(1 - t, 3);
        case 'easeInCubic':
            return t * t * t;
        case 'easeOutBack':
            return 1 + (c3 * Math.pow(t - 1, 3)) + (c1 * Math.pow(t - 1, 2));
        case 'easeInBack':
            return c3 * t * t * t - c1 * t * t;
        case 'easeOutBounce':
            return bounceOut(t);
        case 'easeInBounce':
            return 1 - bounceOut(1 - t);
        default:
            return ease(t, 'easeOut');
    }
};

const isSlideStyle = (style: MotionAnimationStyle): style is 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' => {
    return style === 'slideUp' || style === 'slideDown' || style === 'slideLeft' || style === 'slideRight';
};

const slideStyleToDirection = (style: 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight'): MotionAnimationDirection => {
    if (style === 'slideUp') return 'up';
    if (style === 'slideDown') return 'down';
    if (style === 'slideLeft') return 'left';
    return 'right';
};

export interface NormalizedEnterExit {
    fraction: number;
    minFrames: number;
    maxFrames: number;
    easing: string;
    style: MotionAnimationStyle;
    fade: {
        enabled: boolean;
        opacityStart: number;
        opacityEnd: number;
    };
    move: {
        enabled: boolean;
        direction: MotionAnimationDirection;
        distancePx: number;
    };
    scale: {
        enabled: boolean;
        amount: number;
    };
}

const hasComposerFields = (config: MotionEnterExit): boolean => {
    return !!(config.fade || config.move || config.scale);
};

export function normalizeEnterExit(config: MotionEnterExit): NormalizedEnterExit {
    const style = config.style ?? 'fade';
    const defaultFadeEnabled = style !== 'none' && style !== 'typewriter';
    const defaultMoveEnabled = isSlideStyle(style);
    const defaultScaleEnabled = style === 'scale';
    const defaultDirection = isSlideStyle(style) ? slideStyleToDirection(style) : 'up';

    if (!hasComposerFields(config)) {
        return {
            fraction: config.fraction,
            minFrames: config.minFrames,
            maxFrames: config.maxFrames,
            easing: config.easing,
            style,
            fade: {
                enabled: defaultFadeEnabled,
                opacityStart: config.opacityStart ?? 0,
                opacityEnd: config.opacityEnd ?? 1,
            },
            move: {
                enabled: defaultMoveEnabled,
                direction: defaultDirection,
                distancePx: 24,
            },
            scale: {
                enabled: defaultScaleEnabled,
                amount: 0.12,
            },
        };
    }

    return {
        fraction: config.fraction,
        minFrames: config.minFrames,
        maxFrames: config.maxFrames,
        easing: config.easing,
        style,
        fade: {
            enabled: config.fade?.enabled ?? defaultFadeEnabled,
            opacityStart: config.fade?.opacityStart ?? config.opacityStart ?? 0,
            opacityEnd: config.fade?.opacityEnd ?? config.opacityEnd ?? 1,
        },
        move: {
            enabled: config.move?.enabled ?? defaultMoveEnabled,
            direction: config.move?.direction ?? defaultDirection,
            distancePx: config.move?.distancePx ?? 24,
        },
        scale: {
            enabled: config.scale?.enabled ?? defaultScaleEnabled,
            amount: config.scale?.amount ?? 0.12,
        },
    };
}

export const msToFrame = (ms: number, fps: number): number => Math.round((ms * fps) / 1000);
export const frameToMs = (frame: number, fps: number): number => Math.round((frame * 1000) / fps);

export function computeEnterExitProgress(
    item: TimelineItem,
    currentFrame: number,
    fps: number,
    enter: MotionEnterExit,
    exit: MotionEnterExit,
): { enterProgress: number; exitProgress: number } {
    const enterCfg = normalizeEnterExit(enter);
    const exitCfg = normalizeEnterExit(exit);
    const startFrame = msToFrame(item.startMs, fps);
    const endFrame = Math.max(startFrame + 1, msToFrame(item.endMs, fps));
    const itemDurationFrames = Math.max(1, endFrame - startFrame);
    const elapsed = currentFrame - startFrame;
    const remaining = endFrame - currentFrame;

    const enterFrames = Math.max(
        enterCfg.minFrames,
        Math.min(enterCfg.maxFrames, Math.round(itemDurationFrames * enterCfg.fraction)),
    );
    const exitFrames = Math.max(
        exitCfg.minFrames,
        Math.min(exitCfg.maxFrames, Math.round(itemDurationFrames * exitCfg.fraction)),
    );

    let enterProgress = 1;
    const enterAnimEnabled = enterCfg.style === 'typewriter' || enterCfg.fade.enabled || enterCfg.move.enabled || enterCfg.scale.enabled;
    if (enterAnimEnabled && elapsed < enterFrames) {
        enterProgress = applyEasing(elapsed / Math.max(1, enterFrames), enterCfg.easing);
    }

    let exitProgress = 0;
    const exitAnimEnabled = exitCfg.style === 'typewriter' || exitCfg.fade.enabled || exitCfg.move.enabled || exitCfg.scale.enabled;
    if (exitAnimEnabled && remaining < exitFrames) {
        exitProgress = applyEasing(1 - remaining / Math.max(1, exitFrames), exitCfg.easing);
    }

    return { enterProgress: clamp01(enterProgress), exitProgress: clamp01(exitProgress) };
}

export function applyEnterExitToAlpha(
    enterProgress: number,
    exitProgress: number,
    enter: MotionEnterExit,
    exit: MotionEnterExit,
): number {
    const enterCfg = normalizeEnterExit(enter);
    const exitCfg = normalizeEnterExit(exit);
    const enterAlpha = enterCfg.fade.enabled
        ? enterCfg.fade.opacityStart + ((enterCfg.fade.opacityEnd - enterCfg.fade.opacityStart) * clamp01(enterProgress))
        : 1;
    const exitAlpha = exitCfg.fade.enabled
        ? exitCfg.fade.opacityStart + ((exitCfg.fade.opacityEnd - exitCfg.fade.opacityStart) * clamp01(exitProgress))
        : 1;
    return clamp01(enterAlpha * exitAlpha);
}

export function applyEnterExitToTransform(
    enterProgress: number,
    exitProgress: number,
    enter: MotionEnterExit,
    exit: MotionEnterExit,
): { translateX: number; translateY: number; scale: number } {
    const enterCfg = normalizeEnterExit(enter);
    const exitCfg = normalizeEnterExit(exit);
    let translateX = 0;
    let translateY = 0;
    let scale = 1;

    const enterAmount = 1 - clamp01(enterProgress);
    const exitAmount = clamp01(exitProgress);

    if (enterCfg.move.enabled) {
        const d = enterCfg.move.distancePx;
        if (enterCfg.move.direction === 'up') translateY += d * enterAmount;
        else if (enterCfg.move.direction === 'down') translateY -= d * enterAmount;
        else if (enterCfg.move.direction === 'left') translateX += d * enterAmount;
        else if (enterCfg.move.direction === 'right') translateX -= d * enterAmount;
    }

    if (exitCfg.move.enabled) {
        const d = exitCfg.move.distancePx;
        if (exitCfg.move.direction === 'up') translateY -= d * exitAmount;
        else if (exitCfg.move.direction === 'down') translateY += d * exitAmount;
        else if (exitCfg.move.direction === 'left') translateX -= d * exitAmount;
        else if (exitCfg.move.direction === 'right') translateX += d * exitAmount;
    }

    if (enterCfg.scale.enabled) {
        scale *= Math.max(0.05, 1 - (enterCfg.scale.amount * enterAmount));
    }
    if (exitCfg.scale.enabled) {
        scale *= Math.max(0.05, 1 + (exitCfg.scale.amount * exitAmount));
    }

    return { translateX, translateY, scale };
}
