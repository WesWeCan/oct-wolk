import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { Primitive3DRenderer } from '@/front-end/motion-blocks/primitive3d/renderer/Primitive3DRenderer';
import { primitive3dMotionBlockPlugin } from '@/front-end/motion-blocks';
import {
    createDefaultPrimitive3DEnter,
    createDefaultPrimitive3DExit,
} from '@/front-end/motion-blocks/primitive3d/defaults';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';
import { createMotionAllOffEnterExit } from '@/front-end/utils/motion/motionEnterExitPresets';
import { normalizeScene3DSettings } from '@/front-end/utils/projectScene3D';
import type { MotionRenderContext, ResolvedItem } from '@/front-end/motion-blocks/core/types';

const makeProject = () => ({
    id: 'project-1',
    version: 2 as const,
    song: { title: 'Song', audioSrc: '' },
    settings: { fps: 60, renderWidth: 1920, renderHeight: 1080, seed: 'seed', durationMs: 30000 },
    font: { family: 'system-ui', fallbacks: ['sans-serif'], style: 'normal' as const, weight: 400 },
    rawLyrics: '',
    lyricTracks: [],
    motionTracks: [],
    backgroundColor: '#000000',
    backgroundImageFit: 'cover' as const,
    scene3d: normalizeScene3DSettings({ enabled: true }),
    createdAt: 0,
    updatedAt: 0,
});

const makeTrack = () => primitive3dMotionBlockPlugin.createTrack({
    project: makeProject(),
    startMs: 0,
    endMs: 1000,
    color: '#4fc3f7',
    trackId: 'track-1',
    blockId: 'block-1',
});

const createMockCtx = () => ({
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    set fillStyle(_value: string) {},
    set globalAlpha(_value: number) {},
}) as unknown as CanvasRenderingContext2D;

const makeContext = (): MotionRenderContext => {
    const track = makeTrack();
    return {
        project: makeProject() as any,
        track: track as any,
        block: track.block as any,
        currentFrame: 0,
        fps: 60,
        canvasSize: { width: 1920, height: 1080 },
        allItems: [],
    };
};

const makeResolvedItem = (track = makeTrack(), overrides: Partial<ResolvedItem> = {}): ResolvedItem => ({
    id: 'item-1',
    text: 'HELLO',
    startMs: 0,
    endMs: 1000,
    enterProgress: 1,
    exitProgress: 0,
    textRevealEnterProgress: 1,
    textRevealExitProgress: 0,
    isActive: true,
    style: { ...track.block.style },
    transform: { ...track.block.transform },
    enter: createDefaultPrimitive3DEnter(),
    exit: createDefaultPrimitive3DExit(),
    ...overrides,
});

describe('Primitive3DRenderer', () => {
    it('renders safely and reports bounds', () => {
        const renderer = new Primitive3DRenderer();
        const track = makeTrack();
        const ctx = createMockCtx();

        renderer.prepare(track.block);
        renderer.render(ctx, primitive3dMotionBlockPlugin.resolveActiveItems(track.block, null, 0, 60), makeContext(), {});

        expect(renderer.getLastBounds()).not.toBeNull();
        renderer.dispose();
    });

    it('renders safely with wireframe and word sprites enabled', () => {
        const renderer = new Primitive3DRenderer();
        const project = makeProject();
        const sourceTrack = {
            id: 'lyric-1',
            name: 'Words',
            color: '#ffffff',
            kind: 'word' as const,
            muted: false,
            solo: false,
            locked: false,
            items: [
                { id: 'w1', text: 'hello', startMs: 0, endMs: 100 },
                { id: 'w2', text: 'world', startMs: 100, endMs: 200 },
            ],
        };
        const track = primitive3dMotionBlockPlugin.createTrack({
            project: project as any,
            sourceTrack,
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });
        track.block.params = resolvePrimitive3DParams({
            ...track.block.params,
            material: {
                ...track.block.params.material,
                renderMode: 'solid-wireframe',
            },
            words: {
                enabled: true,
                windowSize: 2,
                worldSize: 0.8,
                radialOffset: 0.5,
            },
        }) as any;
        const ctx = createMockCtx();
        const activeItems = primitive3dMotionBlockPlugin.resolveActiveItems(track.block, sourceTrack, 12, 60);
        const context = makeContext();
        context.project = project as any;
        context.track = track as any;
        context.block = track.block as any;

        renderer.prepare(track.block);
        renderer.render(ctx, activeItems, context, {});

        expect(renderer.getLastBounds()).not.toBeNull();
        renderer.dispose();
    });

    it('rebuilds geometry when expanded primitive params change', () => {
        const renderer = new Primitive3DRenderer() as any;
        const initialGeometry = new BoxGeometry(1, 1, 1);
        renderer.mesh = new Mesh(initialGeometry, new MeshBasicMaterial());
        renderer.wireMesh = new Mesh(initialGeometry, new MeshBasicMaterial());

        const boxParams = resolvePrimitive3DParams({
            primitive: {
                type: 'box',
                boxWidth: 2,
                boxHeight: 2,
                boxDepth: 2,
            },
        });
        renderer.ensureGeometry(boxParams);
        const firstGeometry = renderer.mesh.geometry;

        const updatedParams = resolvePrimitive3DParams({
            primitive: {
                type: 'box',
                boxWidth: 4,
                boxHeight: 1.5,
                boxDepth: 3,
            },
        });
        renderer.ensureGeometry(updatedParams);

        expect(renderer.mesh.geometry).not.toBe(firstGeometry);
        expect(renderer.mesh.geometry.parameters).toMatchObject({
            width: 4,
            height: 1.5,
            depth: 3,
        });
    });

    it('uses geometry dimensions for fallback bounds', () => {
        const renderer = new Primitive3DRenderer() as any;
        const ctx = createMockCtx();
        const planeBounds = renderer.drawVisibleFallback(
            ctx,
            resolvePrimitive3DParams({
                primitive: {
                    type: 'plane',
                    planeWidth: 6,
                    planeHeight: 2,
                },
            }),
            1920,
            1080,
            1,
        );

        expect(planeBounds.width).toBeGreaterThan(planeBounds.height);
    });

    it('reveals only part of the visible word text during typewriter enter', () => {
        const renderer = new Primitive3DRenderer();
        const item = makeResolvedItem(undefined, {
            textRevealEnterProgress: 0.4,
            textRevealExitProgress: 0,
        });

        const visibleText = (renderer as any).resolveVisibleWordText(item, resolvePrimitive3DParams({
            textReveal: { textRevealMode: 'typewriter' },
        }));

        expect(visibleText).toBe('HE');
    });

    it('keeps typewriter reveal working when primitive3d motion visuals are off', () => {
        const renderer = new Primitive3DRenderer();
        const item = makeResolvedItem(undefined, {
            textRevealEnterProgress: 0.4,
            textRevealExitProgress: 0,
            enter: createMotionAllOffEnterExit(createDefaultPrimitive3DEnter()),
            exit: createMotionAllOffEnterExit(createDefaultPrimitive3DExit()),
        });

        const visibleText = (renderer as any).resolveVisibleWordText(item, resolvePrimitive3DParams({
            textReveal: { textRevealMode: 'typewriter' },
        }));

        expect(visibleText).toBe('HE');
    });
});
