import { describe, expect, it } from 'vitest';
import type { MotionEnterExit, TimelineItem } from '@/types/project_types';
import { computeEnterExitProgress } from '@/front-end/utils/motion/enterExitAnimation';

const item: TimelineItem = {
    id: 'item-1',
    text: 'Hello',
    startMs: 0,
    endMs: 1000,
};

const createTypewriterConfig = (): MotionEnterExit => ({
    fraction: 0.5,
    minFrames: 3,
    maxFrames: 30,
    easing: 'linear',
    fade: {
        enabled: false,
        opacityStart: 1,
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
    style: 'typewriter',
    opacityStart: 1,
    opacityEnd: 1,
});

describe('enter/exit animation timing', () => {
    it('advances enter progress for pure typewriter animations', () => {
        const config = createTypewriterConfig();

        const progress = computeEnterExitProgress(item, 15, 60, config, config);

        expect(progress.enterProgress).toBeCloseTo(0.5, 5);
        expect(progress.exitProgress).toBe(0);
    });

    it('advances exit progress for pure typewriter animations', () => {
        const config = createTypewriterConfig();

        const progress = computeEnterExitProgress(item, 50, 60, config, config);

        expect(progress.enterProgress).toBe(1);
        expect(progress.exitProgress).toBeCloseTo(2 / 3, 5);
    });

    it('keeps non-animated configs inert when all effects are disabled', () => {
        const config = {
            ...createTypewriterConfig(),
            style: 'none' as const,
        };

        const progress = computeEnterExitProgress(item, 15, 60, config, config);

        expect(progress.enterProgress).toBe(1);
        expect(progress.exitProgress).toBe(0);
    });
});
