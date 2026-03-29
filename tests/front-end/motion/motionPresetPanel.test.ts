import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import MotionPresetPanel from '@/front-end/components/editor/motion/MotionPresetPanel.vue';
import type { MotionPresetDocument } from '@/types/motion_preset_types';
import type { MotionTrack } from '@/types/project_types';

const track: MotionTrack = {
    id: 'track-1',
    name: 'cloud - Verse',
    color: '#4fc3f7',
    enabled: true,
    muted: false,
    solo: false,
    locked: false,
    collapsed: false,
    block: {
        id: 'block-1',
        type: 'cloud',
        sourceTrackId: 'lyric-1',
        startMs: 0,
        endMs: 1000,
        style: {} as any,
        transform: {} as any,
        enter: {} as any,
        exit: {} as any,
        overrides: [],
        params: {},
        propertyTracks: [],
    },
};

const listMock = vi.fn();
const loadMock = vi.fn();
const saveMock = vi.fn();
const deleteMock = vi.fn();
const exportOneMock = vi.fn();

const presetAdapter = {
    version: 1,
    extractPayload: vi.fn(() => ({ startMs: 0, endMs: 1000 })),
    applyPreset: vi.fn((inputTrack: MotionTrack, document: MotionPresetDocument) => ({
        ...inputTrack,
        block: {
            ...inputTrack.block,
            startMs: (document.payload as any).startMs,
        },
    })),
};

describe('motion preset panel', () => {
    beforeEach(() => {
        listMock.mockReset();
        loadMock.mockReset();
        saveMock.mockReset();
        deleteMock.mockReset();
        exportOneMock.mockReset();
        presetAdapter.extractPayload.mockClear();
        presetAdapter.applyPreset.mockClear();

        (window as any).electronAPI = {
            motionPresets: {
                list: listMock,
                load: loadMock,
                save: saveMock,
                delete: deleteMock,
                exportOne: exportOneMock,
            },
        };
    });

    it('renders presets as wrapped chips and selects one on click', async () => {
        listMock.mockResolvedValue([
            { id: 'preset-a', blockType: 'cloud', version: 1, name: 'Alpha', createdAt: 1, updatedAt: 2 },
            { id: 'preset-b', blockType: 'cloud', version: 1, name: 'Beta', createdAt: 1, updatedAt: 3 },
        ]);

        const wrapper = mount(MotionPresetPanel, {
            props: {
                motionTrack: track,
                presetAdapter,
            },
        });

        await flushPromises();

        const chips = wrapper.findAll('.motion-preset-panel__chip');
        expect(chips).toHaveLength(2);
        expect(wrapper.find('select').exists()).toBe(false);
        expect(chips[0].classes()).toContain('motion-preset-panel__chip--selected');
        expect((wrapper.get('input').element as HTMLInputElement).placeholder).toBe('My motion preset');

        await chips[1].trigger('click');

        expect(chips[1].classes()).toContain('motion-preset-panel__chip--selected');
        expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Beta');
    });

    it('applies the selected preset through update-track', async () => {
        listMock.mockResolvedValue([
            { id: 'preset-a', blockType: 'cloud', version: 1, name: 'Alpha', createdAt: 1, updatedAt: 2 },
        ]);
        loadMock.mockResolvedValue({
            id: 'preset-a',
            blockType: 'cloud',
            version: 1,
            name: 'Alpha',
            createdAt: 1,
            updatedAt: 2,
            payload: {
                startMs: 320,
                endMs: 1000,
            },
        });

        const wrapper = mount(MotionPresetPanel, {
            props: {
                motionTrack: track,
                presetAdapter,
            },
        });

        await flushPromises();
        await wrapper.get('.motion-preset-panel__action-row .btn-sm').trigger('click');

        expect(loadMock).toHaveBeenCalledWith('cloud', 'preset-a');
        expect(presetAdapter.applyPreset).toHaveBeenCalled();
        expect(wrapper.emitted('update-track')).toEqual([[
            expect.objectContaining({
                block: expect.objectContaining({
                    startMs: 320,
                }),
            }),
        ]]);
    });

    it('shows generic empty-state copy for non-subtitle blocks', async () => {
        listMock.mockResolvedValue([]);

        const wrapper = mount(MotionPresetPanel, {
            props: {
                motionTrack: track,
                presetAdapter,
            },
        });

        await flushPromises();

        expect(wrapper.text()).toContain('No saved presets yet. Save the current look to create one.');
    });

    it('exports the selected preset', async () => {
        listMock.mockResolvedValue([
            { id: 'preset-a', blockType: 'cloud', version: 1, name: 'Alpha', createdAt: 1, updatedAt: 2 },
        ]);
        exportOneMock.mockResolvedValue({
            canceled: false,
            filePath: '/tmp/alpha.wolkdpreset',
        });

        const wrapper = mount(MotionPresetPanel, {
            props: {
                motionTrack: track,
                presetAdapter,
            },
        });

        await flushPromises();
        await wrapper.findAll('.motion-preset-panel__action-row .btn-sm')[2].trigger('click');

        expect(exportOneMock).toHaveBeenCalledWith('cloud', 'preset-a');
        expect(wrapper.text()).toContain('/tmp/alpha.wolkdpreset');
    });
});
