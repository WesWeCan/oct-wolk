import { describe, expect, it } from 'vitest';
import { cloudMotionBlockPlugin } from '@/front-end/motion-blocks';

const makeTrack = () => cloudMotionBlockPlugin.createTrack({
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

describe('cloud gizmo adapter', () => {
    it('reports fallback bounds matching the constraint region (identity transform)', () => {
        const track = makeTrack();
        const bounds = cloudMotionBlockPlugin.gizmo?.getFallbackBounds?.(track, 1920, 1080);
        expect(bounds).not.toBeNull();
        expect(bounds?.referenceX).toBe(960);
        expect(bounds?.referenceY).toBe(540);
        expect(bounds?.localBoxWidth).toBe(1840);
        expect(bounds?.localBoxHeight).toBe(1000);
        expect(bounds?.rotation).toBe(0);
        expect(bounds?.scale).toBe(1);
        expect(bounds?.x).toBe(40);
        expect(bounds?.y).toBe(40);
    });

    it('move adjusts safeAreaOffsetX/Y and clamps within padding', () => {
        const track = makeTrack();
        const result = cloudMotionBlockPlugin.gizmo?.applyDelta?.(track, 'move', 9999, -9999, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });

        expect(result).toBeTruthy();
        const padding = result!.track.block.style.safeAreaPadding ?? 40;
        expect(result?.track.block.style.safeAreaOffsetX).toBe(padding);
        expect(result?.track.block.style.safeAreaOffsetY).toBe(-padding);
        expect(result?.autoKeyframePaths).toEqual(['style.safeAreaOffsetX', 'style.safeAreaOffsetY']);
    });

    it('scale resizes the constraint region via safeAreaPadding', () => {
        const track = makeTrack();
        const scaled = cloudMotionBlockPlugin.gizmo?.applyDelta?.(track, 'scale', 50, 0, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });

        expect(scaled?.track.block.style.safeAreaPadding).toBeLessThan(40);
        expect(scaled?.autoKeyframePaths).toEqual(['style.safeAreaPadding']);
    });

    it('scale clamps existing offset when padding shrinks', () => {
        const track = makeTrack();
        track.block.style.safeAreaPadding = 40;
        track.block.style.safeAreaOffsetX = 35;

        const scaled = cloudMotionBlockPlugin.gizmo?.applyDelta?.(track, 'scale', 30, 0, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });

        const newPadding = scaled!.track.block.style.safeAreaPadding!;
        expect(scaled?.track.block.style.safeAreaOffsetX).toBeLessThanOrEqual(newPadding);
    });

    it('rotate is a no-op and returns empty autokey paths', () => {
        const track = makeTrack();
        const rotated = cloudMotionBlockPlugin.gizmo?.applyDelta?.(track, 'rotate', 15, 0, {
            renderWidth: 1920,
            renderHeight: 1080,
            currentBounds: null,
            currentFrame: 0,
        });

        expect(rotated?.autoKeyframePaths).toEqual([]);
        expect(rotated?.track.block.transform.rotation).toBe(0);
    });
});
