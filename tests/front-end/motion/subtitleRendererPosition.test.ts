import { describe, it, expect, vi } from 'vitest';
import { SubtitleRenderer } from '@/front-end/motion/renderers/SubtitleRenderer';
import type { ResolvedItem, MotionRenderContext } from '@/front-end/motion/types';
import type { MotionBlock, MotionTrack, WolkProject } from '@/types/project_types';
import { DEFAULT_MOTION_STYLE, DEFAULT_MOTION_TRANSFORM, DEFAULT_MOTION_ENTER_EXIT } from '@/types/project_types';

function createMockCtx(): CanvasRenderingContext2D {
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
        measureText: vi.fn(() => ({ width: 100 })),
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

function makeItem(overrides: Partial<ResolvedItem> = {}): ResolvedItem {
    return {
        id: 'item-1',
        text: 'Hello',
        startMs: 0,
        endMs: 5000,
        enterProgress: 1,
        exitProgress: 0,
        isActive: true,
        style: { ...DEFAULT_MOTION_STYLE },
        transform: { ...DEFAULT_MOTION_TRANSFORM },
        enter: {
            ...DEFAULT_MOTION_ENTER_EXIT,
            fade: { ...DEFAULT_MOTION_ENTER_EXIT.fade, opacityStart: 0, opacityEnd: 1 },
        },
        exit: {
            ...DEFAULT_MOTION_ENTER_EXIT,
            fade: { ...DEFAULT_MOTION_ENTER_EXIT.fade, opacityStart: 1, opacityEnd: 0 },
        },
        ...overrides,
    };
}

function makeContext(canvasWidth = 1920, canvasHeight = 1080): MotionRenderContext {
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

function renderBounds(item: ResolvedItem, canvasWidth = 1920, canvasHeight = 1080) {
    const renderer = new SubtitleRenderer();
    const ctx = createMockCtx();
    renderer.render(ctx, [item], makeContext(canvasWidth, canvasHeight), {});
    const bounds = renderer.getLastBounds();
    expect(bounds).not.toBeNull();
    return bounds!;
}

function expectContained(bounds: { x: number; y: number; width: number; height: number }, left: number, top: number, right: number, bottom: number) {
    expect(bounds.x).toBeGreaterThanOrEqual(left - 0.001);
    expect(bounds.y).toBeGreaterThanOrEqual(top - 0.001);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(right + 0.001);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(bottom + 0.001);
}

describe('SubtitleRenderer position resolution', () => {
    it('keeps the reference point stable across text alignment changes', () => {
        const leftBounds = renderBounds(makeItem({
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center' },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'left' },
        }));
        const rightBounds = renderBounds(makeItem({
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center' },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'right' },
        }));

        expect(leftBounds.referenceX).toBe(960);
        expect(leftBounds.referenceY).toBe(540);
        expect(rightBounds.referenceX).toBe(960);
        expect(rightBounds.referenceY).toBe(540);
        expect('anchorX' in leftBounds).toBe(false);
    });

    it('uses the constraint region width for wrapping long text', () => {
        const bounds = renderBounds(makeItem({
            text: 'alpha beta gamma',
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 150, wrapMode: 'word' },
        }), 600, 1200);

        expect(bounds.localBoxWidth).toBeLessThanOrEqual(320);
        expect(bounds.localBoxHeight).toBeGreaterThan(86.4);
        expectContained(bounds, 150, 150, 450, 1050);
    });

    it('keeps short, sentence, and verse sized content contained with the same reference point', () => {
        const shortBounds = renderBounds(makeItem({
            text: 'Word',
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'top' },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, textAlign: 'left' },
        }));
        const sentenceBounds = renderBounds(makeItem({
            text: 'alpha beta gamma delta',
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'top' },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, textAlign: 'left' },
        }));
        const verseBounds = renderBounds(makeItem({
            text: 'alpha beta gamma delta epsilon zeta eta theta iota',
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'top' },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, textAlign: 'left', wrapMode: 'word', maxLines: 5 },
        }));

        expect(shortBounds.referenceX).toBe(40);
        expect(sentenceBounds.referenceX).toBe(40);
        expect(verseBounds.referenceX).toBe(40);
        expectContained(shortBounds, 40, 40, 1880, 1040);
        expectContained(sentenceBounds, 40, 40, 1880, 1040);
        expectContained(verseBounds, 40, 40, 1880, 1040);
    });

    it('shifts the text box to preserve containment without moving the reference point', () => {
        const bounds = renderBounds(makeItem({
            text: 'alpha beta gamma delta epsilon zeta',
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'center' },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, textAlign: 'center' },
        }));

        expect(bounds.referenceX).toBe(40);
        expectContained(bounds, 40, 40, 1880, 1040);
        expect(bounds.localBoxX).toBeGreaterThan(-bounds.localBoxWidth / 2);
    });

    it('keeps scaled content inside the constraint region', () => {
        const bounds = renderBounds(makeItem({
            text: 'Hello',
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'right', anchorY: 'center', scale: 3 },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, textAlign: 'center' },
        }));

        expect(bounds.referenceX).toBe(1880);
        expectContained(bounds, 40, 40, 1880, 1040);
    });

    it('clamps an extreme reference point offset back into the constraint region', () => {
        const bounds = renderBounds(makeItem({
            text: 'Hello',
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center', offsetX: 9999, offsetY: -9999 },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, textAlign: 'center' },
        }));

        expect(bounds.referenceX).toBe(1880);
        expect(bounds.referenceY).toBe(40);
        expectContained(bounds, 40, 40, 1880, 1040);
    });

    it('keeps rotated content inside the constraint region using the final visible AABB', () => {
        const bounds = renderBounds(makeItem({
            text: 'Hello',
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'top', rotation: 45 },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, backgroundPadding: 20, textAlign: 'left' },
        }));

        expect(bounds.referenceX).toBe(40);
        expect(bounds.referenceY).toBe(40);
        expectContained(bounds, 40, 40, 1880, 1040);
    });

    it('still contains scaled and rotated content when the requested reference point is off-region', () => {
        const bounds = renderBounds(makeItem({
            text: 'Hello',
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'right', anchorY: 'bottom', offsetX: 500, offsetY: 500, scale: 2.5, rotation: 30 },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, backgroundPadding: 20, textAlign: 'right' },
        }));

        expect(bounds.referenceX).toBe(1880);
        expect(bounds.referenceY).toBe(1040);
        expectContained(bounds, 40, 40, 1880, 1040);
    });

    it('applies constraint region offsets to the stable reference point', () => {
        const bounds = renderBounds(makeItem({
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center' },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, safeAreaOffsetX: 100, safeAreaOffsetY: -50 },
        }));

        expect(bounds.referenceX).toBe(1060);
        expect(bounds.referenceY).toBe(490);
    });

    it('does not clamp the reference point in free mode', () => {
        const bounds = renderBounds(makeItem({
            transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'top', offsetX: 400, offsetY: 300 },
            style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'free', textAlign: 'left' },
        }));

        expect(bounds.referenceX).toBe(400);
        expect(bounds.referenceY).toBe(300);
        expect(bounds.x).toBe(400);
        expect(bounds.y).toBe(300);
    });
});
