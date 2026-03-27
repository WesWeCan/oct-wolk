import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import Primitive3DInspector from '@/front-end/motion-blocks/primitive3d/inspector/Primitive3DInspector.vue';
import Scene3DInspector from '@/front-end/components/editor/Scene3DInspector.vue';
import { primitive3dMotionBlockPlugin } from '@/front-end/motion-blocks';

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
    scene3d: {
        enabled: true,
        globalLighting: {
            ambientColor: '#ffffff',
            ambientIntensity: 0.45,
            directionalColor: '#ffffff',
            directionalIntensity: 1.2,
            directionalAzimuth: 35,
            directionalElevation: 50,
        },
    },
    createdAt: 0,
    updatedAt: 0,
});

const makeTrack = () => primitive3dMotionBlockPlugin.createTrack({
    project: makeProject(),
    startMs: 0,
    endMs: 1000,
    color: '#4fc3f7',
    trackId: 'track-1',
    blockId: 'block-1',
});

describe('primitive3d inspector', () => {
    it('shows a disabled custom model control', () => {
        const wrapper = shallowMount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        const button = wrapper.find('button[disabled]');
        expect(button.exists()).toBe(true);
        expect(wrapper.text()).toContain('Import Model (coming later)');
    });

    it('switches to local lighting controls', async () => {
        const wrapper = shallowMount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        await wrapper.findAll('button').find((button) => button.text() === 'Lighting')?.trigger('click');
        await wrapper.findAll('button').find((button) => button.text() === 'Local')?.trigger('click');

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        const updatedTrack = updates?.at(-1)?.[0] as any;
        expect(updatedTrack.block.params.lighting.mode).toBe('local');
    });

    it('re-emits global scene lighting updates when in global mode', async () => {
        const wrapper = shallowMount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        await wrapper.findAll('button').find((button) => button.text() === 'Lighting')?.trigger('click');
        wrapper.findComponent(Scene3DInspector).vm.$emit('update-scene3d', {
            enabled: true,
            globalLighting: {
                ambientColor: '#ff0000',
                ambientIntensity: 0.5,
                directionalColor: '#ffffff',
                directionalIntensity: 1.2,
                directionalAzimuth: 35,
                directionalElevation: 50,
            },
        });

        const updates = wrapper.emitted('update-scene3d');
        expect(updates).toBeTruthy();
        expect((updates?.at(-1)?.[0] as any).globalLighting.ambientColor).toBe('#ff0000');
    });

    it('lets word sprites bind to a word source track', async () => {
        const wrapper = shallowMount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [{
                    id: 'lyric-1',
                    name: 'Word Track',
                    color: '#fff',
                    kind: 'word',
                    items: [],
                    muted: false,
                    solo: false,
                    locked: false,
                }],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        await wrapper.findAll('button').find((button) => button.text() === 'Words')?.trigger('click');
        const select = wrapper.find('select');
        await select.setValue('lyric-1');

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        expect((updates?.at(-1)?.[0] as any).block.sourceTrackId).toBe('lyric-1');
    });

    it('lets smoothing be toggled from the words tab', async () => {
        const wrapper = shallowMount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [{
                    id: 'lyric-1',
                    name: 'Word Track',
                    color: '#fff',
                    kind: 'word',
                    items: [],
                    muted: false,
                    solo: false,
                    locked: false,
                }],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        await wrapper.findAll('button').find((button) => button.text() === 'Words')?.trigger('click');
        const inlineFields = wrapper.findAll('.style-v2__field--inline');
        const enableWordsField = inlineFields.find((field) => field.text().includes('Enable Word Sprites'));
        await enableWordsField?.find('input[type="checkbox"]').setValue(true);
        const firstUpdatedTrack = wrapper.emitted('update-track')?.at(-1)?.[0] as any;
        await wrapper.setProps({ motionTrack: firstUpdatedTrack });
        const smoothFacingField = wrapper.findAll('.style-v2__field--inline').find((field) => field.text().includes('Smooth Facing'));
        await smoothFacingField?.find('input[type="checkbox"]').setValue(false);

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        expect((updates?.at(-1)?.[0] as any).block.params.reaction.smoothFacing).toBe(false);
    });
});
