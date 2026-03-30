import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import MotionPresetPanel from '@/front-end/components/editor/motion/MotionPresetPanel.vue';
import Primitive3DInspector from '@/front-end/motion-blocks/primitive3d/inspector/Primitive3DInspector.vue';
import Scene3DInspector from '@/front-end/components/editor/Scene3DInspector.vue';
import MotionTextRevealEditor from '@/front-end/components/editor/motion/MotionTextRevealEditor.vue';
import { ProjectService } from '@/front-end/services/ProjectService';
import { primitive3dMotionBlockPlugin } from '@/front-end/motion-blocks';
import { createDefaultPrimitive3DEnter, createDefaultPrimitive3DExit } from '@/front-end/motion-blocks/primitive3d/defaults';

vi.mock('vue-router', () => ({
    useRoute: () => ({
        params: {
            projectId: 'project-1',
        },
    }),
}));

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
    beforeEach(() => {
        (window as any).electronAPI = {
            motionPresets: {
                list: vi.fn().mockResolvedValue([]),
                load: vi.fn(),
                save: vi.fn(),
                delete: vi.fn(),
            },
        };
    });

    const getTopLevelSections = (wrapper: ReturnType<typeof mount>) => (
        wrapper.find('.motion-inspector--primitive3d').findAll(':scope > .inspector-section')
    );

    it('orders top-level sections like the other motion inspectors', () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        const topLevelSections = getTopLevelSections(wrapper)
            .map((section) => section.find('.inspector-section__title').text());

        expect(topLevelSections).toEqual([
            'Source & Timing',
            'Presets',
            'Object',
            'Camera',
            'Material',
            'Lighting',
            'Words',
            'Animation',
        ]);
    });

    it('re-emits preset updates from the presets section', async () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        await flushPromises();

        const updatedTrack = makeTrack();
        updatedTrack.block.startMs = 320;

        wrapper.findComponent(MotionPresetPanel).vm.$emit('update-track', updatedTrack);
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('update-track')).toEqual([[updatedTrack]]);
    });

    it('lists Model in the geometry dropdown', () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        expect(wrapper.find('select[aria-label="Primitive type"]').text()).toContain('Model');
    });

    it('groups primitives into core and advanced shape buckets', () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        const groups = wrapper.findAll('optgroup');
        expect(groups.map((group) => group.attributes('label'))).toEqual(['Core Shapes', 'More Shapes']);
        expect(groups[0]?.text()).toContain('Capsule');
        expect(groups[0]?.text()).toContain('Model');
        expect(groups[1]?.text()).toContain('Icosahedron');
    });

    it('shows per-shape geometry controls for core primitives', async () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        expect(wrapper.text()).toContain('Width Segments');
        expect(wrapper.text()).toContain('Height Segments');

        const primitiveSelect = wrapper.find('select[aria-label="Primitive type"]');
        await primitiveSelect.setValue('box');
        const boxTrack = wrapper.emitted('update-track')?.at(-1)?.[0] as any;
        await wrapper.setProps({ motionTrack: boxTrack });
        expect(wrapper.text()).toContain('Box Width');
        expect(wrapper.text()).toContain('Box Depth');

        await primitiveSelect.setValue('torus');
        const torusTrack = wrapper.emitted('update-track')?.at(-1)?.[0] as any;
        await wrapper.setProps({ motionTrack: torusTrack });
        expect(wrapper.text()).toContain('Ring Radius');
        expect(wrapper.text()).toContain('Tubular Segments');
    });

    it('uploads OBJ and texture assets when Model is selected', async () => {
        vi.spyOn(ProjectService, 'uploadAsset')
            .mockResolvedValueOnce({ url: 'wolk://project-1/assets/test.obj', fileName: 'test.obj' })
            .mockResolvedValueOnce({ url: 'wolk://project-1/assets/albedo.jpg', fileName: 'albedo.jpg' });

        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        const primitiveSelect = wrapper.find('select[aria-label="Primitive type"]');
        await primitiveSelect.setValue('model');
        let updatedTrack = wrapper.emitted('update-track')?.at(-1)?.[0] as any;
        await wrapper.setProps({ motionTrack: updatedTrack });

        const objInput = wrapper.find('[data-testid="primitive3d-model-obj-input"]');
        const objFile = new File([
            'o test\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n',
        ], 'test.obj', { type: 'text/plain' });
        Object.defineProperty(objInput.element, 'files', {
            value: [objFile],
            configurable: true,
        });
        await objInput.trigger('change');
        await flushPromises();
        updatedTrack = wrapper.emitted('update-track')?.at(-1)?.[0] as any;
        expect(updatedTrack.block.params.primitive.modelObjUrl).toBe('wolk://project-1/assets/test.obj');
        expect(updatedTrack.block.params.primitive.type).toBe('model');
        expect(updatedTrack.block.params.primitive.modelAnchorPoints.length).toBeGreaterThan(0);

        await wrapper.setProps({ motionTrack: updatedTrack });

        const textureInput = wrapper.find('[data-testid="primitive3d-model-texture-input"]');
        const textureFile = new File(['jpeg'], 'albedo.jpg', { type: 'image/jpeg' });
        Object.defineProperty(textureInput.element, 'files', {
            value: [textureFile],
            configurable: true,
        });
        await textureInput.trigger('change');
        await flushPromises();
        updatedTrack = wrapper.emitted('update-track')?.at(-1)?.[0] as any;
        expect(updatedTrack.block.params.primitive.modelTextureUrl).toBe('wolk://project-1/assets/albedo.jpg');
        expect(updatedTrack.block.params.material.textureMode).toBe('texture-with-tint');
    });

    it('explains that some shapes do not have extra geometry controls yet', async () => {
        const track = makeTrack();
        track.block.params.primitive.type = 'icosahedron';
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: track,
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        expect(wrapper.text()).toContain('does not have extra geometry controls yet');
    });

    it('switches to local lighting controls', async () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        await wrapper.findAll('button').find((button) => button.text() === 'Local')?.trigger('click');

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        const updatedTrack = updates?.at(-1)?.[0] as any;
        expect(updatedTrack.block.params.lighting.mode).toBe('local');
    });

    it('re-emits global scene lighting updates when in global mode', async () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

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
        const wrapper = mount(Primitive3DInspector, {
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

        const sourceSection = getTopLevelSections(wrapper).at(0)!;
        expect(sourceSection.text()).toContain('Enable Word Sprites');
        expect(sourceSection.text()).toContain('Word Track');
        expect(sourceSection.text()).toContain('Start Frame');
        expect(sourceSection.text()).toContain('End Frame');

        const wordsSection = getTopLevelSections(wrapper).at(6)!;
        expect(wordsSection.text()).not.toContain('Word Track');

        const select = sourceSection.find('select[aria-label="Word track"]');
        await select.setValue('lyric-1');

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        expect((updates?.at(-1)?.[0] as any).block.sourceTrackId).toBe('lyric-1');
    });

    it('renders the shared animation section for word sprite reveal and motion', () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        expect(wrapper.text()).toContain('Animation');
        expect(wrapper.text()).toContain('Text Reveal');
        expect(wrapper.text()).toContain('Typewriter');
        expect(wrapper.text()).toContain('Lifecycle');
        expect(wrapper.text()).toContain('Exit Behavior');
        expect(wrapper.text()).toContain('Stay Until Replaced');
        expect(wrapper.text()).toContain('Exit Per Word');
        expect(wrapper.text()).toContain('Motion');
    });

    it('updates shared text reveal params from the animation section', async () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        wrapper.findComponent(MotionTextRevealEditor).vm.$emit('update-text-reveal', {
            textRevealMode: 'typewriter',
            textRevealEnterWindow: 0.4,
            textRevealExitWindow: 0.2,
            textRevealEnterPortion: 0.4,
            textRevealExitPortion: 0.5,
            textRevealShowCursor: true,
        });
        await wrapper.vm.$nextTick();

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        const updatedTrack = updates?.at(-1)?.[0] as any;
        expect(updatedTrack.block.params.textReveal.textRevealMode).toBe('typewriter');
        expect(updatedTrack.block.params.textReveal.textRevealEnterWindow).toBe(0.4);
        expect(updatedTrack.block.params.textReveal.textRevealExitWindow).toBe(0.2);
        expect(updatedTrack.block.params.textReveal.textRevealEnterPortion).toBe(0.4);
        expect(updatedTrack.block.params.textReveal.textRevealExitPortion).toBe(0.5);
        expect(updatedTrack.block.params.textReveal.textRevealShowCursor).toBe(true);
    });

    it('auto-applies motion-off visuals when switching to typewriter from default motion', async () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        wrapper.findComponent(MotionTextRevealEditor).vm.$emit('update-text-reveal', {
            textRevealMode: 'typewriter',
            textRevealEnterWindow: 0.3,
            textRevealExitWindow: 0.2,
            textRevealEnterPortion: 1,
            textRevealExitPortion: 1,
            textRevealShowCursor: false,
        });
        await wrapper.vm.$nextTick();

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        const updatedTrack = updates?.at(-1)?.[0] as any;
        const expectedDefault = createDefaultPrimitive3DEnter();

        expect(updatedTrack.block.params.textReveal.textRevealMode).toBe('typewriter');
        expect(updatedTrack.block.enter.fraction).toBe(expectedDefault.fraction);
        expect(updatedTrack.block.enter.fade.enabled).toBe(false);
        expect(updatedTrack.block.enter.move.enabled).toBe(false);
        expect(updatedTrack.block.enter.scale.enabled).toBe(false);
        expect(updatedTrack.block.exit.fade.enabled).toBe(false);
        expect(updatedTrack.block.exit.move.enabled).toBe(false);
        expect(updatedTrack.block.exit.scale.enabled).toBe(false);
    });

    it('derives text reveal editor values from legacy typewriter enter and exit settings', () => {
        const track = makeTrack();
        track.block.enter = {
            ...createDefaultPrimitive3DEnter(),
            style: 'typewriter',
            fraction: 0.55,
            showCursor: true,
        };
        track.block.exit = {
            ...createDefaultPrimitive3DExit(),
            style: 'typewriter',
            fraction: 0.45,
            showCursor: false,
        };

        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: track,
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        const revealEditor = wrapper.findComponent(MotionTextRevealEditor);
        expect(revealEditor.props('value')).toMatchObject({
            textRevealMode: 'typewriter',
            textRevealEnterWindow: 0.55,
            textRevealExitWindow: 0.45,
            textRevealShowCursor: true,
        });
    });

    it('updates primitive3d lifecycle params from the animation section', async () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        await wrapper.findAll('button').find((button) => button.text() === 'Exit Per Word')?.trigger('click');

        const firstUpdates = wrapper.emitted('update-track');
        expect(firstUpdates).toBeTruthy();
        const firstTrack = firstUpdates?.at(-1)?.[0] as any;
        expect(firstTrack.block.params.lifecycle.exitMode).toBe('perItem');

        await wrapper.setProps({ motionTrack: firstTrack });

        const exitDelayField = wrapper.findAllComponents(AnimatableNumberField)
            .find((component) => component.props('label') === 'Exit Delay (ms)');
        expect(exitDelayField).toBeTruthy();

        exitDelayField!.vm.$emit('update:modelValue', 1200);
        await wrapper.vm.$nextTick();

        const secondUpdates = wrapper.emitted('update-track');
        expect(secondUpdates).toBeTruthy();
        const secondTrack = secondUpdates?.at(-1)?.[0] as any;
        expect(secondTrack.block.params.lifecycle.exitDelayMs).toBe(1200);
    });

    it('lets smoothing be toggled from the words tab', async () => {
        const wrapper = mount(Primitive3DInspector, {
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

        await wrapper.find('button[aria-label="Enable word sprites on"]').trigger('click');
        const firstUpdatedTrack = wrapper.emitted('update-track')?.at(-1)?.[0] as any;
        await wrapper.setProps({ motionTrack: firstUpdatedTrack });
        await wrapper.find('button[aria-label="Smooth follow off"]').trigger('click');

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        expect((updates?.at(-1)?.[0] as any).block.params.reaction.smoothFacing).toBe(false);
    });

    it('lets billboard rotation be toggled with segmented controls', async () => {
        const wrapper = mount(Primitive3DInspector, {
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

        await wrapper.find('button[aria-label="Enable word sprites on"]').trigger('click');
        const firstUpdatedTrack = wrapper.emitted('update-track')?.at(-1)?.[0] as any;
        await wrapper.setProps({ motionTrack: firstUpdatedTrack });
        await wrapper.find('button[aria-label="Word facing off"]').trigger('click');

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        expect((updates?.at(-1)?.[0] as any).block.params.billboard.enabled).toBe(false);
    });

    it('lets object follow be turned off so the mesh keeps its own rotation', async () => {
        const wrapper = mount(Primitive3DInspector, {
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

        await wrapper.find('button[aria-label="Enable word sprites on"]').trigger('click');
        const firstUpdatedTrack = wrapper.emitted('update-track')?.at(-1)?.[0] as any;
        await wrapper.setProps({ motionTrack: firstUpdatedTrack });
        await wrapper.find('button[aria-label="Object follow off"]').trigger('click');

        const updates = wrapper.emitted('update-track');
        expect(updates).toBeTruthy();
        expect((updates?.at(-1)?.[0] as any).block.params.reaction.enabled).toBe(false);
    });

    it('groups word controls by placement and orientation', () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        const wordsSection = getTopLevelSections(wrapper).at(6)!;
        const subsectionTitles = wordsSection.findAll('.style-sub-section__header').map((section) => section.text());

        expect(subsectionTitles).toEqual([
            'Placement',
            'Word Facing',
            'Object Follow',
            'Typography',
            'Background',
        ]);
    });

    it('explains that object follow can visually override object rotation', () => {
        const wrapper = mount(Primitive3DInspector, {
            props: {
                motionTrack: makeTrack(),
                lyricTracks: [],
                fps: 60,
                playheadMs: 0,
                scene3d: makeProject().scene3d,
            },
        });

        const wordsSection = getTopLevelSections(wrapper).at(6)!;
        expect(wordsSection.text()).toContain('can visually override rotation keyframes');
        expect(wordsSection.text()).toContain('Face Camera');
        expect(wordsSection.text()).toContain('Follow Active Word');
    });
});
