import { ref, type Ref } from 'vue';
import type { ExportDocument } from '@/types/export_types';

export type ExportPhase = 'idle' | 'preparing' | 'recording' | 'encoding' | 'complete' | 'error';

export interface ExportState {
    phase: ExportPhase;
    progress: number;
    message: string;
    error?: string;
    folderPath?: string;
}

export interface CanvasFrameExportOptions {
    fps: number;
    totalFrames: number;
    includeAudio?: boolean;
    audioPath?: string | null;
    keepRawPngFrames?: boolean;
    exportAlphaMov?: boolean;
    drawFrame: (frame: number) => Promise<void> | void;
}

/**
 * Project-first export composable used by the new ProjectEditor flow.
 *
 * Intentional constraints:
 * - This composable no longer depends on legacy TimelineDocument or song bank APIs.
 * - It keeps the existing export UX, but treats runtime-module readiness as a generic
 *   concern so future advanced modules can plug in without reintroducing scenes.
 * - It only exposes methods used by the current ProjectEditor.
 */
export function useVideoExport(
    renderCanvas: Ref<HTMLCanvasElement | null>,
    audioEl: Ref<HTMLAudioElement | null>,
    exportDocument: Ref<ExportDocument | null>,
    documentId: Ref<string>,
    isRuntimeModuleLoading: Ref<boolean>,
    areRuntimeModulesReady: Ref<boolean>,
    previewCanvas?: Ref<HTMLCanvasElement | null>,
) {
    const isRecording = ref(false);
    const ffmpegAvailable = ref<boolean | null>(null);
    const showExportModal = ref(false);
    const exportState = ref<ExportState>({
        phase: 'idle',
        progress: 0,
        message: '',
        error: undefined,
        folderPath: undefined,
    });

    let mediaRecorder: MediaRecorder | null = null;
    let recordedChunks: BlobPart[] = [];
    let recordingStartTime = 0;
    let expectedDurationMs = 0;
    let cancelFrameExport = false;
    let frameExportContext: { framesDir: string; rootDir: string; totalFrames: number; renderedFrames: number } | null = null;

    const getSettings = () => exportDocument.value?.settings || null;
    const getTitleHint = () => exportDocument.value?.title || 'export';

    const checkFfmpegAvailable = async () => {
        try {
            const ok = await (window as any).electronAPI.export.ffmpegAvailable();
            ffmpegAvailable.value = !!ok;
        } catch {
            ffmpegAvailable.value = false;
        }
    };

    const waitForPendingRuntimeModules = async (): Promise<void> => {
        if (!exportDocument.value?.hasPendingRuntimeModules) return;

        if (isRuntimeModuleLoading.value) {
            exportState.value.message = 'Waiting for pending runtime modules...';
            const maxWaitTime = 30000;
            const startTime = Date.now();

            while (isRuntimeModuleLoading.value && (Date.now() - startTime) < maxWaitTime) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            if (isRuntimeModuleLoading.value) {
                throw new Error('Pending runtime modules did not finish preparing in time');
            }
        }

        if (!areRuntimeModulesReady.value && exportDocument.value.hasPendingRuntimeModules) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    };

    const copyFontsForExport = async () => {
        const settings = getSettings();
        if (!settings) return true;

        try {
            if (settings.fontLocalPath) return true;

            const primary = String(settings.fontFamily || '');
            const fallbacks = Array.isArray(settings.fontFallbacks) ? settings.fontFallbacks : [];
            const families = [primary, ...fallbacks]
                .filter(Boolean)
                .map((value) => value.toLowerCase());

            if (!families.length) return true;

            const fonts = await (window as any).electronAPI.fonts.list();
            const matched = (fonts || []).filter((font: any) => (
                families.includes(String(font.familyGuess || '').toLowerCase())
            ));
            const filePaths = matched.map((font: any) => font.filePath).filter(Boolean);

            if (filePaths.length) {
                await (window as any).electronAPI.export.copyFontsForExport(documentId.value, filePaths);
            }

            return true;
        } catch (error) {
            console.error('Font copy failed:', error);
            return true;
        }
    };

    const cleanupFrameExport = async (framesDir: string, keepRawPngFrames: boolean) => {
        if (keepRawPngFrames) {
            exportState.value.progress = 98;
            exportState.value.message = 'Keeping raw PNG frames...';
            return;
        }

        exportState.value.message = 'Cleaning up frames...';
        exportState.value.progress = 98;
        try {
            await (window as any).electronAPI.export.cleanupFrames(framesDir);
        } catch {}
    };

    const assembleFrameOutputs = async (params: {
        framesDir: string;
        rootDir: string;
        fps: number;
        audioPath: string | null;
        keepRawPngFrames: boolean;
        exportAlphaMov: boolean;
        renderedFrames?: number;
    }) => {
        const frameLabel = params.renderedFrames
            ? ` from ${params.renderedFrames} rendered frames`
            : '';

        exportState.value.phase = 'encoding';
        exportState.value.progress = 85;
        exportState.value.message = `Assembling MP4${frameLabel}...`;

        const assembleResult = await (window as any).electronAPI.export.assembleVideo(
            params.framesDir,
            params.rootDir,
            params.fps,
            params.audioPath,
        );
        if (!assembleResult?.success) {
            throw new Error(assembleResult?.error || 'Failed to assemble MP4 video');
        }

        if (params.exportAlphaMov) {
            exportState.value.progress = 93;
            exportState.value.message = 'Encoding alpha .mov...';

            const alphaResult = await (window as any).electronAPI.export.assembleAlphaVideo(
                params.framesDir,
                params.rootDir,
                params.fps,
                params.audioPath,
            );
            if (!alphaResult?.success) {
                throw new Error(alphaResult?.error || 'Failed to assemble alpha .mov');
            }
        }

        await cleanupFrameExport(params.framesDir, params.keepRawPngFrames);
    };

    const startExport = async (onPlaybackStart?: () => void) => {
        try {
            const canvas = renderCanvas.value;
            const settings = getSettings();
            if (!canvas || !settings) {
                throw new Error('Canvas or export settings not available');
            }

            exportState.value = {
                phase: 'preparing',
                progress: 0,
                message: 'Initializing export...',
                error: undefined,
                folderPath: undefined,
            };

            exportState.value.message = 'Checking runtime modules...';
            await waitForPendingRuntimeModules();

            exportState.value.message = 'Copying fonts...';
            exportState.value.progress = 10;
            await copyFontsForExport();

            const fpsValue = Math.max(1, Number(settings.fps || 60));
            const bitrate = Math.max(1, Number(settings.exportBitrateMbps || 8));
            const stream = canvas.captureStream(fpsValue);

            try {
                if (audioEl.value && (settings.includeAudio ?? true)) {
                    const audioStream = (audioEl.value as any).captureStream
                        ? (audioEl.value as any).captureStream()
                        : null;
                    if (audioStream) {
                        for (const track of audioStream.getAudioTracks()) {
                            stream.addTrack(track);
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to add audio track:', error);
            }

            recordedChunks = [];
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9,opus',
                videoBitsPerSecond: bitrate * 1_000_000,
            } as any);

            mediaRecorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) recordedChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                try {
                    exportState.value.phase = 'encoding';
                    exportState.value.progress = 90;
                    exportState.value.message = 'Saving video file...';

                    const blob = new Blob(recordedChunks, { type: 'video/webm' });
                    const buffer = await blob.arrayBuffer();
                    const name = `export_${Date.now()}.webm`;
                    const result = await (window as any).electronAPI.export.saveWebM(
                        documentId.value,
                        buffer,
                        name,
                        getTitleHint(),
                    );

                    recordedChunks = [];
                    isRecording.value = false;

                    if (result?.filePath && result?.rootDir) {
                        try {
                            const ok = await (window as any).electronAPI.export.ffmpegAvailable();
                            if (ok) {
                                exportState.value.message = 'Encoding to MP4...';
                                exportState.value.progress = 95;
                                const mp4Out = `${result.rootDir}/export.mp4`;
                                await (window as any).electronAPI.export.encodeMp4FromWebM(
                                    result.filePath,
                                    mp4Out,
                                );
                            }
                        } catch (error) {
                            console.error('MP4 encoding failed:', error);
                        }
                    }

                    exportState.value = {
                        phase: 'complete',
                        progress: 100,
                        message: 'Export completed successfully!',
                        folderPath: result?.rootDir || '',
                    };
                } catch (error) {
                    exportState.value = {
                        phase: 'error',
                        progress: 0,
                        message: 'Export failed',
                        error: error instanceof Error ? error.message : String(error),
                    };
                }
            };

            const durationSec = Number(audioEl.value?.duration || 0) || 0;
            expectedDurationMs = durationSec > 0 ? Math.ceil(durationSec * 1000) + 250 : 5000;

            mediaRecorder.start();
            isRecording.value = true;
            recordingStartTime = Date.now();
            exportState.value.phase = 'recording';
            exportState.value.progress = 30;
            exportState.value.message = 'Recording video...';

            const progressInterval = setInterval(() => {
                if (exportState.value.phase === 'recording') {
                    const elapsed = Date.now() - recordingStartTime;
                    const progress = Math.min(85, 30 + (elapsed / expectedDurationMs) * 55);
                    exportState.value.progress = Math.round(progress);
                } else {
                    clearInterval(progressInterval);
                }
            }, 100);

            onPlaybackStart?.();

            setTimeout(() => {
                clearInterval(progressInterval);
                stopExport();
            }, expectedDurationMs);
        } catch (error) {
            exportState.value = {
                phase: 'error',
                progress: 0,
                message: 'Export failed',
                error: error instanceof Error ? error.message : String(error),
            };
            isRecording.value = false;
        }
    };

    const stopExport = () => {
        try {
            mediaRecorder?.stop();
            cancelFrameExport = true;
            if (exportState.value.phase === 'recording' && frameExportContext) {
                exportState.value.message = 'Stopping export...';
            }
        } catch (error) {
            console.error('Failed to stop recording:', error);
        }
    };

    const startCanvasFrameExport = async (options: CanvasFrameExportOptions) => {
        cancelFrameExport = false;
        let copiedAudioPath: string | null = null;

        try {
            const canvas = renderCanvas.value;
            const settings = getSettings();
            if (!canvas || !settings) {
                throw new Error('Canvas or export settings not available');
            }

            exportState.value = {
                phase: 'preparing',
                progress: 0,
                message: 'Initializing export...',
                error: undefined,
                folderPath: undefined,
            };

            exportState.value.message = 'Checking runtime modules...';
            await waitForPendingRuntimeModules();

            exportState.value.message = 'Copying fonts...';
            exportState.value.progress = 5;
            await copyFontsForExport();

            exportState.value.message = 'Creating export folder...';
            const folderResult = await (window as any).electronAPI.export.createFrameExport(
                documentId.value,
                getTitleHint(),
            );
            if (!folderResult?.rootDir || !folderResult?.framesDir) {
                throw new Error('Failed to create export folder');
            }

            const { rootDir, framesDir } = folderResult;

            const includeAudio = options.includeAudio ?? (settings.includeAudio ?? true);
            const keepRawPngFrames = options.keepRawPngFrames ?? (settings.keepRawPngFrames ?? false);
            const exportAlphaMov = options.exportAlphaMov ?? (settings.exportAlphaMov ?? false);
            if (includeAudio && options.audioPath) {
                exportState.value.message = 'Copying audio file...';
                exportState.value.progress = 10;
                try {
                    const copyResult = await (window as any).electronAPI.export.copyAudioForExport(rootDir, options.audioPath);
                    copiedAudioPath = copyResult?.success && copyResult?.audioPath
                        ? copyResult.audioPath
                        : options.audioPath;
                } catch {
                    copiedAudioPath = options.audioPath;
                }
            }

            frameExportContext = {
                framesDir,
                rootDir,
                totalFrames: options.totalFrames,
                renderedFrames: 0,
            };

            isRecording.value = true;
            exportState.value.phase = 'recording';
            exportState.value.progress = 15;
            exportState.value.message = 'Rendering frames...';

            const savePromises: Promise<any>[] = [];
            for (let frame = 0; frame < options.totalFrames; frame++) {
                if (cancelFrameExport) {
                    if (savePromises.length > 0) await Promise.all(savePromises);
                    throw new Error('Export cancelled by user');
                }

                await options.drawFrame(frame);
                const blob = await new Promise<Blob | null>((resolve) => {
                    canvas.toBlob(resolve, 'image/png', 1.0);
                });
                if (!blob) throw new Error(`Failed to capture frame ${frame}`);

                const arrayBuffer = await blob.arrayBuffer();
                const frameName = `frame_${String(frame).padStart(6, '0')}.png`;
                savePromises.push((window as any).electronAPI.export.saveFrame(framesDir, frameName, arrayBuffer));
                frameExportContext.renderedFrames = frame + 1;

                exportState.value.progress = 15 + Math.floor((frame / options.totalFrames) * 70);
                exportState.value.message = `Rendering frames... ${frame + 1} / ${options.totalFrames}`;

                if (savePromises.length >= 10) {
                    await Promise.all(savePromises);
                    savePromises.length = 0;
                }

                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            if (savePromises.length > 0) await Promise.all(savePromises);
            isRecording.value = false;
            await assembleFrameOutputs({
                framesDir,
                rootDir,
                fps: options.fps,
                audioPath: copiedAudioPath,
                keepRawPngFrames,
                exportAlphaMov,
            });

            exportState.value = {
                phase: 'complete',
                progress: 100,
                message: 'Export completed successfully!',
                folderPath: rootDir,
            };
            frameExportContext = null;
        } catch (error) {
            isRecording.value = false;

            if (
                error instanceof Error &&
                error.message === 'Export cancelled by user' &&
                frameExportContext &&
                frameExportContext.renderedFrames > 0
            ) {
                const settings = getSettings();
                const keepRawPngFrames = options.keepRawPngFrames ?? (settings?.keepRawPngFrames ?? false);
                const exportAlphaMov = options.exportAlphaMov ?? (settings?.exportAlphaMov ?? false);
                const outputLabel = exportAlphaMov ? 'export files' : 'video file';
                const shouldGenerate = globalThis.confirm(
                    `Export was stopped after rendering ${frameExportContext.renderedFrames} frames.\n\n` +
                    `Do you still want to assemble these frames into ${outputLabel}?`,
                );

                if (shouldGenerate) {
                    try {
                        await assembleFrameOutputs({
                            framesDir: frameExportContext.framesDir,
                            rootDir: frameExportContext.rootDir,
                            fps: options.fps,
                            audioPath: copiedAudioPath,
                            keepRawPngFrames,
                            exportAlphaMov,
                            renderedFrames: frameExportContext.renderedFrames,
                        });

                        exportState.value = {
                            phase: 'complete',
                            progress: 100,
                            message: `Export completed with ${frameExportContext.renderedFrames} frames!`,
                            folderPath: frameExportContext.rootDir,
                        };
                        frameExportContext = null;
                        return;
                    } catch (assembleError) {
                        exportState.value = {
                            phase: 'error',
                            progress: 0,
                            message: 'Failed to assemble video',
                            error: assembleError instanceof Error ? assembleError.message : String(assembleError),
                        };
                        frameExportContext = null;
                        return;
                    }
                }
            }

            exportState.value = {
                phase: 'error',
                progress: 0,
                message: 'Export failed',
                error: error instanceof Error ? error.message : String(error),
            };
            frameExportContext = null;
        }
    };

    const openExportModal = () => {
        showExportModal.value = true;
        exportState.value = {
            phase: 'idle',
            progress: 0,
            message: 'Choose export method',
            error: undefined,
            folderPath: undefined,
        };
    };

    const closeExportModal = () => {
        showExportModal.value = false;
        exportState.value = {
            phase: 'idle',
            progress: 0,
            message: '',
            error: undefined,
            folderPath: undefined,
        };
        isRecording.value = false;
    };

    const resetExport = () => {
        exportState.value = {
            phase: 'idle',
            progress: 0,
            message: 'Choose export method',
            error: undefined,
            folderPath: undefined,
        };
        isRecording.value = false;
    };

    return {
        isRecording,
        ffmpegAvailable,
        showExportModal,
        exportState,
        checkFfmpegAvailable,
        startExport,
        startCanvasFrameExport,
        stopExport,
        openExportModal,
        closeExportModal,
        resetExport,
    };
}
