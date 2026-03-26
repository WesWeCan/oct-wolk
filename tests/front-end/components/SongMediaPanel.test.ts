import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import SongMediaPanel from '@/front-end/components/editor/SongMediaPanel.vue';
import { ProjectService } from '@/front-end/services/ProjectService';
import type { WolkProject } from '@/types/project_types';

const makeProject = (overrides?: Partial<WolkProject>): WolkProject => ({
    id: 'project-1',
    version: 2,
    song: {
        title: 'Test Song',
        audioSrc: '',
        coverSrc: undefined,
        ...(overrides?.song || {}),
    },
    settings: {
        fps: 60,
        renderWidth: 1920,
        renderHeight: 1080,
        seed: 'seed',
        durationMs: 120000,
        ...(overrides?.settings || {}),
    },
    font: {
        family: 'system-ui',
        fallbacks: ['sans-serif'],
        style: 'normal',
        weight: 400,
        ...(overrides?.font || {}),
    },
    rawLyrics: '',
    lyricTracks: [],
    motionTracks: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('SongMediaPanel', () => {
    it('shows drop image only while an image drag is active', async () => {
        const wrapper = mount(SongMediaPanel, {
            props: {
                projectId: 'project-1',
                song: makeProject().song,
            },
        });

        expect(wrapper.text()).toContain('Artwork');
        expect(wrapper.text()).toContain('Click to add artwork');

        await wrapper.get('.song-media-panel__cover').trigger('dragover', {
            dataTransfer: {
                items: [{ kind: 'file', type: 'image/png' }],
            },
        });

        expect(wrapper.text()).toContain('Drop image');

        await wrapper.get('.song-media-panel__cover').trigger('dragleave');
        expect(wrapper.text()).toContain('Click to add artwork');
    });

    it('uploads cover art from file selection and updates the preview', async () => {
        const updatedProject = makeProject({
            song: {
                title: 'Test Song',
                audioSrc: '',
                coverSrc: 'wolk://project-1/cover.png',
            },
        });
        const uploadCover = vi.spyOn(ProjectService, 'uploadCover').mockResolvedValue(updatedProject);

        const wrapper = mount(SongMediaPanel, {
            props: {
                projectId: 'project-1',
                song: makeProject().song,
            },
        });

        const file = new File(['cover'], 'cover.png', { type: 'image/png' });
        const input = wrapper.get('.song-media-panel__cover-input');
        Object.defineProperty(input.element, 'files', {
            value: [file],
            configurable: true,
        });
        await input.trigger('change');
        await flushPromises();

        expect(uploadCover).toHaveBeenCalledWith('project-1', file);
        expect(wrapper.get('.song-media-panel__cover-image').attributes('style')).toContain('wolk://project-1/cover.png');
        expect(wrapper.emitted('projectUpdated')?.[0]?.[0]).toEqual({
            project: updatedProject,
            kind: 'cover',
        });
    });

    it('uploads cover art from drag and drop', async () => {
        const updatedProject = makeProject({
            song: {
                title: 'Test Song',
                audioSrc: '',
                coverSrc: 'wolk://project-1/drop-cover.webp',
            },
        });
        const uploadCover = vi.spyOn(ProjectService, 'uploadCover').mockResolvedValue(updatedProject);

        const wrapper = mount(SongMediaPanel, {
            props: {
                projectId: 'project-1',
                song: makeProject().song,
            },
        });

        const file = new File(['cover'], 'drop-cover.webp', { type: 'image/webp' });
        await wrapper.get('.song-media-panel__cover').trigger('drop', {
            dataTransfer: {
                files: [file],
            },
        });
        await flushPromises();

        expect(uploadCover).toHaveBeenCalledWith('project-1', file);
        expect(wrapper.get('.song-media-panel__cover-image').attributes('style')).toContain('drop-cover.webp');
    });
});
