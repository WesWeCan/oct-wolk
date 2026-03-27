import { describe, expect, it } from 'vitest';
import { subtitleMotionBlockPlugin } from '@/front-end/motion-blocks';

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
    kind: 'sentence' as const,
    items: [],
    muted: false,
    solo: false,
    locked: false,
});

describe('subtitle motion block plugin', () => {
    it('creates subtitle tracks from plugin defaults, project font settings, and shared reveal defaults', () => {
        const track = subtitleMotionBlockPlugin.createTrack({
            project: makeProject(),
            sourceTrack: makeSourceTrack(),
            startMs: 100,
            endMs: 2000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        expect(track.block.type).toBe('subtitle');
        expect(track.block.sourceTrackId).toBe('lyric-1');
        expect(track.block.style.fontFamily).toBe('ProjectFont');
        expect(track.block.style.fontWeight).toBe(700);
        expect(track.block.enter.fade.opacityStart).toBe(0);
        expect(track.block.exit.fade.opacityEnd).toBe(0);
        expect(track.block.params.textRevealMode).toBe('none');
        expect(track.block.params.textRevealEnterPortion).toBe(1);
        expect(track.block.params.textRevealExitPortion).toBe(1);
    });

    it('normalizes booleans, inherits project font metadata, reveal params, and prunes empty keyframe tracks', () => {
        const project = makeProject();
        const track = subtitleMotionBlockPlugin.createTrack({
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
        track.block.params = {
            ...track.block.params,
            textRevealMode: 'garbage',
            textRevealEnterPortion: -1,
            textRevealExitPortion: 5,
        };
        track.block.propertyTracks = [
            { propertyPath: 'transform.offsetX', keyframes: [], enabled: true } as any,
            { propertyPath: 'transform.offsetY', keyframes: [{ frame: 10, value: 10, interpolation: 'linear' }], enabled: true } as any,
            { propertyPath: 'transform.scale', keyframes: [{ frame: 10, value: 1, interpolation: 'linear' }], enabled: false } as any,
        ];

        const normalized = subtitleMotionBlockPlugin.normalizeTrack(track, { projectFont: project.font });

        expect(normalized.enabled).toBe(true);
        expect(normalized.muted).toBe(false);
        expect(normalized.solo).toBe(false);
        expect(normalized.locked).toBe(false);
        expect(normalized.block.style.fontFallbacks).toEqual(['Arial']);
        expect(normalized.block.style.fontName).toBe('Project Font');
        expect(normalized.block.style.fontLocalPath).toBe('/font.otf');
        expect(normalized.block.params.textRevealMode).toBe('none');
        expect(normalized.block.params.textRevealEnterPortion).toBe(0.01);
        expect(normalized.block.params.textRevealExitPortion).toBe(1);
        expect(normalized.block.propertyTracks).toHaveLength(1);
        expect(normalized.block.propertyTracks[0].propertyPath).toBe('transform.offsetY');
    });

    it('preserves typewriter styles while normalizing enter and exit payloads', () => {
        const project = makeProject();
        const track = subtitleMotionBlockPlugin.createTrack({
            project,
            sourceTrack: makeSourceTrack(),
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        track.block.enter = {
            fraction: 0.25,
            minFrames: 2,
            maxFrames: 18,
            easing: 'easeOut',
            showCursor: true,
            style: 'typewriter',
        } as any;
        track.block.exit = {
            fraction: 0.25,
            minFrames: 2,
            maxFrames: 18,
            easing: 'easeOut',
            showCursor: true,
            style: 'typewriter',
        } as any;

        const normalized = subtitleMotionBlockPlugin.normalizeTrack(track, { project, projectFont: project.font });

        expect(normalized.block.enter.style).toBe('typewriter');
        expect(normalized.block.exit.style).toBe('typewriter');
        expect(normalized.block.enter.fade.enabled).toBe(false);
        expect(normalized.block.exit.fade.enabled).toBe(false);
        expect(normalized.block.enter.showCursor).toBe(true);
        expect(normalized.block.exit.showCursor).toBe(true);
    });
});
