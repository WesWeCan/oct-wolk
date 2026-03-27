import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import CloudInspector from '@/front-end/motion-blocks/cloud/inspector/CloudInspector.vue';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import MotionEnterExitEditor from '@/front-end/components/editor/motion/MotionEnterExitEditor.vue';
import MotionTextRevealEditor from '@/front-end/components/editor/motion/MotionTextRevealEditor.vue';
import TypewriterTimingRangeField from '@/front-end/components/editor/motion/TypewriterTimingRangeField.vue';
import { cloudMotionBlockPlugin } from '@/front-end/motion-blocks';
import { createDefaultCloudEnter } from '@/front-end/motion-blocks/cloud/defaults';

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

const mountCloudInspector = (motionTrack: ReturnType<typeof makeTrack>, lyricTracks: any[]) => shallowMount(CloudInspector, {
    props: {
        motionTrack,
        lyricTracks,
        fps: 60,
        playheadMs: 0,
    },
    global: {
        stubs: {
            MotionTextRevealEditor: false,
        },
    },
});

describe('cloud inspector', () => {
    it('warns when no word tracks are available', () => {
        const wrapper = mountCloudInspector(makeTrack(sentenceTrack), [sentenceTrack]);

        expect(wrapper.text()).toContain('Cloud can only use word tracks');
        const select = wrapper.get('select');
        expect((select.element as HTMLSelectElement).disabled).toBe(true);
    });

    it('shows only word tracks in the source selector', () => {
        const wrapper = mountCloudInspector(makeTrack(wordTrack), [sentenceTrack, wordTrack]);

        const options = wrapper.findAll('option').map((option) => option.text());
        expect(options).toEqual(['Words']);
        expect(wrapper.text()).toContain('1 lyric items currently contribute to this cloud.');
        const gapField = wrapper.findAllComponents(AnimatableNumberField)
            .find((component) => component.props('label') === 'Gap');
        expect(gapField?.props('hint')).toContain('For tighter packing, lower Style -> Background Padding too.');
    });

    it('renders the animation section with the shared enter/exit editor', () => {
        const wrapper = mountCloudInspector(makeTrack(wordTrack), [wordTrack]);

        expect(wrapper.text()).toContain('Animation');
        expect(wrapper.text()).toContain('Text Reveal');
        expect(wrapper.text()).toContain('Typewriter');
        expect(wrapper.text()).toContain('Lifecycle');
        expect(wrapper.text()).toContain('Exit Behavior');
        expect(wrapper.text()).toContain('Stay Until Block Exit');
        expect(wrapper.text()).toContain('Exit Per Word');
        expect(wrapper.findComponent(MotionTextRevealEditor).exists()).toBe(true);
        expect(wrapper.findComponent(MotionEnterExitEditor).exists()).toBe(true);
    });

    it('defaults exit mode to stay, text reveal to off, and hides exit delay field', () => {
        const track = makeTrack(wordTrack);
        expect(track.block.params.exitMode).toBe('stay');
        expect(track.block.params.textRevealMode).toBe('none');

        const wrapper = mountCloudInspector(track, [wordTrack]);

        const exitDelayField = wrapper.findAllComponents(AnimatableNumberField)
            .find((c) => c.props('label') === 'Exit Delay (ms)');
        expect(exitDelayField).toBeUndefined();
    });

    it('shows exit delay field when exitMode is perItem', () => {
        const track = makeTrack(wordTrack);
        track.block.params = { ...track.block.params, exitMode: 'perItem', exitDelayMs: 500 };

        const wrapper = mountCloudInspector(track, [wordTrack]);

        const exitDelayField = wrapper.findAllComponents(AnimatableNumberField)
            .find((c) => c.props('label') === 'Exit Delay (ms)');
        expect(exitDelayField).toBeTruthy();
        expect(exitDelayField?.props('modelValue')).toBe(500);
    });

    it('renders typewriter mode as active when configured', () => {
        const track = makeTrack(wordTrack);
        track.block.params = { ...track.block.params, textRevealMode: 'typewriter' };

        const wrapper = mountCloudInspector(track, [wordTrack]);

        const buttons = wrapper.findAll('button').filter((button) => button.text() === 'Typewriter');
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons.some((button) => button.classes().includes('active'))).toBe(true);
    });

    it('hides reveal portion controls when text reveal is off', () => {
        const track = makeTrack(wordTrack);
        expect(track.block.params.textRevealMode).toBe('none');

        const wrapper = mountCloudInspector(track, [wordTrack]);
        const revealEditor = wrapper.findComponent(MotionTextRevealEditor);
        expect(revealEditor.exists()).toBe(true);
        expect(revealEditor.find('.typewriter-timing-field').exists()).toBe(false);
    });

    it('shows reveal portion controls when typewriter mode is active', () => {
        const track = makeTrack(wordTrack);
        track.block.params = { ...track.block.params, textRevealMode: 'typewriter' };

        const wrapper = mountCloudInspector(track, [wordTrack]);
        const revealEditor = wrapper.findComponent(MotionTextRevealEditor);
        const timingField = revealEditor.findComponent(TypewriterTimingRangeField);
        expect(timingField.exists()).toBe(true);
        expect(timingField.props('startValue')).toBe(30);
        expect(timingField.props('endValue')).toBe(80);
        const cursorField = revealEditor.findAll('.inspector-field').find((field) => field.text().includes('Cursor'));
        expect(cursorField).toBeTruthy();
        const cursorButtons = cursorField!.findAll('.segmented-control button');
        expect(cursorButtons).toHaveLength(2);
        expect(cursorButtons[0].classes()).toContain('active');
        expect(revealEditor.text()).toContain('Typewriter usually looks best with Motion Off or very subtle motion');
    });

    it('reflects saved reveal portion values in typewriter controls', () => {
        const track = makeTrack(wordTrack);
        track.block.params = {
            ...track.block.params,
            textRevealMode: 'typewriter',
            textRevealEnterPortion: 0.6,
            textRevealExitPortion: 0.4,
        };

        const wrapper = mountCloudInspector(track, [wordTrack]);
        const revealEditor = wrapper.findComponent(MotionTextRevealEditor);
        const timingField = revealEditor.findComponent(TypewriterTimingRangeField);
        expect(timingField.props('startValue')).toBe(60);
        expect(timingField.props('endValue')).toBe(60);
    });

    it('auto-applies motion-off visuals when switching to typewriter from default motion', async () => {
        const track = makeTrack(wordTrack);
        const wrapper = mountCloudInspector(track, [wordTrack]);

        wrapper.findComponent(MotionTextRevealEditor).vm.$emit('update-text-reveal', {
            ...track.block.params,
            textRevealMode: 'typewriter',
        });
        await wrapper.vm.$nextTick();

        const emitted = wrapper.emitted('update-track');
        expect(emitted).toBeTruthy();
        const nextTrack = emitted![0][0] as typeof track;
        const expectedDefault = createDefaultCloudEnter();
        expect(nextTrack.block.params.textRevealMode).toBe('typewriter');
        expect(nextTrack.block.enter.fraction).toBe(expectedDefault.fraction);
        expect(nextTrack.block.enter.fade.enabled).toBe(false);
        expect(nextTrack.block.enter.move.enabled).toBe(false);
        expect(nextTrack.block.enter.scale.enabled).toBe(false);
        expect(nextTrack.block.exit.fade.enabled).toBe(false);
        expect(nextTrack.block.exit.move.enabled).toBe(false);
        expect(nextTrack.block.exit.scale.enabled).toBe(false);
    });

    it('preserves custom motion when switching to typewriter', async () => {
        const track = makeTrack(wordTrack);
        track.block.enter.move.enabled = true;
        track.block.enter.move.distancePx = 80;

        const wrapper = mountCloudInspector(track, [wordTrack]);
        wrapper.findComponent(MotionTextRevealEditor).vm.$emit('update-text-reveal', {
            ...track.block.params,
            textRevealMode: 'typewriter',
        });
        await wrapper.vm.$nextTick();

        const emitted = wrapper.emitted('update-track');
        expect(emitted).toBeTruthy();
        const nextTrack = emitted![0][0] as typeof track;
        expect(nextTrack.block.enter.move.enabled).toBe(true);
        expect(nextTrack.block.enter.move.distancePx).toBe(80);
    });
});
