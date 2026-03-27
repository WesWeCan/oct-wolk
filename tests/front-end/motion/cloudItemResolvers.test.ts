import { describe, expect, it } from 'vitest';
import { resolveCloudActiveItems, resolveCloudBlockItems } from '@/front-end/motion-blocks/cloud/item-resolvers';
import type { LyricTrack, MotionBlock } from '@/types/project_types';
import { createDefaultCloudEnter, createDefaultCloudExit, DEFAULT_CLOUD_STYLE, DEFAULT_CLOUD_TRANSFORM } from '@/front-end/motion-blocks/cloud/defaults';
import { DEFAULT_CLOUD_LAYOUT_PARAMS } from '@/front-end/motion-blocks/cloud/params';
import { msToFrame } from '@/front-end/utils/motion/enterExitAnimation';
import { createMotionAllOffEnterExit } from '@/front-end/utils/motion/motionEnterExitPresets';

const FPS = 60;

const makeBlock = (overrides?: Partial<MotionBlock>): MotionBlock => ({
    id: 'block-1',
    type: 'cloud',
    sourceTrackId: 'word-track',
    startMs: 0,
    endMs: 5000,
    style: { ...DEFAULT_CLOUD_STYLE },
    transform: { ...DEFAULT_CLOUD_TRANSFORM },
    enter: createDefaultCloudEnter(),
    exit: createDefaultCloudExit(),
    overrides: [],
    params: { ...DEFAULT_CLOUD_LAYOUT_PARAMS },
    propertyTracks: [],
    ...overrides,
});

const makeWordTrack = (items: { id: string; text: string; startMs: number; endMs: number }[]): LyricTrack => ({
    id: 'word-track',
    name: 'Words',
    color: '#fff',
    kind: 'word',
    items,
    muted: false,
    solo: false,
    locked: false,
});

describe('cloud item resolvers', () => {
    describe('stay mode (default)', () => {
        it('keeps a word visible after its lyric item ends', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 0, endMs: 1000 },
            ]);
            const block = makeBlock({ params: { ...DEFAULT_CLOUD_LAYOUT_PARAMS, exitMode: 'stay' } });

            const frameAfterItemEnd = msToFrame(2000, FPS);
            const active = resolveCloudActiveItems(block, track, frameAfterItemEnd, FPS);

            expect(active).toHaveLength(1);
            expect(active[0].id).toBe('w1');
            expect(active[0].exitProgress).toBe(0);
        });

        it('does not show a word before its lyric start', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 2000, endMs: 3000 },
            ]);
            const block = makeBlock({ params: { ...DEFAULT_CLOUD_LAYOUT_PARAMS, exitMode: 'stay' } });

            const frameBefore = msToFrame(1000, FPS);
            const active = resolveCloudActiveItems(block, track, frameBefore, FPS);

            expect(active).toHaveLength(0);
        });

        it('resolveBlockItems returns all items in range regardless of frame', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 0, endMs: 1000 },
                { id: 'w2', text: 'world', startMs: 1000, endMs: 2000 },
                { id: 'w3', text: 'outside', startMs: 6000, endMs: 7000 },
            ]);
            const block = makeBlock();

            const allItems = resolveCloudBlockItems(block, track, msToFrame(500, FPS), FPS);

            expect(allItems).toHaveLength(2);
            expect(allItems.map((i) => i.id)).toEqual(['w1', 'w2']);
        });
    });

    describe('perItem mode', () => {
        it('exits a word after its lyric item ends (no delay)', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 0, endMs: 1000 },
            ]);
            const block = makeBlock({
                params: { ...DEFAULT_CLOUD_LAYOUT_PARAMS, exitMode: 'perItem', exitDelayMs: 0 },
            });

            const frameDuringItem = msToFrame(500, FPS);
            const activeDuring = resolveCloudActiveItems(block, track, frameDuringItem, FPS);
            expect(activeDuring).toHaveLength(1);

            const frameAfterItem = msToFrame(1500, FPS);
            const activeAfter = resolveCloudActiveItems(block, track, frameAfterItem, FPS);
            expect(activeAfter).toHaveLength(0);
        });

        it('keeps a word visible during exitDelayMs after item ends', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 0, endMs: 1000 },
            ]);
            const block = makeBlock({
                params: { ...DEFAULT_CLOUD_LAYOUT_PARAMS, exitMode: 'perItem', exitDelayMs: 2000 },
            });

            const frameInDelay = msToFrame(2500, FPS);
            const active = resolveCloudActiveItems(block, track, frameInDelay, FPS);
            expect(active).toHaveLength(1);
            expect(active[0].enterProgress).toBe(1);
        });

        it('treats exit delay as hold time for typewriter instead of slower typing', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 0, endMs: 1000 },
            ]);
            const block = makeBlock({
                params: {
                    ...DEFAULT_CLOUD_LAYOUT_PARAMS,
                    exitMode: 'perItem',
                    exitDelayMs: 2000,
                    textRevealMode: 'typewriter',
                },
            });

            const frameDuringTyping = msToFrame(250, FPS);
            const typingItems = resolveCloudBlockItems(block, track, frameDuringTyping, FPS);
            expect(typingItems).toHaveLength(1);
            expect(typingItems[0].textRevealEnterProgress).toBeGreaterThan(0);
            expect(typingItems[0].textRevealEnterProgress).toBeLessThan(1);

            const frameInDelayHold = msToFrame(2000, FPS);
            const heldItems = resolveCloudBlockItems(block, track, frameInDelayHold, FPS);
            expect(heldItems).toHaveLength(1);
            expect(heldItems[0].textRevealEnterProgress).toBe(1);
            expect(heldItems[0].textRevealExitProgress).toBe(0);

            const frameNearDelayedExit = msToFrame(2900, FPS);
            const exitingItems = resolveCloudBlockItems(block, track, frameNearDelayedExit, FPS);
            expect(exitingItems).toHaveLength(1);
            expect(exitingItems[0].textRevealExitProgress).toBeGreaterThan(0);
        });

        it('clamps effective endMs to block endMs', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 1000, endMs: 1500 },
            ]);
            const block = makeBlock({
                endMs: 10000,
                params: { ...DEFAULT_CLOUD_LAYOUT_PARAMS, exitMode: 'perItem', exitDelayMs: 99999 },
            });

            const midFrame = msToFrame(5000, FPS);
            const allItems = resolveCloudBlockItems(block, track, midFrame, FPS);
            expect(allItems).toHaveLength(1);
            expect(allItems[0].enterProgress).toBe(1);
            expect(allItems[0].exitProgress).toBe(0);
        });
    });

    describe('enter/exit progress computation', () => {
        it('computes enter progress for a word at the start of its range', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 1000, endMs: 3000 },
            ]);
            const block = makeBlock();

            const frameAtStart = msToFrame(1000, FPS);
            const items = resolveCloudBlockItems(block, track, frameAtStart, FPS);
            expect(items).toHaveLength(1);
            expect(items[0].enterProgress).toBeLessThan(1);
        });

        it('shows full enter progress mid-way through a word', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 0, endMs: 3000 },
            ]);
            const block = makeBlock();

            const frameMidway = msToFrame(2000, FPS);
            const items = resolveCloudBlockItems(block, track, frameMidway, FPS);
            expect(items).toHaveLength(1);
            expect(items[0].enterProgress).toBe(1);
        });

        it('keeps text reveal progress independent when motion channels are disabled', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 0, endMs: 3000 },
            ]);
            const block = makeBlock({
                enter: {
                    ...createDefaultCloudEnter(),
                    fade: { enabled: false, opacityStart: 1, opacityEnd: 1 },
                    move: { enabled: false, direction: 'up', distancePx: 24 },
                    scale: { enabled: false, amount: 0.12 },
                },
                params: {
                    ...DEFAULT_CLOUD_LAYOUT_PARAMS,
                    textRevealMode: 'typewriter',
                },
            });

            const frameAtStart = msToFrame(0, FPS);
            const items = resolveCloudBlockItems(block, track, frameAtStart, FPS);
            expect(items).toHaveLength(1);
            expect(items[0].enterProgress).toBe(1);
            expect(items[0].textRevealEnterProgress).toBe(0);
        });

        it('keeps text reveal progress when the shared All Off preset is used', () => {
            const track = makeWordTrack([
                { id: 'w1', text: 'hello', startMs: 0, endMs: 3000 },
            ]);
            const block = makeBlock({
                enter: createMotionAllOffEnterExit(createDefaultCloudEnter()),
                exit: createMotionAllOffEnterExit(createDefaultCloudExit()),
                params: {
                    ...DEFAULT_CLOUD_LAYOUT_PARAMS,
                    textRevealMode: 'typewriter',
                },
            });

            const frameAtStart = msToFrame(0, FPS);
            const items = resolveCloudBlockItems(block, track, frameAtStart, FPS);
            expect(items).toHaveLength(1);
            expect(items[0].enterProgress).toBe(1);
            expect(items[0].textRevealEnterProgress).toBe(0);
        });
    });

    it('returns empty for unsupported source tracks (sentence kind)', () => {
        const sentenceTrack: LyricTrack = {
            id: 'sentence-track',
            name: 'Sentences',
            color: '#fff',
            kind: 'sentence',
            items: [{ id: 's1', text: 'hello world', startMs: 0, endMs: 1000 }],
            muted: false,
            solo: false,
            locked: false,
        };
        const block = makeBlock({ sourceTrackId: 'sentence-track' });

        expect(resolveCloudActiveItems(block, sentenceTrack, 30, FPS)).toHaveLength(0);
        expect(resolveCloudBlockItems(block, sentenceTrack, 30, FPS)).toHaveLength(0);
    });
});
