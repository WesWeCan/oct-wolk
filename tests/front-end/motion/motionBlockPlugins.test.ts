import { describe, expect, it } from 'vitest';
import { cloudMotionBlockPlugin, ensureMotionBlockPluginsRegistered, subtitleMotionBlockPlugin } from '@/front-end/motion-blocks';
import {
    getMotionBlockPlugin,
    getMotionTrackPlugin,
    listMotionBlockPlugins,
    requireMotionBlockPlugin,
} from '@/front-end/motion-blocks/core/registry';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';
import type { MotionTrack } from '@/types/project_types';

describe('motion block plugin registry', () => {
    it('registers authorable subtitle plugin metadata', () => {
        ensureMotionBlockPluginsRegistered();
        const plugins = listMotionBlockPlugins({ authorableOnly: true });
        expect(plugins.map((plugin) => plugin.type)).toContain('subtitle');
        expect(plugins.map((plugin) => plugin.type)).toContain('cloud');
        expect(plugins.find((plugin) => plugin.type === 'subtitle')?.meta.label).toBe('Subtitle');
        expect(plugins.find((plugin) => plugin.type === 'cloud')?.meta.label).toBe('Cloud');
        expect(plugins.find((plugin) => plugin.type === 'subtitle')?.inspectorComponent).toBeTruthy();
        expect(plugins.find((plugin) => plugin.type === 'cloud')?.inspectorComponent).toBeTruthy();
    });

    it('returns unsupported fallback for unknown block types', () => {
        ensureMotionBlockPluginsRegistered();
        const fallback = requireMotionBlockPlugin('totally-unknown');
        expect(fallback.type).toBe('__unsupported__');
    });

    it('resolves track plugins through the registry', () => {
        ensureMotionBlockPluginsRegistered();
        const track = subtitleMotionBlockPlugin.createTrack({
            project: {
                id: 'project-1',
                version: 2,
                song: { title: 'Song', audioSrc: '' },
                settings: { fps: 60, renderWidth: 1920, renderHeight: 1080, seed: 'seed', durationMs: 30000 },
                font: { family: 'system-ui', fallbacks: ['sans-serif'], style: 'normal', weight: 400 },
                rawLyrics: '',
                lyricTracks: [],
                motionTracks: [],
                backgroundColor: '#000000',
                backgroundImageFit: 'cover',
                createdAt: 0,
                updatedAt: 0,
            },
            sourceTrack: {
                id: 'lyric-1',
                name: 'Verse',
                color: '#fff',
                kind: 'word',
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

        expect(getMotionTrackPlugin(track).type).toBe('subtitle');
        expect(getMotionBlockPlugin(track.block.type)?.type).toBe('subtitle');
    });

    it('resolves cloud tracks through the registry', () => {
        ensureMotionBlockPluginsRegistered();
        const track = cloudMotionBlockPlugin.createTrack({
            project: {
                id: 'project-1',
                version: 2,
                song: { title: 'Song', audioSrc: '' },
                settings: { fps: 60, renderWidth: 1920, renderHeight: 1080, seed: 'seed', durationMs: 30000 },
                font: { family: 'system-ui', fallbacks: ['sans-serif'], style: 'normal', weight: 400 },
                rawLyrics: '',
                lyricTracks: [],
                motionTracks: [],
                backgroundColor: '#000000',
                backgroundImageFit: 'cover',
                createdAt: 0,
                updatedAt: 0,
            },
            sourceTrack: {
                id: 'lyric-1',
                name: 'Verse',
                color: '#fff',
                kind: 'word',
                items: [],
                muted: false,
                solo: false,
                locked: false,
            },
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-2',
            blockId: 'block-2',
        });

        expect(getMotionTrackPlugin(track).type).toBe('cloud');
        expect(getMotionBlockPlugin(track.block.type)?.type).toBe('cloud');
    });

    it('merges plugin keyframe definitions into the shared lookup', () => {
        ensureMotionBlockPluginsRegistered();
        expect(getPropertyDef('transform.offsetX')?.label).toBe('Reference X');
        expect(getPropertyDef('style.safeAreaOffsetY')?.label).toBe('Region Offset Y');
    });

    it('does not expose fallback plugin as authorable', () => {
        ensureMotionBlockPluginsRegistered();
        expect(listMotionBlockPlugins({ authorableOnly: true }).some((plugin) => plugin.type === '__unsupported__')).toBe(false);
    });
});
