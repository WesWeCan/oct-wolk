import { describe, expect, it } from 'vitest';
import { primitive3dMotionBlockPlugin } from '@/front-end/motion-blocks';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';
import {
    createDefaultPrimitive3DEnter,
    createDefaultPrimitive3DExit,
} from '@/front-end/motion-blocks/primitive3d/defaults';
import { createMotionAllOffEnterExit } from '@/front-end/utils/motion/motionEnterExitPresets';
import { msToFrame } from '@/front-end/utils/motion/enterExitAnimation';

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
    createdAt: 0,
    updatedAt: 0,
});

describe('primitive3d motion block plugin', () => {
    it('accepts the MVP built-in primitive types', () => {
        const supportedTypes = [
            'sphere',
            'box',
            'plane',
            'cylinder',
            'cone',
            'torus',
            'icosahedron',
            'capsule',
            'tetrahedron',
            'octahedron',
            'dodecahedron',
        ] as const;

        for (const type of supportedTypes) {
            expect(resolvePrimitive3DParams({ primitive: { type } }).primitive.type).toBe(type);
        }
    });

    it('creates source-independent primitive tracks from defaults', () => {
        const track = primitive3dMotionBlockPlugin.createTrack({
            project: makeProject(),
            startMs: 100,
            endMs: 2000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        expect(track.block.type).toBe('primitive3d');
        expect(track.block.sourceTrackId).toBe('');
        expect(track.block.params.primitive.type).toBe('sphere');
        expect(track.block.params.primitive.sphereWidthSegments).toBe(8);
        expect(track.block.params.primitive.sphereHeightSegments).toBe(8);
        expect(track.block.params.primitive.boxWidth).toBe(2);
        expect(track.block.params.primitive.cylinderHeight).toBe(2);
        expect(track.block.params.primitive.cylinderRadialSegments).toBe(15);
        expect(track.block.params.primitive.coneRadialSegments).toBe(15);
        expect(track.block.params.primitive.torusTube).toBe(0.35);
        expect(track.block.params.primitive.torusRadialSegments).toBe(10);
        expect(track.block.params.primitive.torusTubularSegments).toBe(15);
        expect(track.block.params.primitive.capsuleCapSegments).toBe(9);
        expect(track.block.params.primitive.capsuleRadialSegments).toBe(9);
        expect(track.block.params.camera.distance).toBe(5.5);
        expect(track.block.params.lighting.mode).toBe('global');
        expect(track.block.params.material.renderMode).toBe('solid');
        expect(track.block.params.lifecycle.exitMode).toBe('stay');
        expect(track.block.params.lifecycle.exitDelayMs).toBe(0);
        expect(track.block.params.textReveal.textRevealMode).toBe('none');
        expect(track.block.params.textReveal.textRevealEnterWindow).toBe(0.3);
        expect(track.block.params.textReveal.textRevealExitWindow).toBe(0.2);
        expect(track.block.params.words.windowSize).toBe(4);
        expect(track.block.params.reaction.enabled).toBe(true);
        expect(track.block.params.reaction.smoothFacing).toBe(true);
        expect(track.block.style.fontFamily).toBe('system-ui');
    });

    it('normalizes params and prunes unsupported property tracks', () => {
        const project = makeProject();
        const track = primitive3dMotionBlockPlugin.createTrack({
            project,
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        (track as any).enabled = undefined;
        (track as any).muted = undefined;
        (track as any).solo = undefined;
        (track as any).locked = undefined;
        (track.block.params as any).object.scale = 999;
        (track.block.params as any).camera.distance = 999;
        (track.block.params as any).lighting.mode = 'wat';
        (track.block.params as any).material.renderMode = 'laser';
        (track.block.params as any).material.wireOpacity = 999;
        (track.block.params as any).primitive = {
            type: 'box',
            boxWidth: -1,
            boxHeight: 999,
            boxDepth: 'garbage',
            planeWidthSegments: 999,
            cylinderRadiusTop: -1,
            cylinderRadiusBottom: 999,
            cylinderHeight: -1,
            cylinderRadialSegments: 999,
            coneRadius: -1,
            coneHeight: 999,
            coneRadialSegments: 1,
            torusRadius: -1,
            torusTube: 999,
            torusRadialSegments: 1,
            torusTubularSegments: 999,
            capsuleRadius: -1,
            capsuleLength: 999,
            capsuleCapSegments: -1,
            capsuleRadialSegments: 999,
        };
        (track.block.params as any).textReveal = {
            textRevealMode: 'garbage',
            textRevealEnterWindow: -1,
            textRevealExitWindow: 5,
            textRevealEnterPortion: -1,
            textRevealExitPortion: 5,
        };
        (track.block.params as any).words.windowSize = 999;
        (track.block.params as any).words.worldSize = -5;
        (track.block.params as any).words.radialOffset = 999;
        (track.block.params as any).reaction.enabled = 'wat';
        (track.block.params as any).reaction.smoothFacing = 'wat';
        (track.block.params as any).reaction.smoothStrength = 999;
        (track.block.params as any).lifecycle = {
            exitMode: 'banana',
            exitDelayMs: 999999,
        };
        track.block.propertyTracks = [
            { propertyPath: 'params.object.positionX', keyframes: [], enabled: true } as any,
            { propertyPath: 'params.object.positionY', keyframes: [{ frame: 10, value: 1, interpolation: 'linear' }], enabled: true } as any,
            { propertyPath: 'params.camera.distance', keyframes: [{ frame: 10, value: 4, interpolation: 'linear' }], enabled: true } as any,
        ];

        const normalized = primitive3dMotionBlockPlugin.normalizeTrack(track, { project });

        expect(normalized.enabled).toBe(true);
        expect(normalized.muted).toBe(false);
        expect(normalized.solo).toBe(false);
        expect(normalized.locked).toBe(false);
        expect(normalized.block.params.object.scale).toBe(10);
        expect(normalized.block.params.primitive.type).toBe('box');
        expect(normalized.block.params.primitive.boxWidth).toBe(0.25);
        expect(normalized.block.params.primitive.boxHeight).toBe(10);
        expect(normalized.block.params.primitive.boxDepth).toBe(2);
        expect(normalized.block.params.primitive.planeWidthSegments).toBe(32);
        expect(normalized.block.params.primitive.cylinderRadiusTop).toBe(0.05);
        expect(normalized.block.params.primitive.cylinderRadiusBottom).toBe(6);
        expect(normalized.block.params.primitive.cylinderHeight).toBe(0.1);
        expect(normalized.block.params.primitive.cylinderRadialSegments).toBe(128);
        expect(normalized.block.params.primitive.coneRadius).toBe(0.05);
        expect(normalized.block.params.primitive.coneHeight).toBe(10);
        expect(normalized.block.params.primitive.coneRadialSegments).toBe(3);
        expect(normalized.block.params.primitive.torusRadius).toBe(0.1);
        expect(normalized.block.params.primitive.torusTube).toBe(3);
        expect(normalized.block.params.primitive.torusRadialSegments).toBe(3);
        expect(normalized.block.params.primitive.torusTubularSegments).toBe(128);
        expect(normalized.block.params.primitive.capsuleRadius).toBe(0.05);
        expect(normalized.block.params.primitive.capsuleLength).toBe(10);
        expect(normalized.block.params.primitive.capsuleCapSegments).toBe(1);
        expect(normalized.block.params.primitive.capsuleRadialSegments).toBe(64);
        expect(normalized.block.params.camera.distance).toBe(25);
        expect(normalized.block.params.lighting.mode).toBe('global');
        expect(normalized.block.params.material.renderMode).toBe('solid');
        expect(normalized.block.params.material.wireOpacity).toBe(1);
        expect(normalized.block.params.textReveal.textRevealMode).toBe('none');
        expect(normalized.block.params.textReveal.textRevealEnterWindow).toBe(0.01);
        expect(normalized.block.params.textReveal.textRevealExitWindow).toBe(1);
        expect(normalized.block.params.textReveal.textRevealEnterPortion).toBe(0.01);
        expect(normalized.block.params.textReveal.textRevealExitPortion).toBe(1);
        expect(normalized.block.params.words.windowSize).toBe(24);
        expect(normalized.block.params.words.worldSize).toBe(0.05);
        expect(normalized.block.params.words.radialOffset).toBe(4);
        expect(normalized.block.params.reaction.enabled).toBe(true);
        expect(normalized.block.params.reaction.smoothFacing).toBe(true);
        expect(normalized.block.params.reaction.smoothStrength).toBe(1);
        expect(normalized.block.params.lifecycle.exitMode).toBe('stay');
        expect(normalized.block.params.lifecycle.exitDelayMs).toBe(60000);
        expect(normalized.block.propertyTracks).toHaveLength(1);
        expect(normalized.block.propertyTracks[0].propertyPath).toBe('params.object.positionY');
    });

    it('preserves an explicit object follow off value during normalization', () => {
        const track = primitive3dMotionBlockPlugin.createTrack({
            project: makeProject(),
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        (track.block.params as any).reaction.enabled = false;

        const normalized = primitive3dMotionBlockPlugin.normalizeTrack(track, { project: makeProject() });

        expect(normalized.block.params.reaction.enabled).toBe(false);
    });

    it('collapses legacy transform values into object params during normalization', () => {
        const project = makeProject();
        const track = primitive3dMotionBlockPlugin.createTrack({
            project,
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        track.block.transform.offsetX = 200;
        track.block.transform.offsetY = -100;
        track.block.transform.scale = 2;
        track.block.transform.rotation = 45;

        const normalized = primitive3dMotionBlockPlugin.normalizeTrack(track, { project });

        expect(normalized.block.transform.offsetX).toBe(0);
        expect(normalized.block.transform.offsetY).toBe(0);
        expect(normalized.block.transform.scale).toBe(1);
        expect(normalized.block.transform.rotation).toBe(0);
        expect(normalized.block.params.object.positionX).toBeCloseTo(2);
        expect(normalized.block.params.object.positionY).toBeCloseTo(1);
        expect(normalized.block.params.object.scale).toBeCloseTo(2);
        expect(normalized.block.params.object.rotationZ).toBeCloseTo(45);
    });

    it('falls back unsupported primitive types to sphere', () => {
        expect(resolvePrimitive3DParams({ primitive: { type: 'banana' } }).primitive.type).toBe('sphere');
    });

    it('maps legacy sphereSegments into the new sphere segment fields', () => {
        const primitive = resolvePrimitive3DParams({
            primitive: {
                type: 'sphere',
                sphereSegments: 24,
            },
        }).primitive;

        expect(primitive.sphereWidthSegments).toBe(24);
        expect(primitive.sphereHeightSegments).toBe(24);
    });

    it('uses primitive point capacity for the word FIFO ring', () => {
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
                { id: 'w1', text: 'we', startMs: 0, endMs: 100 },
                { id: 'w2', text: 'came', startMs: 100, endMs: 200 },
                { id: 'w3', text: 'to', startMs: 200, endMs: 300 },
                { id: 'w4', text: 'fight', startMs: 300, endMs: 400 },
                { id: 'w5', text: 'tonight', startMs: 400, endMs: 500 },
                { id: 'w6', text: 'with', startMs: 500, endMs: 600 },
                { id: 'w7', text: 'all', startMs: 600, endMs: 700 },
                { id: 'w8', text: 'we', startMs: 700, endMs: 800 },
                { id: 'w9', text: 'have', startMs: 800, endMs: 900 },
                { id: 'w10', text: 'left', startMs: 900, endMs: 1000 },
            ],
        };
        const track = primitive3dMotionBlockPlugin.createTrack({
            project,
            sourceTrack,
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });
        track.block.params = resolvePrimitive3DParams({
            ...track.block.params,
            primitive: {
                ...track.block.params.primitive,
                type: 'box',
            },
            words: {
                enabled: true,
            },
        }) as any;

        const activeItems = primitive3dMotionBlockPlugin.resolveActiveItems(track.block, sourceTrack, 59, 60);

        expect(activeItems).toHaveLength(8);
        expect(activeItems.map((item) => item.text)).toEqual(['to', 'fight', 'tonight', 'with', 'all', 'we', 'have', 'left']);
        expect(activeItems.map((item) => item.richText?.primitive3dWord?.slotIndex)).toEqual([2, 3, 4, 5, 6, 7, 0, 1]);
        expect(activeItems.at(-1)?.richText?.primitive3dWord?.slotCount).toBe(8);
    });

    it('returns no word items when source track is missing', () => {
        const track = primitive3dMotionBlockPlugin.createTrack({
            project: makeProject(),
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });
        track.block.params = resolvePrimitive3DParams({
            ...track.block.params,
            words: {
                enabled: true,
                windowSize: 4,
            },
        }) as any;

        expect(primitive3dMotionBlockPlugin.resolveActiveItems(track.block, null, 10, 60)).toEqual([]);
    });

    it('keeps shared text reveal timing when primitive3d word motion is all off', () => {
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
                { id: 'w1', text: 'hello', startMs: 0, endMs: 1000 },
            ],
        };
        const track = primitive3dMotionBlockPlugin.createTrack({
            project,
            sourceTrack,
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });
        track.block.enter = createMotionAllOffEnterExit(createDefaultPrimitive3DEnter());
        track.block.exit = createMotionAllOffEnterExit(createDefaultPrimitive3DExit());
        track.block.params = resolvePrimitive3DParams({
            ...track.block.params,
            words: {
                ...track.block.params.words,
                enabled: true,
            },
            textReveal: {
                textRevealMode: 'typewriter',
                textRevealEnterWindow: 0.3,
                textRevealExitWindow: 0.2,
                textRevealEnterPortion: 0.3,
                textRevealExitPortion: 0.2,
                textRevealShowCursor: false,
            },
        }) as any;

        const activeItems = primitive3dMotionBlockPlugin.resolveActiveItems(track.block, sourceTrack, msToFrame(0, 60), 60);

        expect(activeItems).toHaveLength(1);
        expect(activeItems[0].enterProgress).toBe(1);
        expect(activeItems[0].textRevealEnterProgress).toBe(0);
    });

    it('treats primitive3d exit delay as hold time instead of slower typing', () => {
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
                { id: 'w1', text: 'hello', startMs: 0, endMs: 1000 },
            ],
        };
        const track = primitive3dMotionBlockPlugin.createTrack({
            project,
            sourceTrack,
            startMs: 0,
            endMs: 5000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });
        track.block.params = resolvePrimitive3DParams({
            ...track.block.params,
            words: {
                ...track.block.params.words,
                enabled: true,
            },
            lifecycle: {
                exitMode: 'perItem',
                exitDelayMs: 2000,
            },
            textReveal: {
                textRevealMode: 'typewriter',
                textRevealEnterWindow: 0.3,
                textRevealExitWindow: 0.2,
                textRevealEnterPortion: 1,
                textRevealExitPortion: 1,
                textRevealShowCursor: false,
            },
        }) as any;

        const typingItems = primitive3dMotionBlockPlugin.resolveBlockItems(track.block, sourceTrack, msToFrame(250, 60), 60);
        expect(typingItems).toHaveLength(1);
        expect(typingItems[0].textRevealEnterProgress).toBeGreaterThan(0);
        expect(typingItems[0].textRevealEnterProgress).toBeLessThan(1);

        const heldItems = primitive3dMotionBlockPlugin.resolveBlockItems(track.block, sourceTrack, msToFrame(2000, 60), 60);
        expect(heldItems).toHaveLength(1);
        expect(heldItems[0].textRevealEnterProgress).toBe(1);
        expect(heldItems[0].textRevealExitProgress).toBe(0);

        const exitingItems = primitive3dMotionBlockPlugin.resolveBlockItems(track.block, sourceTrack, msToFrame(2900, 60), 60);
        expect(exitingItems).toHaveLength(1);
        expect(exitingItems[0].textRevealExitProgress).toBeGreaterThan(0);
    });
});
