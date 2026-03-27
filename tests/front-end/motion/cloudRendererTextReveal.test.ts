import { describe, expect, it, vi } from 'vitest';
import { CloudRenderer } from '@/front-end/motion-blocks/cloud/renderer/CloudRenderer';
import type { MotionBlock, MotionTrack, WolkProject } from '@/types/project_types';
import type { MotionRenderContext, ResolvedItem } from '@/front-end/motion-blocks/core/types';
import {
    createDefaultCloudEnter,
    createDefaultCloudExit,
    DEFAULT_CLOUD_STYLE,
    DEFAULT_CLOUD_TRANSFORM,
} from '@/front-end/motion-blocks/cloud/defaults';
import { DEFAULT_CLOUD_LAYOUT_PARAMS } from '@/front-end/motion-blocks/cloud/params';
import type { CloudLayoutParams } from '@/front-end/motion-blocks/cloud/params';

function createMockCtx() {
    const fillText = vi.fn();
    const strokeText = vi.fn();

    const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        fillText,
        strokeText,
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
        set textAlign(_v: string) {},
        set textBaseline(_v: string) {},
        set font(_v: string) {},
        set fillStyle(_v: string) {},
        set strokeStyle(_v: string) {},
        set lineWidth(_v: number) {},
        set lineJoin(_v: string) {},
        set globalAlpha(_v: number) {},
        set letterSpacing(_v: string) {},
    } as unknown as CanvasRenderingContext2D;

    return { ctx, fillText, strokeText };
}

function makeItem(overrides: Partial<ResolvedItem> = {}): ResolvedItem {
    return {
        id: 'item-1',
        text: 'HELLO',
        startMs: 0,
        endMs: 5000,
        enterProgress: 1,
        exitProgress: 0,
        textRevealEnterProgress: 1,
        textRevealExitProgress: 0,
        isActive: true,
        style: { ...DEFAULT_CLOUD_STYLE, color: '#ffffff' },
        transform: { ...DEFAULT_CLOUD_TRANSFORM },
        enter: createDefaultCloudEnter(),
        exit: createDefaultCloudExit(),
        ...overrides,
    };
}

function makeContext(
    item: ResolvedItem,
    params: Partial<CloudLayoutParams> = {},
): MotionRenderContext {
    return {
        project: {} as WolkProject,
        track: {} as MotionTrack,
        block: {
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
            params: { ...DEFAULT_CLOUD_LAYOUT_PARAMS, ...params },
            propertyTracks: [],
        } as MotionBlock,
        currentFrame: 0,
        fps: 60,
        canvasSize: { width: 1920, height: 1080 },
        allItems: [item],
    };
}

describe('CloudRenderer text reveal', () => {
    it('draws the full word when text reveal is off', () => {
        const renderer = new CloudRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem();

        renderer.render(ctx, [item], makeContext(item), {});

        expect(fillText).toHaveBeenCalled();
        expect(fillText.mock.calls.map((call) => call[0]).join('')).toContain('HELLO');
    });

    it('reveals only part of the word during enter when typewriter mode is enabled', () => {
        const renderer = new CloudRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem({ textRevealEnterProgress: 0.4, textRevealExitProgress: 0 });

        renderer.render(ctx, [item], makeContext(item, { textRevealMode: 'typewriter' }), {});

        expect(fillText).toHaveBeenCalled();
        const renderedText = fillText.mock.calls.map((call) => call[0]).join('');
        expect(renderedText.length).toBeGreaterThan(0);
        expect(renderedText.length).toBeLessThan('HELLO'.length);
    });

    it('deletes part of the word during exit when typewriter mode is enabled', () => {
        const renderer = new CloudRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem({ textRevealEnterProgress: 1, textRevealExitProgress: 0.6 });

        renderer.render(ctx, [item], makeContext(item, { textRevealMode: 'typewriter' }), {});

        expect(fillText).toHaveBeenCalled();
        const renderedText = fillText.mock.calls.map((call) => call[0]).join('');
        expect(renderedText.length).toBeGreaterThan(0);
        expect(renderedText.length).toBeLessThan('HELLO'.length);
    });

    it('finishes typing earlier when enterPortion < 1', () => {
        const renderer = new CloudRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem({ textRevealEnterProgress: 0.5, textRevealExitProgress: 0 });

        renderer.render(
            ctx,
            [item],
            makeContext(item, { textRevealMode: 'typewriter', textRevealEnterPortion: 0.5 }),
            {},
        );

        expect(fillText).toHaveBeenCalled();
        const renderedText = fillText.mock.calls.map((call) => call[0]).join('');
        expect(renderedText).toBe('HELLO');
    });

    it('finishes deleting earlier when exitPortion < 1', () => {
        const renderer = new CloudRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem({ textRevealEnterProgress: 1, textRevealExitProgress: 0.5 });

        renderer.render(
            ctx,
            [item],
            makeContext(item, { textRevealMode: 'typewriter', textRevealExitPortion: 0.5 }),
            {},
        );

        expect(fillText).not.toHaveBeenCalled();
    });

    it('keeps layout width stable while draw width changes during typewriter', () => {
        const renderer = new CloudRenderer();
        const { ctx } = createMockCtx();
        const itemFull = makeItem({ enterProgress: 1, exitProgress: 0 });
        const itemPartial = makeItem({ textRevealEnterProgress: 0.4, textRevealExitProgress: 0 });

        renderer.render(ctx, [itemFull], makeContext(itemFull, { textRevealMode: 'typewriter' }), {});
        const boundsFull = renderer.getLastBounds();

        renderer.render(ctx, [itemPartial], makeContext(itemPartial, { textRevealMode: 'typewriter' }), {});
        const boundsPartial = renderer.getLastBounds();

        expect(boundsFull).toBeTruthy();
        expect(boundsPartial).toBeTruthy();
        expect(boundsFull!.width).toBe(boundsPartial!.width);
    });

    it('uses reveal progress independently from motion progress', () => {
        const renderer = new CloudRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem({
            enterProgress: 1,
            exitProgress: 0,
            textRevealEnterProgress: 0.4,
            textRevealExitProgress: 0,
        });

        renderer.render(ctx, [item], makeContext(item, { textRevealMode: 'typewriter' }), {});

        const renderedText = fillText.mock.calls.map((call) => call[0]).join('');
        expect(renderedText).toBe('HE');
    });

    it('draws a cursor while typewriter reveal is active when enabled', () => {
        const renderer = new CloudRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem({ textRevealEnterProgress: 0.4, textRevealExitProgress: 0 });

        renderer.render(
            ctx,
            [item],
            makeContext(item, { textRevealMode: 'typewriter', textRevealShowCursor: true }),
            {},
        );

        expect(fillText.mock.calls.map((call) => call[0])).toContain('|');
    });

    it('does not draw a cursor before the word has started', () => {
        const renderer = new CloudRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem({
            enterProgress: 0,
            exitProgress: 0,
            textRevealEnterProgress: 0,
            textRevealExitProgress: 0,
            isActive: false,
        });

        renderer.render(
            ctx,
            [item],
            makeContext(item, { textRevealMode: 'typewriter', textRevealShowCursor: true }),
            {},
        );

        expect(fillText.mock.calls.map((call) => call[0])).not.toContain('|');
    });
});
