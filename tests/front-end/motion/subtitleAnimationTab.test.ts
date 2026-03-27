import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MotionAnimationTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue';
import { createDefaultSubtitleEnter, createDefaultSubtitleExit } from '@/front-end/motion-blocks/subtitle/defaults';

const makeTrack = () => ({
    id: 'track-1',
    name: 'subtitle - Verse',
    color: '#4fc3f7',
    enabled: true,
    muted: false,
    solo: false,
    locked: false,
    collapsed: false,
    block: {
        id: 'block-1',
        type: 'subtitle' as const,
        sourceTrackId: 'lyric-1',
        startMs: 0,
        endMs: 1000,
        style: {} as any,
        transform: {} as any,
        enter: createDefaultSubtitleEnter(),
        exit: createDefaultSubtitleExit(),
        overrides: [],
        params: {
            textRevealMode: 'none' as const,
            textRevealEnterPortion: 1,
            textRevealExitPortion: 1,
        },
        propertyTracks: [],
    },
});

describe('subtitle MotionAnimationTab', () => {
    it('shows text reveal controls for block-level animation editing', () => {
        const wrapper = mount(MotionAnimationTab, {
            props: {
                track: makeTrack() as any,
                revealValue: {
                    textRevealMode: 'none',
                    textRevealEnterPortion: 1,
                    textRevealExitPortion: 1,
                },
            },
        });

        expect(wrapper.text()).toContain('Text Reveal');
        expect(wrapper.text()).toContain('Typewriter');
    });

    it('hides reveal controls when block-level reveal editing is disabled', () => {
        const wrapper = mount(MotionAnimationTab, {
            props: {
                track: makeTrack() as any,
                revealValue: {
                    textRevealMode: 'typewriter',
                    textRevealEnterPortion: 1,
                    textRevealExitPortion: 1,
                },
                showReveal: false,
            },
        });

        expect(wrapper.text()).not.toContain('Text Reveal');
        expect(wrapper.text()).not.toContain('Typewriter');
    });
});
