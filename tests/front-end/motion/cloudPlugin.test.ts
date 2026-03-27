import { describe, expect, it } from 'vitest';
import { cloudMotionBlockPlugin } from '@/front-end/motion-blocks';

const makeProject = () => ({
    id: 'project-1',
    version: 2 as const,
    song: { title: 'Song', audioSrc: '' },
    settings: { fps: 60, renderWidth: 1920, renderHeight: 1080, seed: 'seed', durationMs: 30000 },
    font: { family: 'ProjectFont', fallbacks: ['Arial'], style: 'italic' as const, weight: 700, name: 'Project Font', localPath: '/font.otf' },
    rawLyrics: '',
    lyricTracks: [],
    motionTracks: [],
    backgroundColor: '#000000',
    backgroundImageFit: 'cover' as const,
    createdAt: 0,
    updatedAt: 0,
});

const makeSourceTrack = () => ({
    id: 'lyric-1',
    name: 'Line Track',
    color: '#fff',
    kind: 'word' as const,
    items: [],
    muted: false,
    solo: false,
    locked: false,
});

describe('cloud motion block plugin', () => {
    it('creates cloud tracks from plugin defaults and project font settings', () => {
        const track = cloudMotionBlockPlugin.createTrack({
            project: makeProject(),
            sourceTrack: makeSourceTrack(),
            startMs: 100,
            endMs: 2000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        expect(track.block.type).toBe('cloud');
        expect(track.block.sourceTrackId).toBe('lyric-1');
        expect(track.block.style.fontFamily).toBe('ProjectFont');
        expect(track.block.style.fontWeight).toBe(700);
        expect(track.block.style.fontSize).toBe(42);
        expect(track.block.params.gap).toBe(12);
        expect(track.block.params.scatter).toBe(0.7);
        expect(track.block.params.sizeVariation).toBe(0.3);
        expect(track.block.params.exitMode).toBe('stay');
        expect(track.block.params.exitDelayMs).toBe(0);
        expect(track.block.params.textRevealMode).toBe('none');
        expect(track.block.params.textRevealEnterWindow).toBe(0.3);
        expect(track.block.params.textRevealExitWindow).toBe(0.2);
        expect(track.block.params.textRevealEnterPortion).toBe(1);
        expect(track.block.params.textRevealExitPortion).toBe(1);
    });

    it('normalizes booleans, inherits project font metadata, and prunes empty keyframe tracks', () => {
        const project = makeProject();
        const track = cloudMotionBlockPlugin.createTrack({
            project,
            sourceTrack: makeSourceTrack(),
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
        track.block.style.fontFamily = '';
        track.block.style.fontFallbacks = undefined;
        track.block.style.fontName = undefined;
        track.block.style.fontLocalPath = undefined;
        track.block.propertyTracks = [
            { propertyPath: 'transform.offsetX', keyframes: [], enabled: true } as any,
            { propertyPath: 'transform.offsetY', keyframes: [{ frame: 10, value: 10, interpolation: 'linear' }], enabled: true } as any,
            { propertyPath: 'transform.scale', keyframes: [{ frame: 10, value: 1, interpolation: 'linear' }], enabled: false } as any,
        ];

        const normalized = cloudMotionBlockPlugin.normalizeTrack(track, { project, projectFont: project.font });

        expect(normalized.enabled).toBe(true);
        expect(normalized.muted).toBe(false);
        expect(normalized.solo).toBe(false);
        expect(normalized.locked).toBe(false);
        expect(normalized.block.style.fontFallbacks).toEqual(['Arial']);
        expect(normalized.block.style.fontName).toBe('Project Font');
        expect(normalized.block.style.fontLocalPath).toBe('/font.otf');
        expect(normalized.block.params.gap).toBe(12);
        expect(normalized.block.params.exitMode).toBe('stay');
        expect(normalized.block.params.exitDelayMs).toBe(0);
        expect(normalized.block.params.textRevealMode).toBe('none');
        expect(normalized.block.params.textRevealEnterWindow).toBe(0.3);
        expect(normalized.block.params.textRevealExitWindow).toBe(0.2);
        expect(normalized.block.params.textRevealEnterPortion).toBe(1);
        expect(normalized.block.params.textRevealExitPortion).toBe(1);
        expect(normalized.block.propertyTracks).toHaveLength(1);
        expect(normalized.block.propertyTracks[0].propertyPath).toBe('transform.offsetY');
    });

    it('normalizes invalid exitMode, exitDelayMs, and textRevealMode to safe defaults', () => {
        const project = makeProject();
        const track = cloudMotionBlockPlugin.createTrack({
            project,
            sourceTrack: makeSourceTrack(),
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        track.block.params = {
            ...track.block.params,
            exitMode: 'garbage',
            exitDelayMs: -500,
            textRevealMode: 'garbage',
            textRevealEnterWindow: -1,
            textRevealExitWindow: 5,
            textRevealEnterPortion: -1,
            textRevealExitPortion: 5,
        };

        const normalized = cloudMotionBlockPlugin.normalizeTrack(track, { project, projectFont: project.font });

        expect(normalized.block.params.exitMode).toBe('stay');
        expect(normalized.block.params.exitDelayMs).toBe(0);
        expect(normalized.block.params.textRevealMode).toBe('none');
        expect(normalized.block.params.textRevealEnterWindow).toBe(0.01);
        expect(normalized.block.params.textRevealExitWindow).toBe(1);
        expect(normalized.block.params.textRevealEnterPortion).toBe(0.01);
        expect(normalized.block.params.textRevealExitPortion).toBe(1);
    });

    it('preserves valid perItem exitMode, exitDelayMs, and typewriter reveal mode', () => {
        const project = makeProject();
        const track = cloudMotionBlockPlugin.createTrack({
            project,
            sourceTrack: makeSourceTrack(),
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        track.block.params = {
            ...track.block.params,
            exitMode: 'perItem',
            exitDelayMs: 2000,
            textRevealMode: 'typewriter',
        };

        const normalized = cloudMotionBlockPlugin.normalizeTrack(track, { project, projectFont: project.font });

        expect(normalized.block.params.exitMode).toBe('perItem');
        expect(normalized.block.params.exitDelayMs).toBe(2000);
        expect(normalized.block.params.textRevealMode).toBe('typewriter');
        expect(normalized.block.params.textRevealEnterWindow).toBe(0.3);
        expect(normalized.block.params.textRevealExitWindow).toBe(0.2);
        expect(normalized.block.params.textRevealEnterPortion).toBe(1);
        expect(normalized.block.params.textRevealExitPortion).toBe(1);
    });
});
