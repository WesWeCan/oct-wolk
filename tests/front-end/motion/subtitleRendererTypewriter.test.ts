import { describe, expect, it, vi } from 'vitest';
import { SubtitleRenderer } from '@/front-end/motion-blocks/subtitle/renderer/SubtitleRenderer';
import type { MotionBlock, MotionTrack, WolkProject } from '@/types/project_types';
import type { MotionRenderContext, ResolvedItem } from '@/front-end/motion-blocks/core/types';
import {
    DEFAULT_SUBTITLE_ENTER_EXIT,
    DEFAULT_SUBTITLE_STYLE,
    DEFAULT_SUBTITLE_TRANSFORM,
} from '@/front-end/motion-blocks/subtitle/defaults';

function createMockCtx() {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        clearRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
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
        setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
}

function makeTypewriterEnterExit(which: 'enter' | 'exit') {
    return {
        ...DEFAULT_SUBTITLE_ENTER_EXIT,
        showCursor: false,
        fade: {
            ...DEFAULT_SUBTITLE_ENTER_EXIT.fade,
            enabled: false,
            opacityStart: 1,
            opacityEnd: 1,
        },
        move: {
            ...DEFAULT_SUBTITLE_ENTER_EXIT.move,
            enabled: false,
        },
        scale: {
            ...DEFAULT_SUBTITLE_ENTER_EXIT.scale,
            enabled: false,
        },
        style: 'typewriter' as const,
        opacityStart: 1,
        opacityEnd: 1,
        ...(which === 'exit' ? {} : {}),
    };
}

function makeItem(overrides: Partial<ResolvedItem> = {}): ResolvedItem {
    return {
        id: 'item-1',
        text: 'WOLK',
        startMs: 0,
        endMs: 1000,
        enterProgress: 1,
        exitProgress: 0,
        isActive: true,
        style: { ...DEFAULT_SUBTITLE_STYLE },
        transform: { ...DEFAULT_SUBTITLE_TRANSFORM },
        enter: { ...DEFAULT_SUBTITLE_ENTER_EXIT },
        exit: { ...DEFAULT_SUBTITLE_ENTER_EXIT, fade: { ...DEFAULT_SUBTITLE_ENTER_EXIT.fade, opacityStart: 1, opacityEnd: 0 } },
        ...overrides,
    };
}

function makeContext(canvasWidth = 300, canvasHeight = 200): MotionRenderContext {
    return {
        project: {} as WolkProject,
        track: {} as MotionTrack,
        block: {} as MotionBlock,
        currentFrame: 0,
        fps: 60,
        canvasSize: { width: canvasWidth, height: canvasHeight },
        allItems: [],
    };
}

describe('SubtitleRenderer typewriter effect', () => {
    it('reveals visible letters from left to right during enter', () => {
        const renderer = new SubtitleRenderer();
        const ctx = createMockCtx();

        renderer.render(ctx, [makeItem({
            text: 'WOLK',
            enterProgress: 0.5,
            enter: makeTypewriterEnterExit('enter'),
        })], makeContext(), {});

        const drawnText = (ctx.fillText as any).mock.calls.map((call: [string]) => call[0]).join('');
        expect(drawnText).toBe('WO');
    });

    it('hides letters from right to left across wrapped lines during exit', () => {
        const renderer = new SubtitleRenderer();
        const ctx = createMockCtx();

        renderer.render(ctx, [makeItem({
            text: 'AB CD',
            enter: makeTypewriterEnterExit('enter'),
            exit: makeTypewriterEnterExit('exit'),
            enterProgress: 1,
            exitProgress: 0.5,
            style: {
                ...DEFAULT_SUBTITLE_STYLE,
                boundsMode: 'safeArea',
                wrapMode: 'word',
                safeAreaPadding: 10,
                textAlign: 'left',
            },
            transform: {
                ...DEFAULT_SUBTITLE_TRANSFORM,
                anchorX: 'left',
                anchorY: 'top',
            },
        })], makeContext(50, 120), {});

        const fillCalls = (ctx.fillText as any).mock.calls as Array<[string, number, number]>;
        const drawnText = fillCalls.map((call) => call[0]).join('');
        const yPositions = new Set(fillCalls.map((call) => call[2]));

        expect(drawnText).toBe('AB');
        expect(yPositions.size).toBe(1);
    });

    it('treats spaces and punctuation as backspace steps', () => {
        const renderer = new SubtitleRenderer();
        const ctx = createMockCtx();

        renderer.render(ctx, [makeItem({
            text: 'AB, C!',
            enter: makeTypewriterEnterExit('enter'),
            exit: makeTypewriterEnterExit('exit'),
            enterProgress: 1,
            exitProgress: 0.5,
        })], makeContext(), {});

        const drawnText = ((ctx.fillText as any).mock.calls as Array<[string]>).map((call) => call[0]).join('');

        expect(drawnText).toBe('AB,');
    });

    it('draws a cursor while typing and deleting when enabled', () => {
        const renderer = new SubtitleRenderer();
        const ctx = createMockCtx();

        renderer.render(ctx, [makeItem({
            text: 'WOLK',
            enterProgress: 0.5,
            enter: {
                ...makeTypewriterEnterExit('enter'),
                showCursor: true,
            },
        })], makeContext(), {});

        renderer.render(ctx, [makeItem({
            text: 'WOLK',
            enterProgress: 1,
            exitProgress: 0.5,
            enter: {
                ...makeTypewriterEnterExit('enter'),
                showCursor: true,
            },
            exit: {
                ...makeTypewriterEnterExit('exit'),
                showCursor: true,
            },
        })], makeContext(), {});

        const drawnText = ((ctx.fillText as any).mock.calls as Array<[string]>).map((call) => call[0]).join('');

        expect(drawnText).toContain('|');
    });
});
