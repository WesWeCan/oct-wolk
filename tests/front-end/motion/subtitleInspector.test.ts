import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { shallowMount } from '@vue/test-utils';
import SubtitleInspector from '@/front-end/motion-blocks/subtitle/inspector/SubtitleInspector.vue';
import { subtitleMotionBlockPlugin } from '@/front-end/motion-blocks';

const makeProject = () => ({
    id: 'project-1',
    version: 2 as const,
    song: { title: 'Song', audioSrc: '' },
    settings: { fps: 60, renderWidth: 1920, renderHeight: 1080, seed: 'seed', durationMs: 30000 },
    font: { family: 'ProjectFont', fallbacks: ['Arial'], style: 'normal' as const, weight: 400 },
    rawLyrics: '',
    lyricTracks: [],
    motionTracks: [],
    backgroundColor: '#000000',
    backgroundImageFit: 'cover' as const,
    createdAt: 0,
    updatedAt: 0,
});

const lyricTrack = {
    id: 'lyric-1',
    name: 'Verse',
    color: '#fff',
    kind: 'sentence' as const,
    items: [{ id: 'item-1', text: 'hello world', startMs: 0, endMs: 1000 }],
    muted: false,
    solo: false,
    locked: false,
};

const makeTrack = () => subtitleMotionBlockPlugin.createTrack({
    project: makeProject(),
    sourceTrack: lyricTrack,
    startMs: 0,
    endMs: 1000,
    color: '#4fc3f7',
    trackId: 'track-1',
    blockId: 'block-1',
});

const MotionPresetPanelStub = defineComponent({
    name: 'MotionPresetPanel',
    emits: ['update-track'],
    template: '<button class="preset-panel-stub" @click="$emit(\'update-track\', $attrs[\'data-track\'])">Apply Preset</button>',
});

describe('subtitle inspector', () => {
    it('renders a presets section for block-level subtitle presets', () => {
        const wrapper = shallowMount(SubtitleInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [lyricTrack],
                fps: 60,
                playheadMs: 0,
            },
            global: {
                stubs: {
                    MotionPresetPanel: MotionPresetPanelStub,
                },
            },
        });

        expect(wrapper.text()).toContain('Presets');
    });

    it('re-emits preset updates through update-track', async () => {
        const track = makeTrack();
        const updatedTrack = {
            ...track,
            block: {
                ...track.block,
                startMs: 300,
            },
        };

        const wrapper = shallowMount(SubtitleInspector, {
            props: {
                motionTrack: track,
                lyricTracks: [lyricTrack],
                fps: 60,
                playheadMs: 0,
            },
            global: {
                stubs: {
                    MotionPresetPanel: defineComponent({
                        name: 'MotionPresetPanel',
                        emits: ['update-track'],
                        template: '<button class="preset-panel-stub" @click="$emit(\'update-track\', updatedTrack)">Apply Preset</button>',
                        data: () => ({ updatedTrack }),
                    }),
                },
            },
        });

        await wrapper.get('.preset-panel-stub').trigger('click');

        expect(wrapper.emitted('update-track')).toEqual([[updatedTrack]]);
    });
});
