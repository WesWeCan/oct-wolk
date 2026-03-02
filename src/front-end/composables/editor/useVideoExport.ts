import { ref, type Ref } from 'vue';
import type { TimelineDocument } from '@/types/timeline_types';

export type ExportPhase = 'idle' | 'preparing' | 'recording' | 'encoding' | 'complete' | 'error';

export interface ExportState {
    phase: ExportPhase;
    progress: number; // 0-100
    message: string;
    error?: string;
    folderPath?: string;
}

export interface CanvasFrameExportOptions {
    fps: number;
    totalFrames: number;
    includeAudio?: boolean;
    audioPath?: string | null;
    drawFrame: (frame: number) => Promise<void> | void;
}

/**
 * Video export management for the editor.
 * 
 * Responsibilities:
 * - MediaRecorder setup and control
 * - WebM recording from canvas
 * - MP4 encoding via ffmpeg (if available)
 * - .wolk project export
 * - Font copying for exports
 * - Pre-export validation (model loading)
 * - Progress tracking
 * 
 * @param renderCanvas - Canvas to record from
 * @param audioEl - Audio element (for audio track)
 * @param timeline - Timeline settings
 * @param songId - Current song ID
 * @param isModelLoading - Ref indicating if model is loading
 * @param isModelLoaded - Ref indicating if model is loaded
 * 
 * @example
 * ```typescript
 * const exporter = useVideoExport(canvas, audio, timeline, songId, isModelLoading, isModelLoaded);
 * 
 * await exporter.checkFfmpegAvailable();
 * await exporter.startExport();
 * // ... recording happens ...
 * exporter.stopExport();
 * ```
 */
export function useVideoExport(
    renderCanvas: Ref<HTMLCanvasElement | null>,
    audioEl: Ref<HTMLAudioElement | null>,
    timeline: Ref<TimelineDocument | null>,
    songId: Ref<string>,
    isModelLoading: Ref<boolean>,
    isModelLoaded: Ref<boolean>,
    previewCanvas?: Ref<HTMLCanvasElement | null>
) {
    const isRecording = ref(false);
    const ffmpegAvailable = ref<boolean | null>(null);
    const showExportModal = ref(false);
    const exportState = ref<ExportState>({
        phase: 'idle',
        progress: 0,
        message: '',
        error: undefined,
        folderPath: undefined
    });
    
    let mediaRecorder: MediaRecorder | null = null;
    let recordedChunks: BlobPart[] = [];
    let recordingStartTime = 0;
    let expectedDurationMs = 0;
    let cancelFrameExport = false;
    let frameExportContext: { framesDir: string; rootDir: string; totalFrames: number; renderedFrames: number } | null = null;
    
    /**
     * Checks if ffmpeg is available on the system.
     */
    const checkFfmpegAvailable = async () => {
        try {
            const ok = await (window as any).electronAPI.export.ffmpegAvailable();
            ffmpegAvailable.value = !!ok;
        } catch {
            ffmpegAvailable.value = false;
        }
    };
    
    /**
     * Checks if there's a ModelScene active that needs to be loaded
     */
    const hasActiveModelScene = (): boolean => {
        if (!timeline.value) return false;
        const scenes = timeline.value.scenes || [];
        return scenes.some((s: any) => s.type === 'model3d');
    };
    
    /**
     * Waits for model to finish loading if one is active
     */
    const waitForModelLoading = async (): Promise<void> => {
        if (!hasActiveModelScene()) return;
        
        // If model is currently loading, wait for it
        if (isModelLoading.value) {
            exportState.value.message = 'Waiting for 3D model to load...';
            
            // Poll until model is loaded or we timeout
            const maxWaitTime = 30000; // 30 seconds
            const startTime = Date.now();
            
            while (isModelLoading.value && (Date.now() - startTime) < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (isModelLoading.value) {
                throw new Error('Model loading timed out after 30 seconds');
            }
        }
        
        // If model hasn't been loaded at all, wait a bit for it to start
        if (!isModelLoaded.value && hasActiveModelScene()) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };
    
    /**
     * Copies required fonts to export directory.
     */
    const copyFontsForExport = async () => {
        if (!timeline.value) return;
        
        try {
            const primary = String(timeline.value.settings.fontFamily || '');
            const fallbacks = Array.isArray(timeline.value.settings.fontFallbacks)
                ? timeline.value.settings.fontFallbacks as string[]
                : [];
            
            const families = [primary, ...fallbacks]
                .filter(Boolean)
                .map(s => s.toLowerCase());
            
            if (!families.length) return;
            
            // Get system fonts
            const fonts = await (window as any).electronAPI.fonts.list();
            
            // Match fonts by family name
            const matched = (fonts || []).filter((f: any) =>
                families.includes(String(f.familyGuess || '').toLowerCase())
            );
            
            // Warn about missing fonts (just log, don't block)
            const missingFamilies = families.filter(ff =>
                !matched.find((m: any) => String(m.familyGuess || '').toLowerCase() === ff)
            );
            
            if (missingFamilies.length) {
                console.warn('Some fonts may not be available for export:', missingFamilies.join(', '));
            }
            
            // Copy matched fonts
            const filePaths = matched.map((f: any) => f.filePath);
            if (filePaths.length) {
                await (window as any).electronAPI.export.copyFontsForExport(
                    songId.value,
                    filePaths
                );
            }
            
            return true;
        } catch (error) {
            console.error('Font copy failed:', error);
            return true; // Continue anyway
        }
    };
    
    /**
     * Starts video export (WebM recording).
     */
    const startExport = async (onPlaybackStart?: () => void) => {
        try {
            // Reset state
            exportState.value = {
                phase: 'preparing',
                progress: 0,
                message: 'Initializing export...',
                error: undefined,
                folderPath: undefined
            };
            
            const canvas = renderCanvas.value;
            if (!canvas || !timeline.value) {
                throw new Error('Canvas or timeline not available');
            }
            
            // Wait for model loading if needed
            exportState.value.message = 'Checking for 3D models...';
            await waitForModelLoading();
            
            // Copy fonts
            exportState.value.message = 'Copying fonts...';
            exportState.value.progress = 10;
            const shouldContinue = await copyFontsForExport();
            if (shouldContinue === false) {
                exportState.value.phase = 'idle';
                return;
            }
            
            const fpsValue = timeline.value.settings.fps || 60;
            const bitrate = Math.max(1, Number(timeline.value.settings.exportBitrateMbps || 8));
            
            // Capture canvas stream
            exportState.value.message = 'Setting up recording...';
            exportState.value.progress = 20;
            const stream = canvas.captureStream(fpsValue);
            
            // Add audio track if enabled
            try {
                if (audioEl.value && (timeline.value.settings.includeAudio ?? true)) {
                    const audioStream = (audioEl.value as any).captureStream
                        ? (audioEl.value as any).captureStream()
                        : null;
                    
                    if (audioStream) {
                        const audioTracks = audioStream.getAudioTracks();
                        for (const track of audioTracks) {
                            stream.addTrack(track);
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to add audio track:', error);
            }
            
            // Setup MediaRecorder
            recordedChunks = [];
            const mimeType = 'video/webm;codecs=vp9,opus';
            
            mediaRecorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: bitrate * 1_000_000
            } as any);
            
            mediaRecorder.ondataavailable = (e: BlobEvent) => {
                if (e.data && e.data.size > 0) {
                    recordedChunks.push(e.data);
                }
            };
            
            mediaRecorder.onstop = async () => {
                try {
                    // Update state to encoding
                    exportState.value.phase = 'encoding';
                    exportState.value.progress = 90;
                    exportState.value.message = 'Saving video file...';
                    
                    // Create blob and save
                    const blob = new Blob(recordedChunks, { type: 'video/webm' });
                    const buffer = await blob.arrayBuffer();
                    const name = `export_${Date.now()}.webm`;
                    
                    const res = await (window as any).electronAPI.export.saveWebM(
                        songId.value,
                        buffer,
                        name
                    );
                    
                    recordedChunks = [];
                    isRecording.value = false;
                    
                    let finalPath = res?.rootDir || '';
                    
                    // Encode to MP4 if ffmpeg available
                    try {
                        const ok = await (window as any).electronAPI.export.ffmpegAvailable();
                        if (ok && res?.filePath && res?.rootDir) {
                            exportState.value.message = 'Encoding to MP4...';
                            exportState.value.progress = 95;
                            const mp4Out = res.rootDir + '/export.mp4';
                            await (window as any).electronAPI.export.encodeMp4FromWebM(
                                res.filePath,
                                mp4Out
                            );
                        }
                    } catch (error) {
                        console.error('MP4 encoding failed:', error);
                        // Continue even if MP4 encoding fails - we still have WebM
                    }
                    
                    // Complete!
                    exportState.value = {
                        phase: 'complete',
                        progress: 100,
                        message: 'Export completed successfully!',
                        folderPath: finalPath
                    };
                } catch (error) {
                    exportState.value = {
                        phase: 'error',
                        progress: 0,
                        message: 'Export failed',
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            };
            
            // Calculate expected duration
            const durationSec = Number.isFinite(audioEl.value?.duration || 0)
                ? (audioEl.value?.duration || 0)
                : 0;
            
            expectedDurationMs = durationSec > 0 ? Math.ceil(durationSec * 1000) + 250 : 5000;
            
            // Start recording
            mediaRecorder.start();
            isRecording.value = true;
            recordingStartTime = Date.now();
            
            // Update state to recording
            exportState.value.phase = 'recording';
            exportState.value.progress = 30;
            exportState.value.message = 'Recording video...';
            
            // Start progress tracking
            const progressInterval = setInterval(() => {
                if (exportState.value.phase === 'recording') {
                    const elapsed = Date.now() - recordingStartTime;
                    const progress = Math.min(85, 30 + (elapsed / expectedDurationMs) * 55);
                    exportState.value.progress = Math.round(progress);
                }
            }, 100);
            
            // Start playback
            onPlaybackStart?.();
            
            // Auto-stop after duration
            setTimeout(() => {
                clearInterval(progressInterval);
                stopExport();
            }, expectedDurationMs);
            
        } catch (error) {
            exportState.value = {
                phase: 'error',
                progress: 0,
                message: 'Export failed',
                error: error instanceof Error ? error.message : String(error)
            };
            isRecording.value = false;
        }
    };
    
    /**
     * Stops video export.
     */
    const stopExport = () => {
        try {
            mediaRecorder?.stop();
            cancelFrameExport = true;
            // If we're in frame export, update state to show cancellation
            if (exportState.value.phase === 'recording' && frameExportContext) {
                exportState.value.message = 'Stopping export...';
            }
        } catch (error) {
            console.error('Failed to stop recording:', error);
        }
    };
    
    /**
     * Starts frame-by-frame export (renders each frame to PNG).
     */
    const startFrameExport = async (
        renderWorker: any,
        frameRenderer: any,
        drawPreview: () => void,
        fps: number,
        totalFrames: number,
        configureSceneForFrame?: (frame: number) => Promise<{ isEmpty: boolean } | void>
    ) => {
        cancelFrameExport = false;
        
        // Declare workerMessageHandler outside try block so it's accessible in finally
        let workerMessageHandler: ((e: MessageEvent) => void) | null = null;
        
        try {
            // Reset state
            exportState.value = {
                phase: 'preparing',
                progress: 0,
                message: 'Initializing export...',
                error: undefined,
                folderPath: undefined
            };
            
            if (!renderCanvas.value || !timeline.value) {
                throw new Error('Canvas or timeline not available');
            }
            
            const targetWidth = timeline.value.settings.renderWidth || 1920;
            const targetHeight = timeline.value.settings.renderHeight || 1080;
            
            // Wait for model loading if needed
            exportState.value.message = 'Checking for 3D models...';
            await waitForModelLoading();
            
            // Copy fonts
            exportState.value.message = 'Copying fonts...';
            exportState.value.progress = 5;
            const shouldContinue = await copyFontsForExport();
            if (shouldContinue === false) {
                closeExportModal();
                return;
            }
            
            // Create export folder
            exportState.value.message = 'Creating export folder...';
            exportState.value.progress = 5;
            
            const res = await (window as any).electronAPI.export.createFrameExport(songId.value);
            if (!res?.rootDir || !res?.framesDir) {
                throw new Error('Failed to create export folder');
            }
            
            const { rootDir, framesDir } = res;
            
            // Copy audio file FIRST (before rendering) so we fail early if there's an issue
            exportState.value.message = 'Copying audio file...';
            exportState.value.progress = 10;
            let copiedAudioPath: string | null = null;
            const includeAudio = timeline.value.settings.includeAudio ?? true;
            if (includeAudio) {
                // Try to get the original audio path from the song
                const songData = await (window as any).electronAPI.songs.load(songId.value);
                let sourceAudioPath: string | null = null;
                if (songData?.audioSrc) {
                    sourceAudioPath = songData.audioSrc;
                } else if (audioEl.value?.src && !audioEl.value.src.startsWith('blob:')) {
                    sourceAudioPath = audioEl.value.src;
                }
                
                // Copy audio file to export folder
                if (sourceAudioPath) {
                    try {
                        // Check if the handler exists
                        if (typeof (window as any).electronAPI?.export?.copyAudioForExport !== 'function') {
                            console.warn('copyAudioForExport handler not available - backend may need restart');
                            // Fallback: try to use the source path directly (will be handled in assembleVideo)
                            copiedAudioPath = sourceAudioPath;
                        } else {
                            const copyResult = await (window as any).electronAPI.export.copyAudioForExport(rootDir, sourceAudioPath);
                            if (copyResult?.success && copyResult?.audioPath) {
                                copiedAudioPath = copyResult.audioPath;
                            } else {
                                console.warn('Failed to copy audio file:', copyResult?.error);
                                // Fallback: use source path directly
                                copiedAudioPath = sourceAudioPath;
                            }
                        }
                    } catch (error) {
                        console.error('Error copying audio file:', error);
                        // Fallback: use source path directly (assembleVideo will handle conversion)
                        copiedAudioPath = sourceAudioPath;
                    }
                }
            }
            
            // Store context for potential recovery after cancellation
            frameExportContext = { framesDir, rootDir, totalFrames, renderedFrames: 0 };
            
            // Start rendering frames
            exportState.value.phase = 'recording';
            exportState.value.message = 'Rendering frames...';
            exportState.value.progress = 15;
            isRecording.value = true;
            
            const framePromises: Promise<void>[] = [];
            
            // Setup a promise that resolves when worker finishes rendering
            let resolveRender: (() => void) | null = null;
            const renderCompleteHandler = (frame: number) => {
                if (resolveRender) {
                    resolveRender();
                    resolveRender = null;
                }
            };
            
            // Store original handler and chain it with our export handler
            // Note: onRenderComplete only supports one callback, so we need to chain manually
            // We'll listen directly to worker messages instead
            if (!renderWorker.workerRef.value) {
                throw new Error('Worker not available for export');
            }
            workerMessageHandler = (e: MessageEvent) => {
                const data = e.data;
                if (data?.type === 'rendered') {
                    renderCompleteHandler(data.frame);
                }
            };
            renderWorker.workerRef.value.addEventListener('message', workerMessageHandler);
            
            // Trigger initial scene configuration to ensure everything is loaded
            exportState.value.message = 'Initializing scene...';
            
            // Wait for initialization frame to render
            const initRenderPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Initialization frame render timeout'));
                }, 10000);
                resolveRender = () => {
                    clearTimeout(timeout);
                    resolve();
                    resolveRender = null;
                };
            });
            frameRenderer.sendFrameToWorker(0, 1 / fps);
            await initRenderPromise;
            
            // Track last rendered frame for copying empty frames
            let lastRenderedFrameBlob: ArrayBuffer | null = null;
            let lastRenderedFrameNumber = -1;
            // Track empty frame buffer (rendered once, reused for all empty frames)
            let emptyFrameBlob: ArrayBuffer | null = null;
            
            // Start from frame 0 (we already rendered it for initialization, but we need to capture it)
            for (let frame = 0; frame < totalFrames; frame++) {
                // Check if cancel was requested
                if (cancelFrameExport) {
                    // Wait for remaining frames to save
                    if (framePromises.length > 0) {
                        await Promise.all(framePromises);
                    }
                    throw new Error('Export cancelled by user');
                }
                
                // Configure scene for this frame if configure function provided
                let isEmpty = false;
                if (configureSceneForFrame) {
                    const result = await configureSceneForFrame(frame);
                    isEmpty = result && typeof result === 'object' && result.isEmpty === true;
                }
                
                let arrayBuffer: ArrayBuffer;
                const frameName = `frame_${String(frame).padStart(6, '0')}.png`;
                
                // Check if this is an empty frame
                if (isEmpty) {
                    // Empty frame - use cached empty frame or create one
                    if (emptyFrameBlob) {
                        // Reuse existing empty frame
                        arrayBuffer = emptyFrameBlob.slice(0);
                    } else {
                        // Create empty frame programmatically (black frame)
                        // Create a blank canvas and convert to PNG
                        const blankCanvas = document.createElement('canvas');
                        blankCanvas.width = targetWidth;
                        blankCanvas.height = targetHeight;
                        const blankCtx = blankCanvas.getContext('2d');
                        if (!blankCtx) {
                            throw new Error('Failed to create blank canvas context');
                        }
                        
                        // Fill with black
                        blankCtx.fillStyle = '#000000';
                        blankCtx.fillRect(0, 0, targetWidth, targetHeight);
                        
                        // Convert to blob
                        const blankBlob = await new Promise<Blob | null>((resolve) => {
                            blankCanvas.toBlob(resolve, 'image/png', 1.0);
                        });
                        
                        if (!blankBlob) {
                            throw new Error('Failed to create empty frame');
                        }
                        
                        emptyFrameBlob = await blankBlob.arrayBuffer();
                        arrayBuffer = emptyFrameBlob.slice(0);
                    }
                } else {
                    // Render this frame
                    // Wait for this frame to render - set up promise BEFORE sending frame
                    const renderPromise = new Promise<void>((resolve, reject) => {
                        // Add timeout to detect stuck renders
                        const timeout = setTimeout(() => {
                            if (cancelFrameExport) {
                                reject(new Error('Export cancelled'));
                            } else {
                                reject(new Error(`Frame ${frame} render timeout`));
                            }
                        }, 10000); // 10 second timeout
                        
                        resolveRender = () => {
                            clearTimeout(timeout);
                            resolve();
                            resolveRender = null;
                        };
                    });
                    
                    // Send frame to worker
                    frameRenderer.sendFrameToWorker(frame, 1 / fps);
                    
                    // Wait for worker to finish rendering this frame
                    await renderPromise;
                    
                    // Small delay to ensure render is fully complete before capture
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    // Check cancellation again before capture
                    if (cancelFrameExport) {
                        throw new Error('Export cancelled by user');
                    }
                    
                    // Capture frame from worker (canvas is OffscreenCanvas, so we need worker to send it back)
                    const blob = await renderWorker.captureFrame(frame);
                    
                    if (!blob) {
                        throw new Error(`Failed to capture frame ${frame}`);
                    }
                    
                    // Convert to ArrayBuffer
                    arrayBuffer = await blob.arrayBuffer();
                    
                    // Store for potential copying
                    lastRenderedFrameBlob = arrayBuffer;
                    lastRenderedFrameNumber = frame;
                }
                
                // Save frame
                framePromises.push(
                    (window as any).electronAPI.export.saveFrame(framesDir, frameName, arrayBuffer)
                );
                
                // Track rendered frames
                frameExportContext!.renderedFrames = frame + 1;
                
                // Update progress (15-85% for rendering, audio already done)
                const progress = 15 + Math.floor((frame / totalFrames) * 70);
                exportState.value.progress = progress;
                exportState.value.message = `Rendering frames... ${frame + 1} / ${totalFrames}`;
                
                // Batch save frames to avoid overwhelming IPC
                if (framePromises.length >= 10) {
                    await Promise.all(framePromises);
                    framePromises.length = 0;
                }
            }
            
            // Wait for remaining frames to save
            if (framePromises.length > 0) {
                await Promise.all(framePromises);
            }
            
            isRecording.value = false;
            
            // Assemble video with ffmpeg
            // Note: Audio is only added during this final assembly phase.
            // If export is stopped early, frames will be saved but video won't have audio.
            exportState.value.phase = 'encoding';
            exportState.value.progress = 85;
            exportState.value.message = 'Assembling video with ffmpeg...';
            
            // Use the audio path we copied earlier
            const assembleResult = await (window as any).electronAPI.export.assembleVideo(
                framesDir,
                rootDir,
                fps,
                copiedAudioPath
            );
            
            if (!assembleResult?.success) {
                throw new Error(assembleResult?.error || 'Failed to assemble video');
            }
            
            // Clean up frames after successful video creation
            exportState.value.message = 'Cleaning up frames...';
            exportState.value.progress = 98;
            try {
                await (window as any).electronAPI.export.cleanupFrames(framesDir);
            } catch (e) {
                console.warn('Failed to cleanup frames:', e);
                // Continue even if cleanup fails
            }
            
            // Complete!
            exportState.value = {
                phase: 'complete',
                progress: 100,
                message: 'Export completed successfully!',
                folderPath: rootDir
            };
            
            frameExportContext = null;
            
        } catch (error) {
            isRecording.value = false;
            
            // If cancelled and we have frames, offer to generate video
            if (error instanceof Error && error.message === 'Export cancelled by user' && frameExportContext && frameExportContext.renderedFrames > 0) {
                const shouldGenerate = await new Promise<boolean>((resolve) => {
                    const result = globalThis.confirm(
                        `Export was stopped after rendering ${frameExportContext!.renderedFrames} frames.\n\n` +
                        `Would you like to generate a video from these frames?`
                    );
                    resolve(result);
                });
                
                if (shouldGenerate) {
                    try {
                        // Assemble video with frames we have
                        exportState.value.phase = 'encoding';
                        exportState.value.progress = 85;
                        exportState.value.message = `Assembling video from ${frameExportContext.renderedFrames} frames...`;
                        
                        const includeAudio = timeline.value?.settings.includeAudio ?? true;
                        // Get audio path - use the actual audio source path, not blob URL
                        let audioPath: string | null = null;
                        if (includeAudio && audioEl.value?.src) {
                            // Try to get the original audio path from the song
                            const songData = await (window as any).electronAPI.songs.load(songId.value);
                            audioPath = songData?.audioSrc || audioEl.value.src;
                        }
                        
                        const assembleResult = await (window as any).electronAPI.export.assembleVideo(
                            frameExportContext.framesDir,
                            frameExportContext.rootDir,
                            fps,
                            audioPath
                        );
                        
                        if (!assembleResult?.success) {
                            throw new Error(assembleResult?.error || 'Failed to assemble video');
                        }
                        
                        // Clean up frames after successful video creation
                        exportState.value.message = 'Cleaning up frames...';
                        exportState.value.progress = 98;
                        try {
                            await (window as any).electronAPI.export.cleanupFrames(frameExportContext.framesDir);
                        } catch (e) {
                            console.warn('Failed to cleanup frames:', e);
                        }
                        
                        // Complete!
                        exportState.value = {
                            phase: 'complete',
                            progress: 100,
                            message: `Export completed with ${frameExportContext.renderedFrames} frames!`,
                            folderPath: frameExportContext.rootDir
                        };
                        
                        frameExportContext = null;
                        return;
                    } catch (assembleError) {
                        exportState.value = {
                            phase: 'error',
                            progress: 0,
                            message: 'Failed to assemble video',
                            error: assembleError instanceof Error ? assembleError.message : String(assembleError)
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
                error: error instanceof Error ? error.message : String(error)
            };
            frameExportContext = null;
        } finally {
            // Clean up worker message listener
            if (renderWorker.workerRef.value && workerMessageHandler) {
                renderWorker.workerRef.value.removeEventListener('message', workerMessageHandler);
            }
        }
    };

    /**
     * Starts frame-by-frame export from a main-thread canvas renderer.
     * This is used by Motion mode where rendering is done directly on canvas.
     */
    const startCanvasFrameExport = async (
        options: CanvasFrameExportOptions,
    ) => {
        cancelFrameExport = false;
        const fps = Math.max(1, Math.round(options.fps || 60));
        const totalFrames = Math.max(1, Math.round(options.totalFrames || 1));
        let copiedAudioPath: string | null = null;

        try {
            exportState.value = {
                phase: 'preparing',
                progress: 0,
                message: 'Initializing export...',
                error: undefined,
                folderPath: undefined
            };

            const canvas = renderCanvas.value;
            if (!canvas || !timeline.value) {
                throw new Error('Canvas or timeline not available');
            }

            exportState.value.message = 'Copying fonts...';
            exportState.value.progress = 5;
            await copyFontsForExport();

            exportState.value.message = 'Creating export folder...';
            const res = await (window as any).electronAPI.export.createFrameExport(songId.value);
            if (!res?.rootDir || !res?.framesDir) {
                throw new Error('Failed to create export folder');
            }
            const { rootDir, framesDir } = res;

            const includeAudio = options.includeAudio ?? (timeline.value.settings.includeAudio ?? true);
            if (includeAudio && options.audioPath) {
                exportState.value.message = 'Copying audio file...';
                exportState.value.progress = 10;
                try {
                    if (typeof (window as any).electronAPI?.export?.copyAudioForExport === 'function') {
                        const copyResult = await (window as any).electronAPI.export.copyAudioForExport(rootDir, options.audioPath);
                        if (copyResult?.success && copyResult?.audioPath) {
                            copiedAudioPath = copyResult.audioPath;
                        } else {
                            copiedAudioPath = options.audioPath;
                        }
                    } else {
                        copiedAudioPath = options.audioPath;
                    }
                } catch {
                    copiedAudioPath = options.audioPath;
                }
            }

            frameExportContext = { framesDir, rootDir, totalFrames, renderedFrames: 0 };
            isRecording.value = true;
            exportState.value.phase = 'recording';
            exportState.value.progress = 15;
            exportState.value.message = 'Rendering frames...';

            const framePromises: Promise<void>[] = [];
            for (let frame = 0; frame < totalFrames; frame++) {
                if (cancelFrameExport) {
                    if (framePromises.length > 0) await Promise.all(framePromises);
                    throw new Error('Export cancelled by user');
                }

                await options.drawFrame(frame);
                const blob = await new Promise<Blob | null>((resolve) => {
                    canvas.toBlob(resolve, 'image/png', 1.0);
                });
                if (!blob) throw new Error(`Failed to capture frame ${frame}`);
                const arrayBuffer = await blob.arrayBuffer();
                const frameName = `frame_${String(frame).padStart(6, '0')}.png`;

                framePromises.push(
                    (window as any).electronAPI.export.saveFrame(framesDir, frameName, arrayBuffer)
                );
                frameExportContext.renderedFrames = frame + 1;

                const progress = 15 + Math.floor((frame / totalFrames) * 70);
                exportState.value.progress = progress;
                exportState.value.message = `Rendering frames... ${frame + 1} / ${totalFrames}`;

                if (framePromises.length >= 10) {
                    await Promise.all(framePromises);
                    framePromises.length = 0;
                }

                // Yield to keep UI responsive during long exports.
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            if (framePromises.length > 0) await Promise.all(framePromises);
            isRecording.value = false;

            exportState.value.phase = 'encoding';
            exportState.value.progress = 85;
            exportState.value.message = 'Assembling video with ffmpeg...';

            const assembleResult = await (window as any).electronAPI.export.assembleVideo(
                framesDir,
                rootDir,
                fps,
                copiedAudioPath
            );
            if (!assembleResult?.success) {
                throw new Error(assembleResult?.error || 'Failed to assemble video');
            }

            exportState.value.message = 'Cleaning up frames...';
            exportState.value.progress = 98;
            try {
                await (window as any).electronAPI.export.cleanupFrames(framesDir);
            } catch {}

            exportState.value = {
                phase: 'complete',
                progress: 100,
                message: 'Export completed successfully!',
                folderPath: rootDir
            };
            frameExportContext = null;
        } catch (error) {
            isRecording.value = false;

            if (error instanceof Error && error.message === 'Export cancelled by user' && frameExportContext && frameExportContext.renderedFrames > 0) {
                const shouldGenerate = await new Promise<boolean>((resolve) => {
                    const result = globalThis.confirm(
                        `Export was stopped after rendering ${frameExportContext!.renderedFrames} frames.\n\n` +
                        `Do you still want to assemble these frames into a video file?`
                    );
                    resolve(result);
                });

                if (shouldGenerate) {
                    try {
                        exportState.value.phase = 'encoding';
                        exportState.value.progress = 85;
                        exportState.value.message = `Assembling video from ${frameExportContext.renderedFrames} frames...`;

                        const assembleResult = await (window as any).electronAPI.export.assembleVideo(
                            frameExportContext.framesDir,
                            frameExportContext.rootDir,
                            fps,
                            copiedAudioPath
                        );
                        if (!assembleResult?.success) {
                            throw new Error(assembleResult?.error || 'Failed to assemble video');
                        }

                        exportState.value.message = 'Cleaning up frames...';
                        exportState.value.progress = 98;
                        try {
                            await (window as any).electronAPI.export.cleanupFrames(frameExportContext.framesDir);
                        } catch {}

                        exportState.value = {
                            phase: 'complete',
                            progress: 100,
                            message: `Export completed with ${frameExportContext.renderedFrames} frames!`,
                            folderPath: frameExportContext.rootDir
                        };
                        frameExportContext = null;
                        return;
                    } catch (assembleError) {
                        exportState.value = {
                            phase: 'error',
                            progress: 0,
                            message: 'Failed to assemble video',
                            error: assembleError instanceof Error ? assembleError.message : String(assembleError)
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
                error: error instanceof Error ? error.message : String(error)
            };
            frameExportContext = null;
        }
    };
    
    /**
     * Opens the export modal.
     */
    const openExportModal = () => {
        showExportModal.value = true;
        exportState.value = {
            phase: 'idle',
            progress: 0,
            message: 'Choose export method',
            error: undefined,
            folderPath: undefined
        };
    };
    
    /**
     * Closes the export modal.
     */
    const closeExportModal = () => {
        showExportModal.value = false;
        exportState.value = {
            phase: 'idle',
            progress: 0,
            message: '',
            error: undefined,
            folderPath: undefined
        };
        isRecording.value = false;
    };
    
    /**
     * Resets export state (for retry).
     */
    const resetExport = () => {
        exportState.value = {
            phase: 'idle',
            progress: 0,
            message: 'Choose export method',
            error: undefined,
            folderPath: undefined
        };
        isRecording.value = false;
    };
    
    /**
     * Exports project as .wolk file (zipped project folder).
     */
    const exportWolk = async (song: { id: string; title: string }) => {
        try {
            const safeTitle = (song.title || 'project')
                .replace(/[^a-zA-Z0-9-_\.]+/g, '_');
            
            await (window as any).electronAPI.export.packageWolk(
                song.id,
                `${safeTitle}.wolk`
            );
        } catch (error) {
            console.error('Wolk export failed:', error);
        }
    };
    
    return {
        isRecording,
        ffmpegAvailable,
        showExportModal,
        exportState,
        checkFfmpegAvailable,
        startExport,
        startFrameExport,
        startCanvasFrameExport,
        stopExport,
        openExportModal,
        closeExportModal,
        resetExport,
        exportWolk,
    };
}
