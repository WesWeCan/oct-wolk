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

const avgScale = (items: { itemScale: number }[]) =>
    items.reduce((sum, i) => sum + i.itemScale, 0) / items.length;

describe('cloud layout', () => {
    it('produces stable deterministic positions for the same seed and scope', () => {
        const rngA = createDeterministicRandomness('seed', 'track:block');
        const rngB = createDeterministicRandomness('seed', 'track:block');

        const first = layoutCloudItems(makeItems(), rngA, 1280, 720, DEFAULT_CLOUD_LAYOUT_PARAMS);
        const second = layoutCloudItems(makeItems(), rngB, 1280, 720, DEFAULT_CLOUD_LAYOUT_PARAMS);

        expect(first).toEqual(second);
    });

    it('places all items inside the region bounds', () => {
        const layout = layoutCloudItems(
            makeItems(),
            createDeterministicRandomness('seed', 'track:block'),
            1280,
            720,
            DEFAULT_CLOUD_LAYOUT_PARAMS,
        );

        expect(layout.items.length).toBeGreaterThan(0);
        for (const item of layout.items) {
            const right = item.x + item.width * item.itemScale;
            const bottom = item.y + item.height * item.itemScale;
            expect(item.x).toBeGreaterThanOrEqual(-640);
            expect(item.y).toBeGreaterThanOrEqual(-360);
            expect(right).toBeLessThanOrEqual(640);
            expect(bottom).toBeLessThanOrEqual(360);
        }
    });

    it('produces no overlapping items (respecting gap)', () => {
        const params = { ...DEFAULT_CLOUD_LAYOUT_PARAMS, gap: 10 };
        const layout = layoutCloudItems(
            makeItems(),
            createDeterministicRandomness('seed', 'track:block'),
            1280,
            720,
            params,
        );

        for (let i = 0; i < layout.items.length; i++) {
            const a = layout.items[i];
            const aw = a.width * a.itemScale;
            const ah = a.height * a.itemScale;
            for (let j = i + 1; j < layout.items.length; j++) {
                const b = layout.items[j];
                const bw = b.width * b.itemScale;
                const bh = b.height * b.itemScale;
                const noOverlapX = a.x + aw + params.gap <= b.x || b.x + bw + params.gap <= a.x;
                const noOverlapY = a.y + ah + params.gap <= b.y || b.y + bh + params.gap <= a.y;
                expect(noOverlapX || noOverlapY).toBe(true);
            }
        }
    });

    it('assigns each placed item a positive itemScale', () => {
        const layout = layoutCloudItems(
            makeItems(),
            createDeterministicRandomness('seed', 'track:block'),
            1280,
            720,
            DEFAULT_CLOUD_LAYOUT_PARAMS,
        );

        for (const item of layout.items) {
            expect(item.itemScale).toBeGreaterThan(0);
        }
    });

    it('returns empty result for empty input', () => {
        const layout = layoutCloudItems([], null, 1280, 720, DEFAULT_CLOUD_LAYOUT_PARAMS);
        expect(layout.items).toEqual([]);
        expect(layout.bounds.width).toBe(0);
    });

    it('changes positions when a different seed is used', () => {
        const a = layoutCloudItems(
            makeItems(),
            createDeterministicRandomness('alpha', 'track:block'),
            1280, 720, DEFAULT_CLOUD_LAYOUT_PARAMS,
        );
        const b = layoutCloudItems(
            makeItems(),
            createDeterministicRandomness('beta', 'track:block'),
            1280, 720, DEFAULT_CLOUD_LAYOUT_PARAMS,
        );

        const aPositions = a.items.map((item) => `${item.x.toFixed(1)},${item.y.toFixed(1)}`);
        const bPositions = b.items.map((item) => `${item.x.toFixed(1)},${item.y.toFixed(1)}`);
        expect(aPositions).not.toEqual(bPositions);
    });

    it('produces larger average itemScale with fewer items (auto-refit)', () => {
        const rng = () => createDeterministicRandomness('seed', 'track:block');
        const allItems = makeItems();
        const fewItems = allItems.slice(0, 4);

        const full = layoutCloudItems(allItems, rng(), 1280, 720, DEFAULT_CLOUD_LAYOUT_PARAMS);
        const small = layoutCloudItems(fewItems, rng(), 1280, 720, DEFAULT_CLOUD_LAYOUT_PARAMS);

        expect(full.items.length).toBeGreaterThan(0);
        expect(small.items.length).toBeGreaterThan(0);
        expect(avgScale(small.items)).toBeGreaterThan(avgScale(full.items));
    });

    it('produces larger average itemScale with a bigger region (auto-refit)', () => {
        const rng = () => createDeterministicRandomness('seed', 'track:block');
        const items = makeItems();

        const smaller = layoutCloudItems(items, rng(), 800, 600, DEFAULT_CLOUD_LAYOUT_PARAMS);
        const larger = layoutCloudItems(items, rng(), 1920, 1080, DEFAULT_CLOUD_LAYOUT_PARAMS);

        expect(smaller.items.length).toBeGreaterThan(0);
        expect(larger.items.length).toBeGreaterThan(0);
        expect(avgScale(larger.items)).toBeGreaterThan(avgScale(smaller.items));
    });

    it('still confines items and avoids overlap after auto-refit with few items', () => {
        const fewItems = makeItems().slice(0, 3);
        const layout = layoutCloudItems(
            fewItems,
            createDeterministicRandomness('seed', 'track:block'),
            1280,
            720,
            DEFAULT_CLOUD_LAYOUT_PARAMS,
        );

        for (const item of layout.items) {
            const right = item.x + item.width * item.itemScale;
            const bottom = item.y + item.height * item.itemScale;
            expect(item.x).toBeGreaterThanOrEqual(-640);
            expect(item.y).toBeGreaterThanOrEqual(-360);
            expect(right).toBeLessThanOrEqual(640);
            expect(bottom).toBeLessThanOrEqual(360);
        }

        const gap = DEFAULT_CLOUD_LAYOUT_PARAMS.gap;
        for (let i = 0; i < layout.items.length; i++) {
            const a = layout.items[i];
            const aw = a.width * a.itemScale;
            const ah = a.height * a.itemScale;
            for (let j = i + 1; j < layout.items.length; j++) {
                const b = layout.items[j];
                const bw = b.width * b.itemScale;
                const bh = b.height * b.itemScale;
                const noOverlapX = a.x + aw + gap <= b.x || b.x + bw + gap <= a.x;
                const noOverlapY = a.y + ah + gap <= b.y || b.y + bh + gap <= a.y;
                expect(noOverlapX || noOverlapY).toBe(true);
            }
        }
    });
});
