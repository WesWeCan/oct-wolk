import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { shallowMount } from '@vue/test-utils';
import SubtitleInspector from '@/front-end/motion-blocks/subtitle/inspector/SubtitleInspector.vue';
import MotionAnimationTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue';
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

const mountSubtitleInspector = (
    motionTrack = makeTrack(),
    stubs: Record<string, unknown> = {},
) => shallowMount(SubtitleInspector, {
    props: {
        motionTrack,
        lyricTracks: [lyricTrack],
        fps: 60,
        playheadMs: 0,
    },
    global: {
        stubs,
    },
});

describe('subtitle inspector', () => {
    it('renders a presets section for block-level subtitle presets', () => {
        const wrapper = mountSubtitleInspector(makeTrack(), {
            MotionPresetPanel: defineComponent({
                name: 'MotionPresetPanel',
                emits: ['update-track'],
                template: '<button class="preset-panel-stub">Apply Preset</button>',
            }),
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

        const wrapper = mountSubtitleInspector(track, {
            MotionPresetPanel: defineComponent({
                name: 'MotionPresetPanel',
                emits: ['update-track'],
                template: '<button class="preset-panel-stub" @click="$emit(\'update-track\', updatedTrack)">Apply Preset</button>',
                data: () => ({ updatedTrack }),
            }),
        });

        await wrapper.get('.preset-panel-stub').trigger('click');

        expect(wrapper.emitted('update-track')).toEqual([[updatedTrack]]);
    });

    it('auto-applies motion-off visuals when switching to typewriter from default motion', async () => {
        const track = makeTrack();
        const wrapper = mountSubtitleInspector(track);

        wrapper.findComponent(MotionAnimationTab).vm.$emit('update-text-reveal', {
            ...track.block.params,
            textRevealMode: 'typewriter',
        });
        await wrapper.vm.$nextTick();

        const emitted = wrapper.emitted('update-track');
        expect(emitted).toBeTruthy();
        const nextTrack = emitted![0][0] as typeof track;
        expect(nextTrack.block.params.textRevealMode).toBe('typewriter');
        expect(nextTrack.block.enter.fade.enabled).toBe(false);
        expect(nextTrack.block.enter.move.enabled).toBe(false);
        expect(nextTrack.block.enter.scale.enabled).toBe(false);
        expect(nextTrack.block.exit.fade.enabled).toBe(false);
        expect(nextTrack.block.exit.move.enabled).toBe(false);
        expect(nextTrack.block.exit.scale.enabled).toBe(false);
        expect(nextTrack.block.enter.fraction).toBe(track.block.enter.fraction);
        expect(nextTrack.block.exit.fraction).toBe(track.block.exit.fraction);
    });

    it('preserves custom motion when switching to typewriter', async () => {
        const track = makeTrack();
        track.block.exit.move.enabled = true;
        track.block.exit.move.distancePx = 96;

        const wrapper = mountSubtitleInspector(track);
        wrapper.findComponent(MotionAnimationTab).vm.$emit('update-text-reveal', {
            ...track.block.params,
            textRevealMode: 'typewriter',
        });
        await wrapper.vm.$nextTick();

        const emitted = wrapper.emitted('update-track');
        expect(emitted).toBeTruthy();
        const nextTrack = emitted![0][0] as typeof track;
        expect(nextTrack.block.exit.move.enabled).toBe(true);
        expect(nextTrack.block.exit.move.distancePx).toBe(96);
    });
});
