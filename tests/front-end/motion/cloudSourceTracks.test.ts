import { describe, expect, it } from 'vitest';
import { cloudMotionBlockPlugin } from '@/front-end/motion-blocks';
import { resolveCloudBlockItems } from '@/front-end/motion-blocks/cloud/item-resolvers';
import {
    isCloudSupportedSourceTrack,
    listCloudSupportedSourceTracks,
    pickPreferredCloudSourceTrack,
} from '@/front-end/motion-blocks/cloud/source-tracks';

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

const wordTrack = {
    id: 'word-1',
    name: 'Words',
    color: '#fff',
    kind: 'word' as const,
    items: [{ id: 'item-1', text: 'hello', startMs: 0, endMs: 1000 }],
    muted: false,
    solo: false,
    locked: false,
};

const sentenceTrack = {
    id: 'sentence-1',
    name: 'Sentences',
    color: '#fff',
    kind: 'sentence' as const,
    items: [{ id: 'item-1', text: 'hello world', startMs: 0, endMs: 1000 }],
    muted: false,
    solo: false,
    locked: false,
};

describe('cloud source track helpers', () => {
    it('treats only word tracks as supported sources', () => {
        expect(isCloudSupportedSourceTrack(wordTrack)).toBe(true);
        expect(isCloudSupportedSourceTrack(sentenceTrack)).toBe(false);
        expect(listCloudSupportedSourceTracks([sentenceTrack, wordTrack]).map((track) => track.id)).toEqual(['word-1']);
    });

    it('prefers a selected word track, otherwise falls back to the first word track, then any track', () => {
        expect(pickPreferredCloudSourceTrack(wordTrack, [sentenceTrack, wordTrack])?.id).toBe('word-1');
        expect(pickPreferredCloudSourceTrack(sentenceTrack, [sentenceTrack, wordTrack])?.id).toBe('word-1');
        expect(pickPreferredCloudSourceTrack(sentenceTrack, [sentenceTrack])?.id).toBe('sentence-1');
    });

    it('renders no cloud items for unsupported source track kinds', () => {
        const track = cloudMotionBlockPlugin.createTrack({
            project: makeProject(),
            sourceTrack: wordTrack,
            startMs: 0,
            endMs: 1000,
            color: '#4fc3f7',
            trackId: 'track-1',
            blockId: 'block-1',
        });

        expect(resolveCloudBlockItems(track.block, sentenceTrack, 0, 60)).toEqual([]);
        expect(resolveCloudBlockItems(track.block, wordTrack, 0, 60)).toHaveLength(1);
    });
});
