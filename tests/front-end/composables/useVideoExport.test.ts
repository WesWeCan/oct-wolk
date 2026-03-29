import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useVideoExport } from '@/front-end/composables/editor/useVideoExport';
import { installMockElectronAPI } from '../../mocks/electron';
import type { ExportDocument } from '@/types/export_types';

const createCanvas = () => {
    const canvas = document.createElement('canvas') as HTMLCanvasElement & {
        toBlob: (callback: (blob: Blob | null) => void) => void;
    };

    canvas.toBlob = vi.fn((callback: (blob: Blob | null) => void) => {
        callback(new Blob(['frame'], { type: 'image/png' }));
    });

    return canvas;
};

const createExportDocument = (overrides?: Partial<ExportDocument>): ExportDocument => ({
    id: 'project-1',
    title: 'Export Test',
    audioSrc: null,
    settings: {
        fps: 60,
        renderWidth: 1920,
        renderHeight: 1080,
        includeAudio: true,
        keepRawPngFrames: false,
        exportAlphaMov: false,
        ...(overrides?.settings || {}),
    },
    ...overrides,
});

describe('useVideoExport frame export options', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps the default frame export path unchanged when new options are off', async () => {
        const electronAPI = installMockElectronAPI();
        const videoExport = useVideoExport(
            ref(createCanvas()),
            ref(null),
            ref(createExportDocument()),
            ref('project-1'),
            ref(false),
            ref(true),
        );

        await videoExport.startCanvasFrameExport({
            fps: 60,
            totalFrames: 1,
            drawFrame: vi.fn(),
        });

        expect(electronAPI.export.assembleVideo).toHaveBeenCalledOnce();
        expect(electronAPI.export.assembleAlphaVideo).not.toHaveBeenCalled();
        expect(electronAPI.export.cleanupFrames).toHaveBeenCalledOnce();
        expect(videoExport.exportState.value.phase).toBe('complete');
    });

    it('generates an alpha MOV and keeps frames when the saved options are enabled', async () => {
        const electronAPI = installMockElectronAPI();
        const videoExport = useVideoExport(
            ref(createCanvas()),
            ref(null),
            ref(createExportDocument({
                settings: {
                    fps: 60,
                    renderWidth: 1920,
                    renderHeight: 1080,
                    includeAudio: true,
                    keepRawPngFrames: true,
                    exportAlphaMov: true,
                },
            })),
            ref('project-1'),
            ref(false),
            ref(true),
        );

        await videoExport.startCanvasFrameExport({
            fps: 60,
            totalFrames: 1,
            drawFrame: vi.fn(),
        });

        expect(electronAPI.export.assembleVideo).toHaveBeenCalledOnce();
        expect(electronAPI.export.assembleAlphaVideo).toHaveBeenCalledOnce();
        expect(electronAPI.export.cleanupFrames).not.toHaveBeenCalled();
        expect(videoExport.exportState.value.phase).toBe('complete');
    });
});
