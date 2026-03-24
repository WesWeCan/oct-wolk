import { describe, expect, it } from 'vitest';
import { createDeterministicRandomness } from '@/front-end/motion/deterministicRandomness';
import { layoutCloudItems } from '@/front-end/motion-blocks/cloud/layout';
import { DEFAULT_CLOUD_LAYOUT_PARAMS } from '@/front-end/motion-blocks/cloud/params';

const makeItems = () => ([
    { id: 'a', sortMs: 0, width: 120, height: 42 },
    { id: 'b', sortMs: 100, width: 160, height: 42 },
    { id: 'c', sortMs: 200, width: 90, height: 42 },
    { id: 'd', sortMs: 300, width: 200, height: 42 },
    { id: 'e', sortMs: 400, width: 110, height: 42 },
    { id: 'f', sortMs: 500, width: 140, height: 42 },
    { id: 'g', sortMs: 600, width: 170, height: 42 },
    { id: 'h', sortMs: 700, width: 100, height: 42 },
    { id: 'i', sortMs: 800, width: 150, height: 42 },
    { id: 'j', sortMs: 900, width: 180, height: 42 },
    { id: 'k', sortMs: 1000, width: 95, height: 42 },
    { id: 'l', sortMs: 1100, width: 130, height: 42 },
    { id: 'm', sortMs: 1200, width: 190, height: 42 },
    { id: 'n', sortMs: 1300, width: 125, height: 42 },
    { id: 'o', sortMs: 1400, width: 155, height: 42 },
    { id: 'p', sortMs: 1500, width: 115, height: 42 },
]);

describe('cloud layout', () => {
    const epsilon = 0.000001;

    it('produces stable deterministic positions for the same seed and scope', () => {
        const rngA = createDeterministicRandomness('seed', 'track:block');
        const rngB = createDeterministicRandomness('seed', 'track:block');

        const first = layoutCloudItems(makeItems(), rngA, 1280, 720, DEFAULT_CLOUD_LAYOUT_PARAMS);
        const second = layoutCloudItems(makeItems(), rngB, 1280, 720, DEFAULT_CLOUD_LAYOUT_PARAMS);

        expect(first).toEqual(second);
    });

    it('packs items inside the target region while pursuing dense coverage', () => {
        const layout = layoutCloudItems(
            makeItems(),
            createDeterministicRandomness('seed', 'track:block'),
            1280,
            720,
            DEFAULT_CLOUD_LAYOUT_PARAMS,
        );

        expect(layout.bounds.minX).toBeGreaterThanOrEqual(-640 - epsilon);
        expect(layout.bounds.maxX).toBeLessThanOrEqual(640 + epsilon);
        expect(layout.bounds.minY).toBeGreaterThanOrEqual(-360 - epsilon);
        expect(layout.bounds.maxY).toBeLessThanOrEqual(360 + epsilon);
        expect(layout.contentScale).toBeGreaterThan(0);
        expect(layout.coverage).toBeGreaterThan(0.7);
    });
});
