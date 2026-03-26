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
    showCursor: false,
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

    it('lets a 100 percent typewriter enter use the full cue span', () => {
        const config = {
            ...createTypewriterConfig(),
            fraction: 1,
        };

        const progress = computeEnterExitProgress(item, 30, 60, config, createTypewriterConfig());

        expect(progress.enterProgress).toBeCloseTo(0.5, 5);
    });

    it('partitions typewriter enter and exit windows so they do not overlap', () => {
        const enter = {
            ...createTypewriterConfig(),
            fraction: 0.7,
        };
        const exit = {
            ...createTypewriterConfig(),
            fraction: 0.5,
        };

        const beforeExit = computeEnterExitProgress(item, 41, 60, enter, exit);
        const duringExit = computeEnterExitProgress(item, 45, 60, enter, exit);

        expect(beforeExit.exitProgress).toBe(0);
        expect(duringExit.exitProgress).toBeCloseTo(1 / 6, 5);
    });

    it('treats a full-span typewriter exit as immediately hidden', () => {
        const exit = {
            ...createTypewriterConfig(),
            fraction: 1,
        };

        const progress = computeEnterExitProgress(item, 0, 60, createTypewriterConfig(), exit);

        expect(progress.exitProgress).toBe(1);
    });

    it('makes very small typewriter enter fractions finish quickly', () => {
        const enter = {
            ...createTypewriterConfig(),
            fraction: 0.05,
        };

        const progress = computeEnterExitProgress(item, 3, 60, enter, createTypewriterConfig());

        expect(progress.enterProgress).toBe(1);
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
