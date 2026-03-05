import { describe, it, expect, vi } from 'vitest';
import { SubtitleRenderer } from '@/front-end/motion/renderers/SubtitleRenderer';
import type { ResolvedItem, MotionRenderContext } from '@/front-end/motion/types';
import type { MotionBlock, MotionStyle, MotionTransform, MotionEnterExit, MotionTrack, WolkProject } from '@/types/project_types';
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
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
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
        enter: { ...DEFAULT_MOTION_ENTER_EXIT, opacityStart: 0, opacityEnd: 1 },
        exit: { ...DEFAULT_MOTION_ENTER_EXIT, opacityStart: 1, opacityEnd: 0 },
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

// With mock measureText returning 100, text "Hello" → maxLineWidth=100, pad=0
// fontSize=72, lineHeight=1.2 → lineHeightPx=86.4, totalTextHeight=86.4 (1 line)
// scale=1, so textAlign='center' → leftExtent=50, rightExtent=50, vertExtent=43.2

describe('SubtitleRenderer position resolution', () => {
    describe('safeArea mode — basic positioning', () => {
        it('center anchor + center textAlign → draw at canvas center', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            expect(bounds!.x).toBe(1920 / 2);
            expect(bounds!.anchorX).toBe('center');
            expect(bounds!.anchorY).toBe('center');
        });

        it('left anchor + left textAlign → draw at left safe area edge', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, textAlign: 'left' },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // textAlign='left': leftExtent=0, so drawX=40 is valid (minX=40)
            expect(bounds!.x).toBe(40);
            expect(bounds!.anchorX).toBe('left');
        });

        it('right anchor + right textAlign → draw at right safe area edge', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'right', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, textAlign: 'right' },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // textAlign='right': rightExtent=0, so drawX=1880 is valid (maxX=1880)
            expect(bounds!.x).toBe(1920 - 40);
            expect(bounds!.anchorX).toBe('right');
        });

        it('anchorY=top → draw at top safe area edge', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'top' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            expect(bounds!.y).toBe(40);
            expect(bounds!.anchorY).toBe('top');
        });

        it('anchorY=bottom → draw at bottom safe area edge', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'bottom' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            expect(bounds!.y).toBe(1080 - 40);
            expect(bounds!.anchorY).toBe('bottom');
        });

        it('applies offsetX/offsetY (center anchor, within bounds)', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center', offsetX: 10, offsetY: 20 },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // center anchor: drawX=960+10=970, drawY=540+20=560, both well within bounds
            expect(bounds!.x).toBe(960 + 10);
            expect(bounds!.y).toBe(540 + 20);
        });

        it('textAlign does NOT affect horizontal position (decoupled)', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const itemLeft = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'left' },
            });
            const itemRight = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'right' },
            });

            renderer.render(ctx, [itemLeft], makeContext(), {});
            const boundsLeft = renderer.getLastBounds();

            renderer.render(ctx, [itemRight], makeContext(), {});
            const boundsRight = renderer.getLastBounds();

            expect(boundsLeft!.x).toBe(boundsRight!.x);
            expect(boundsLeft!.x).toBe(1920 / 2);
        });
    });

    describe('safeArea mode — anchor point clamping', () => {
        it('clamps extreme positive offsetX to safe area right edge', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', offsetX: 9999 },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // saRight = 1920 - 40 = 1880
            expect(bounds!.x).toBe(1880);
        });

        it('clamps extreme negative offsetX to safe area left edge', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', offsetX: -9999 },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // saLeft = 40
            expect(bounds!.x).toBe(40);
        });

        it('clamps extreme offsetY to safe area bottom edge', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center', offsetY: 9999 },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // saBottom = 1080 - 40 = 1040
            expect(bounds!.y).toBe(1040);
        });

        it('left anchor with center textAlign: drawX at left safe area edge (no text-dimension shift)', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // Anchor point clamped to saLeft=40, text may overflow but anchor stays at edge
            expect(bounds!.x).toBe(40);
        });
    });

    describe('free mode', () => {
        it('uses anchorX and anchorY for position (no clamping)', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'top' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'free' },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            expect(bounds!.x).toBe(0);
            expect(bounds!.y).toBe(0);
            expect(bounds!.anchorX).toBe('center');
            expect(bounds!.anchorY).toBe('top');
        });
    });

    describe('lastBounds anchorX follows textAlign for gizmo alignment', () => {
        it('sets anchorX=left when textAlign=left', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'right' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'left' },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds!.anchorX).toBe('left');
        });

        it('sets anchorX=right when textAlign=right', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'right' },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds!.anchorX).toBe('right');
        });

        it('sets anchorX=center when textAlign=center', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'center' },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds!.anchorX).toBe('center');
        });

        it('sets anchorX=left when textAlign=justify (justify acts like left)', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'right' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'justify' },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds!.anchorX).toBe('left');
        });
    });

    describe('lastBounds.x accounts for background padding', () => {
        it('textAlign=left: boundsX shifts left by pad', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'left', backgroundPadding: 20 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // drawX=960 (center), boundsX = drawX - pad*totalScale = 960 - 20 = 940
            expect(bounds!.x).toBe(960 - 20);
            expect(bounds!.anchorX).toBe('left');
        });

        it('textAlign=right: boundsX shifts right by pad', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'right', backgroundPadding: 20 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // drawX=960, boundsX = drawX + pad*totalScale = 960 + 20 = 980
            expect(bounds!.x).toBe(960 + 20);
            expect(bounds!.anchorX).toBe('right');
        });

        it('textAlign=center: boundsX stays at drawX (no pad shift)', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', textAlign: 'center', backgroundPadding: 20 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            expect(bounds!.x).toBe(960);
        });
    });

    describe('safe area offsets', () => {
        it('safeAreaOffsetX shifts anchor position', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, safeAreaOffsetX: 100 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // saLeft=140, saRight=1980, center = (140+1980)/2 = 1060
            expect(bounds!.x).toBe(1060);
        });

        it('safeAreaOffsetY shifts anchor position', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'center', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, safeAreaOffsetY: -50 },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // saTop=-10, saBottom=990, center = (-10+990)/2 = 490
            expect(bounds!.y).toBe(490);
        });

        it('left anchor respects safeAreaOffsetX', () => {
            const renderer = new SubtitleRenderer();
            const ctx = createMockCtx();
            const item = makeItem({
                transform: { ...DEFAULT_MOTION_TRANSFORM, anchorX: 'left', anchorY: 'center' },
                style: { ...DEFAULT_MOTION_STYLE, boundsMode: 'safeArea', safeAreaPadding: 40, safeAreaOffsetX: 50, textAlign: 'left' },
            });
            renderer.render(ctx, [item], makeContext(), {});
            const bounds = renderer.getLastBounds();
            expect(bounds).not.toBeNull();
            // saLeft = 40 + 50 = 90, anchorX=left → drawX=90
            expect(bounds!.x).toBe(90);
        });
    });
});
