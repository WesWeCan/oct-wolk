import { describe, expect, it } from 'vitest';
import { primitive3dMotionBlockPlugin } from '@/front-end/motion-blocks';

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

const makeTrack = () => primitive3dMotionBlockPlugin.createTrack({
    project: makeProject(),
    startMs: 0,
    endMs: 1000,
    color: '#4fc3f7',
    trackId: 'track-1',
    blockId: 'block-1',
});

describe('primitive3d gizmo adapter', () => {
    it('reports fallback bounds from the projected object footprint', () => {
        const bounds = primitive3dMotionBlockPlugin.gizmo?.getFallbackBounds?.(makeTrack(), 1920, 1080);
        expect(bounds).not.toBeNull();
        expect(bounds?.referenceX).toBe(960);
        expect(bounds?.referenceY).toBe(540);
        expect(bounds?.localBoxWidth).toBeGreaterThan(100);
    });

    it('moves object position and returns params autokey paths', () => {
        const result = primitive3dMotionBlockPlugin.gizmo?.applyDelta?.(makeTrack(), 'move', 50, -20, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });

        expect(result?.track.block.params.object.positionX).toBeCloseTo(0.5);
        expect(result?.track.block.params.object.positionY).toBeCloseTo(0.2);
        expect(result?.autoKeyframePaths).toEqual(['params.object.positionX', 'params.object.positionY']);
    });

    it('returns object scale and rotation autokey paths', () => {
        const track = makeTrack();
        const scaled = primitive3dMotionBlockPlugin.gizmo?.applyDelta?.(track, 'scale', 40, -10, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });
        const rotated = primitive3dMotionBlockPlugin.gizmo?.applyDelta?.(track, 'rotate', 15, 10, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });

        expect(scaled?.autoKeyframePaths).toEqual(['params.object.scale']);
        expect(rotated?.autoKeyframePaths).toEqual(['params.object.rotationZ']);
    });
});
