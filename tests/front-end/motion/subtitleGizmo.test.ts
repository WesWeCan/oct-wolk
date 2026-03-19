import { describe, expect, it } from 'vitest';
import { subtitleMotionBlockPlugin } from '@/front-end/motion-blocks';

const makeTrack = () => subtitleMotionBlockPlugin.createTrack({
    project: {
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
    },
    sourceTrack: {
        id: 'lyric-1',
        name: 'Words',
        color: '#fff',
        kind: 'word' as const,
        items: [],
        muted: false,
        solo: false,
        locked: false,
    },
    startMs: 0,
    endMs: 1000,
    color: '#4fc3f7',
    trackId: 'track-1',
    blockId: 'block-1',
});

describe('subtitle gizmo adapter', () => {
    it('reports fallback bounds from subtitle layout assumptions', () => {
        const track = makeTrack();
        const bounds = subtitleMotionBlockPlugin.gizmo?.getFallbackBounds?.(track, 1920, 1080);
        expect(bounds).not.toBeNull();
        expect(bounds?.referenceX).toBe(960);
        expect(bounds?.referenceY).toBe(540);
    });

    it('clamps move deltas to the constraint region and returns autokey paths', () => {
        const track = makeTrack();
        const result = subtitleMotionBlockPlugin.gizmo?.applyDelta?.(track, 'move', 9999, -9999, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });

        expect(result).toBeTruthy();
        expect(result?.track.block.transform.offsetX).toBeLessThanOrEqual(920);
        expect(result?.track.block.transform.offsetY).toBeGreaterThanOrEqual(-500);
        expect(result?.autoKeyframePaths).toEqual(['transform.offsetX', 'transform.offsetY']);
    });

    it('returns scale and rotate autokey paths for their respective modes', () => {
        const track = makeTrack();
        const scaled = subtitleMotionBlockPlugin.gizmo?.applyDelta?.(track, 'scale', 50, 0, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });
        const rotated = subtitleMotionBlockPlugin.gizmo?.applyDelta?.(track, 'rotate', 15, 0, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });

        expect(scaled?.autoKeyframePaths).toEqual(['transform.scale']);
        expect(rotated?.autoKeyframePaths).toEqual(['transform.rotation']);
    });
});
