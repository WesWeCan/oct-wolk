import { describe, expect, it } from 'vitest';
import { primitive3dMotionBlockPlugin } from '@/front-end/motion-blocks';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';

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
        expect(track.block.params.camera.distance).toBe(5.5);
        expect(track.block.params.lighting.mode).toBe('global');
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
        expect(normalized.block.params.camera.distance).toBe(25);
        expect(normalized.block.params.lighting.mode).toBe('global');
        expect(normalized.block.propertyTracks).toHaveLength(1);
        expect(normalized.block.propertyTracks[0].propertyPath).toBe('params.object.positionY');
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
});
