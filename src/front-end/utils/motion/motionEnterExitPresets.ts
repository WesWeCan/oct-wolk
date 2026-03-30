import type { MotionEnterExit } from '@/types/project_types';
import { normalizeEnterExit } from '@/front-end/utils/motion/enterExitAnimation';

export const cloneMotionEnterExit = (value: MotionEnterExit): MotionEnterExit => ({
    ...value,
    fade: value.fade ? { ...value.fade } : value.fade,
    move: value.move ? { ...value.move } : value.move,
    scale: value.scale ? { ...value.scale } : value.scale,
});

export const createMotionVisualOffEnterExit = (value: MotionEnterExit): MotionEnterExit => {
    const next = cloneMotionEnterExit(value);
    return {
        ...next,
        fade: {
            ...next.fade,
            enabled: false,
            opacityStart: 1,
            opacityEnd: 1,
        },
        move: {
            ...next.move,
            enabled: false,
        },
        scale: {
            ...next.scale,
            enabled: false,
        },
        style: 'none',
        opacityStart: 1,
        opacityEnd: 1,
    };
};

export const createMotionAllOffEnterExit = (value: MotionEnterExit): MotionEnterExit => {
    const next = createMotionVisualOffEnterExit(value);
    return {
        ...next,
        fraction: 0,
        minFrames: 0,
        maxFrames: 0,
    };
};

export const motionEnterExitEquals = (left: MotionEnterExit, right: MotionEnterExit): boolean => {
    const a = normalizeEnterExit(left);
    const b = normalizeEnterExit(right);

    return a.fraction === b.fraction
        && a.minFrames === b.minFrames
        && a.maxFrames === b.maxFrames
        && a.easing === b.easing
        && a.fade.enabled === b.fade.enabled
        && a.fade.opacityStart === b.fade.opacityStart
        && a.fade.opacityEnd === b.fade.opacityEnd
        && a.move.enabled === b.move.enabled
        && a.move.direction === b.move.direction
        && a.move.distancePx === b.move.distancePx
        && a.scale.enabled === b.scale.enabled
        && a.scale.amount === b.scale.amount;
};
