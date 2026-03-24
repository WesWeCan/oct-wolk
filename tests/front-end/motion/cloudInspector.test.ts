import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import CloudInspector from '@/front-end/motion-blocks/cloud/inspector/CloudInspector.vue';
import { cloudMotionBlockPlugin } from '@/front-end/motion-blocks';

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

const makeTrack = (sourceTrack = sentenceTrack) => cloudMotionBlockPlugin.createTrack({
    project: makeProject(),
    sourceTrack,
    startMs: 0,
    endMs: 1000,
    color: '#4fc3f7',
    trackId: 'track-1',
    blockId: 'block-1',
});

describe('cloud inspector', () => {
    it('warns when no word tracks are available', () => {
        const wrapper = shallowMount(CloudInspector, {
            props: {
                motionTrack: makeTrack(sentenceTrack),
                lyricTracks: [sentenceTrack],
                fps: 60,
                playheadMs: 0,
            },
        });

        expect(wrapper.text()).toContain('Cloud can only use word tracks');
        const select = wrapper.get('select');
        expect((select.element as HTMLSelectElement).disabled).toBe(true);
    });

    it('shows only word tracks in the source selector', () => {
        const wrapper = shallowMount(CloudInspector, {
            props: {
                motionTrack: makeTrack(wordTrack),
                lyricTracks: [sentenceTrack, wordTrack],
                fps: 60,
                playheadMs: 0,
            },
        });

        const options = wrapper.findAll('option').map((option) => option.text());
        expect(options).toEqual(['Words']);
        expect(wrapper.text()).toContain('1 lyric items currently contribute to this cloud.');
    });
});
