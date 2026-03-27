import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import SubtitleInspector from '@/front-end/motion-blocks/subtitle/inspector/SubtitleInspector.vue';
import MotionAnimationTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue';
import {
    createDefaultSubtitleEnter,
    createDefaultSubtitleExit,
    DEFAULT_SUBTITLE_STYLE,
    DEFAULT_SUBTITLE_TRANSFORM,
} from '@/front-end/motion-blocks/subtitle/defaults';
import { DEFAULT_TEXT_REVEAL_PARAMS } from '@/front-end/utils/motion/textReveal';

const lyricTrack = {
    id: 'lyric-1',
    name: 'Lyrics',
    color: '#fff',
    kind: 'line' as const,
    items: [{ id: 'item-1', text: 'hello world', startMs: 0, endMs: 1000 }],
    muted: false,
    solo: false,
    locked: false,
};

const makeTrack = () => ({
    id: 'track-1',
    name: 'subtitle',
    color: '#4fc3f7',
    enabled: true,
    muted: false,
    solo: false,
    locked: false,
    collapsed: false,
    block: {
        id: 'block-1',
        type: 'subtitle' as const,
        sourceTrackId: lyricTrack.id,
        startMs: 0,
        endMs: 1000,
        style: { ...DEFAULT_SUBTITLE_STYLE },
        transform: { ...DEFAULT_SUBTITLE_TRANSFORM },
        enter: createDefaultSubtitleEnter(),
        exit: createDefaultSubtitleExit(),
        overrides: [],
        params: { ...DEFAULT_TEXT_REVEAL_PARAMS },
        propertyTracks: [],
    },
});

const mountSubtitleInspector = (motionTrack = makeTrack()) => shallowMount(SubtitleInspector, {
    props: {
        motionTrack,
        lyricTracks: [lyricTrack],
        fps: 60,
        playheadMs: 0,
    },
});

describe('subtitle inspector', () => {
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
