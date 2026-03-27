import { describe, expect, it } from 'vitest';
import { subtitleMotionBlockPlugin } from '@/front-end/motion-blocks';
import type { SubtitleMotionPresetDocument } from '@/types/motion_preset_types';

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
    it('creates subtitle tracks from plugin defaults and project font settings', () => {
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
    });

    it('normalizes booleans, inherits project font metadata, and prunes empty keyframe tracks', () => {
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
        track.block.propertyTracks = [
            { propertyPath: 'transform.offsetX', keyframes: [], enabled: true } as any,
            { propertyPath: 'transform.offsetY', keyframes: [{ frame: 10, value: 10, interpolation: 'linear' }], enabled: true } as any,
            { propertyPath: 'transform.scale', keyframes: [{ frame: 10, value: 1, interpolation: 'linear' }], enabled: false } as any,
        ];

        const normalized = subtitleMotionBlockPlugin.normalizeTrack(track, { project, projectFont: project.font });

        expect(normalized.enabled).toBe(true);
        expect(normalized.muted).toBe(false);
        expect(normalized.solo).toBe(false);
        expect(normalized.locked).toBe(false);
        expect(normalized.block.style.fontFallbacks).toEqual(['Arial']);
        expect(normalized.block.style.fontName).toBe('Project Font');
        expect(normalized.block.style.fontLocalPath).toBe('/font.otf');
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

    it('extracts subtitle presets without source links, overrides, or keyframes', () => {
        const project = makeProject();
        const track = subtitleMotionBlockPlugin.createTrack({
            project,
            sourceTrack: makeSourceTrack(),
            startMs: 250,
            endMs: 1750,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        track.block.style.color = '#ff00ff';
        track.block.transform.offsetX = 42;
        track.block.enter.fade.enabled = false;
        track.block.overrides.push({ sourceItemId: 'item-1', hidden: false, textOverride: 'hello' });
        track.block.propertyTracks.push({
            propertyPath: 'transform.offsetX',
            keyframes: [{ frame: 10, value: 10, interpolation: 'linear' }],
            enabled: true,
        } as any);

        const payload = subtitleMotionBlockPlugin.presets!.extractPayload(track, { project, projectFont: project.font });

        expect(payload.startMs).toBe(250);
        expect(payload.endMs).toBe(1750);
        expect(payload.style.color).toBe('#ff00ff');
        expect(payload.transform.offsetX).toBe(42);
        expect((payload as any).overrides).toBeUndefined();
        expect((payload as any).propertyTracks).toBeUndefined();
        expect((payload as any).sourceTrackId).toBeUndefined();
    });

    it('applies subtitle presets while preserving source track, overrides, and keyframes', () => {
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

        track.block.overrides.push({ sourceItemId: 'item-1', hidden: false, textOverride: 'hello' });
        track.block.propertyTracks.push({
            propertyPath: 'transform.offsetY',
            keyframes: [{ frame: 10, value: 25, interpolation: 'linear' }],
            enabled: true,
        } as any);

        const preset: SubtitleMotionPresetDocument = {
            id: 'preset-1',
            blockType: 'subtitle',
            version: 1,
            name: 'Punchy',
            createdAt: 1,
            updatedAt: 1,
            payload: {
                startMs: 300,
                endMs: 1200,
                style: {
                    ...track.block.style,
                    color: '#00ffcc',
                    fontFamily: '',
                    fontFallbacks: undefined,
                    fontName: undefined,
                    fontLocalPath: undefined,
                },
                transform: {
                    ...track.block.transform,
                    offsetX: 88,
                },
                enter: {
                    ...track.block.enter,
                    style: 'typewriter',
                    showCursor: true,
                },
                exit: {
                    ...track.block.exit,
                    style: 'typewriter',
                    showCursor: true,
                },
            },
        };

        const applied = subtitleMotionBlockPlugin.presets!.applyPreset(track, preset, { project, projectFont: project.font });

        expect(applied.block.sourceTrackId).toBe(track.block.sourceTrackId);
        expect(applied.block.overrides).toEqual(track.block.overrides);
        expect(applied.block.propertyTracks).toEqual(track.block.propertyTracks);
        expect(applied.block.startMs).toBe(300);
        expect(applied.block.endMs).toBe(1200);
        expect(applied.block.style.color).toBe('#00ffcc');
        expect(applied.block.style.fontFallbacks).toEqual(['Arial']);
        expect(applied.block.enter.style).toBe('typewriter');
        expect(applied.block.exit.style).toBe('typewriter');
    });
});
