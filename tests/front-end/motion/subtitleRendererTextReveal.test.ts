import { describe, expect, it, vi } from 'vitest';
import { SubtitleRenderer } from '@/front-end/motion-blocks/subtitle/renderer/SubtitleRenderer';
import type { MotionBlock, MotionTrack, WolkProject } from '@/types/project_types';
import type { MotionRenderContext, ResolvedItem } from '@/front-end/motion-blocks/core/types';
import {
    createDefaultSubtitleEnter,
    createDefaultSubtitleExit,
    DEFAULT_SUBTITLE_STYLE,
    DEFAULT_SUBTITLE_TRANSFORM,
} from '@/front-end/motion-blocks/subtitle/defaults';
import { DEFAULT_TEXT_REVEAL_PARAMS } from '@/front-end/utils/motion/textReveal';

function createMockCtx() {
    const fillText = vi.fn();

    const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        fillText,
        strokeText: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        roundRect: vi.fn(),
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

    return { ctx, fillText };
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
        style: { ...DEFAULT_SUBTITLE_STYLE, color: '#ffffff' },
        transform: { ...DEFAULT_SUBTITLE_TRANSFORM },
        enter: createDefaultSubtitleEnter(),
        exit: createDefaultSubtitleExit(),
        ...overrides,
    };
}

function makeContext(item: ResolvedItem, params: Record<string, any> = {}): MotionRenderContext {
    return {
        project: {} as WolkProject,
        track: {} as MotionTrack,
        block: {
            id: 'block-1',
            type: 'subtitle',
            sourceTrackId: 'word-track',
            startMs: 0,
            endMs: 5000,
            style: { ...DEFAULT_SUBTITLE_STYLE },
            transform: { ...DEFAULT_SUBTITLE_TRANSFORM },
            enter: createDefaultSubtitleEnter(),
            exit: createDefaultSubtitleExit(),
            overrides: [],
            params: { ...DEFAULT_TEXT_REVEAL_PARAMS, ...params },
            propertyTracks: [],
        } as MotionBlock,
        currentFrame: 0,
        fps: 60,
        canvasSize: { width: 1920, height: 1080 },
        allItems: [item],
    };
}

describe('SubtitleRenderer text reveal', () => {
    it('draws the full subtitle when text reveal is off', () => {
        const renderer = new SubtitleRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem();

        renderer.render(ctx, [item], makeContext(item), {});

        expect(fillText).toHaveBeenCalled();
        expect(fillText.mock.calls.map((call) => call[0]).join('')).toContain('HELLO');
    });

    it('reveals only part of the subtitle during enter', () => {
        const renderer = new SubtitleRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem({ textRevealEnterProgress: 0.4, textRevealExitProgress: 0 });

        renderer.render(ctx, [item], makeContext(item, { textRevealMode: 'typewriter' }), {});

        const renderedText = fillText.mock.calls.map((call) => call[0]).join('');
        expect(renderedText.length).toBeGreaterThan(0);
        expect(renderedText.length).toBeLessThan('HELLO'.length);
    });

    it('reveals only part of the subtitle during exit', () => {
        const renderer = new SubtitleRenderer();
        const { ctx, fillText } = createMockCtx();
        const item = makeItem({ textRevealEnterProgress: 1, textRevealExitProgress: 0.6 });

        renderer.render(ctx, [item], makeContext(item, { textRevealMode: 'typewriter' }), {});

        const renderedText = fillText.mock.calls.map((call) => call[0]).join('');
        expect(renderedText.length).toBeGreaterThan(0);
        expect(renderedText.length).toBeLessThan('HELLO'.length);
    });

    it('uses reveal progress independently from motion progress', () => {
        const renderer = new SubtitleRenderer();
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
        const renderer = new SubtitleRenderer();
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
});
