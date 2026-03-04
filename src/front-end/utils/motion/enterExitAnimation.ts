import type { MotionAnimationStyle, MotionEnterExit, TimelineItem } from '@/types/project_types';
import { ease } from '@/front-end/utils/easing';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const applyEasing = (progress: number, easingName: string): number => {
    const t = clamp01(progress);
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
        default:
            return ease(t, 'easeOut');
    }
};

export const msToFrame = (ms: number, fps: number): number => Math.round((ms * fps) / 1000);
export const frameToMs = (frame: number, fps: number): number => Math.round((frame * 1000) / fps);

export function computeEnterExitProgress(
    item: TimelineItem,
    currentFrame: number,
    fps: number,
    enter: MotionEnterExit,
    exit: MotionEnterExit,
): { enterProgress: number; exitProgress: number } {
    const startFrame = msToFrame(item.startMs, fps);
    const endFrame = Math.max(startFrame + 1, msToFrame(item.endMs, fps));
    const itemDurationFrames = Math.max(1, endFrame - startFrame);
    const elapsed = currentFrame - startFrame;
    const remaining = endFrame - currentFrame;

    const enterFrames = Math.max(
        enter.minFrames,
        Math.min(enter.maxFrames, Math.round(itemDurationFrames * enter.fraction)),
    );
    const exitFrames = Math.max(
        exit.minFrames,
        Math.min(exit.maxFrames, Math.round(itemDurationFrames * exit.fraction)),
    );

    let enterProgress = 1;
    if (enter.style !== 'none' && elapsed < enterFrames) {
        enterProgress = applyEasing(elapsed / Math.max(1, enterFrames), enter.easing);
    }

    let exitProgress = 0;
    if (exit.style !== 'none' && remaining < exitFrames) {
        exitProgress = applyEasing(1 - remaining / Math.max(1, exitFrames), exit.easing);
    }

    return { enterProgress: clamp01(enterProgress), exitProgress: clamp01(exitProgress) };
}

export function applyEnterExitToAlpha(
    enterProgress: number,
    exitProgress: number,
    enter: MotionEnterExit,
    exit: MotionEnterExit,
): number {
    const enterAlpha = enter.opacityStart + ((enter.opacityEnd - enter.opacityStart) * clamp01(enterProgress));
    const exitAlpha = exit.opacityStart + ((exit.opacityEnd - exit.opacityStart) * clamp01(exitProgress));
    return clamp01(enterAlpha * exitAlpha);
}

export function applyEnterExitToTransform(
    enterProgress: number,
    exitProgress: number,
    enterStyle: MotionAnimationStyle,
    exitStyle: MotionAnimationStyle,
): { translateX: number; translateY: number; scale: number } {
    let translateX = 0;
    let translateY = 0;
    let scale = 1;

    const enterAmount = 1 - clamp01(enterProgress);
    const exitAmount = clamp01(exitProgress);
    const SHIFT_PX = 24;

    switch (enterStyle) {
        case 'slideUp':
            translateY += SHIFT_PX * enterAmount;
            break;
        case 'slideDown':
            translateY -= SHIFT_PX * enterAmount;
            break;
        case 'slideLeft':
            translateX += SHIFT_PX * enterAmount;
            break;
        case 'slideRight':
            translateX -= SHIFT_PX * enterAmount;
            break;
        case 'scale':
            scale *= 1 - (0.12 * enterAmount);
            break;
        default:
            break;
    }

    switch (exitStyle) {
        case 'slideUp':
            translateY -= SHIFT_PX * exitAmount;
            break;
        case 'slideDown':
            translateY += SHIFT_PX * exitAmount;
            break;
        case 'slideLeft':
            translateX -= SHIFT_PX * exitAmount;
            break;
        case 'slideRight':
            translateX += SHIFT_PX * exitAmount;
            break;
        case 'scale':
            scale *= 1 + (0.12 * exitAmount);
            break;
        default:
            break;
    }

    return { translateX, translateY, scale };
}
