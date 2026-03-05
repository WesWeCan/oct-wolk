import { describe, it, expect } from 'vitest';
import type { MotionTrack, MotionBlock } from '@/types/project_types';
import { DEFAULT_MOTION_STYLE, DEFAULT_MOTION_TRANSFORM, DEFAULT_MOTION_ENTER_EXIT } from '@/types/project_types';

/**
 * Extracted migration logic from ProjectEditor.vue's ensureMotionTrackDefaults.
 * We test the pure migration behavior here.
 */
function migrateMotionTrackDefaults(track: MotionTrack): MotionTrack {
    const block = { ...track.block };
    const style = block.style;
    const transform = block.transform;

    if ((style.boundsMode ?? 'safeArea') === 'safeArea' && transform.anchorX === 'center') {
        const textAlign = style.textAlign ?? 'center';
        if (textAlign === 'left' || textAlign === 'right') {
            block.transform = { ...transform, anchorX: textAlign };
        }
    }

    return {
        ...track,
        enabled: track.enabled !== false,
        muted: !!track.muted,
        solo: !!track.solo,
        locked: !!track.locked,
        block,
    };
}

function makeTrack(overrides: {
    style?: Partial<typeof DEFAULT_MOTION_STYLE>;
    transform?: Partial<typeof DEFAULT_MOTION_TRANSFORM>;
} = {}): MotionTrack {
    const block: MotionBlock = {
        id: 'block-1',
        type: 'subtitle',
        sourceTrackId: 'src-1',
        startMs: 0,
        endMs: 10000,
        style: { ...DEFAULT_MOTION_STYLE, ...overrides.style },
        transform: { ...DEFAULT_MOTION_TRANSFORM, ...overrides.transform },
        enter: { ...DEFAULT_MOTION_ENTER_EXIT, opacityStart: 0, opacityEnd: 1 },
        exit: { ...DEFAULT_MOTION_ENTER_EXIT, opacityStart: 1, opacityEnd: 0 },
        overrides: [],
        params: {},
        propertyTracks: [],
    };
    return {
        id: 'track-1',
        name: 'Track 1',
        color: '#4fc3f7',
        enabled: true,
        muted: false,
        solo: false,
        locked: false,
        collapsed: false,
        block,
    };
}

describe('motionTrack migration: anchorX from textAlign', () => {
    it('migrates anchorX to left when textAlign is left in safeArea mode', () => {
        const track = makeTrack({
            style: { boundsMode: 'safeArea', textAlign: 'left' },
            transform: { anchorX: 'center' },
        });
        const result = migrateMotionTrackDefaults(track);
        expect(result.block.transform.anchorX).toBe('left');
    });

    it('migrates anchorX to right when textAlign is right in safeArea mode', () => {
        const track = makeTrack({
            style: { boundsMode: 'safeArea', textAlign: 'right' },
            transform: { anchorX: 'center' },
        });
        const result = migrateMotionTrackDefaults(track);
        expect(result.block.transform.anchorX).toBe('right');
    });

    it('does not migrate when textAlign is center', () => {
        const track = makeTrack({
            style: { boundsMode: 'safeArea', textAlign: 'center' },
            transform: { anchorX: 'center' },
        });
        const result = migrateMotionTrackDefaults(track);
        expect(result.block.transform.anchorX).toBe('center');
    });

    it('does not migrate when anchorX is already non-center', () => {
        const track = makeTrack({
            style: { boundsMode: 'safeArea', textAlign: 'left' },
            transform: { anchorX: 'right' },
        });
        const result = migrateMotionTrackDefaults(track);
        expect(result.block.transform.anchorX).toBe('right');
    });

    it('does not migrate in free mode', () => {
        const track = makeTrack({
            style: { boundsMode: 'free', textAlign: 'left' },
            transform: { anchorX: 'center' },
        });
        const result = migrateMotionTrackDefaults(track);
        expect(result.block.transform.anchorX).toBe('center');
    });

    it('defaults boundsMode to safeArea when undefined', () => {
        const track = makeTrack({
            style: { textAlign: 'right' },
            transform: { anchorX: 'center' },
        });
        delete (track.block.style as any).boundsMode;
        const result = migrateMotionTrackDefaults(track);
        expect(result.block.transform.anchorX).toBe('right');
    });

    it('normalizes track boolean fields', () => {
        const track = makeTrack();
        (track as any).enabled = undefined;
        (track as any).muted = undefined;
        (track as any).solo = undefined;
        (track as any).locked = undefined;
        const result = migrateMotionTrackDefaults(track);
        expect(result.enabled).toBe(true);
        expect(result.muted).toBe(false);
        expect(result.solo).toBe(false);
        expect(result.locked).toBe(false);
    });

    it('does not mutate original track', () => {
        const track = makeTrack({
            style: { boundsMode: 'safeArea', textAlign: 'left' },
            transform: { anchorX: 'center' },
        });
        migrateMotionTrackDefaults(track);
        expect(track.block.transform.anchorX).toBe('center');
    });
});
