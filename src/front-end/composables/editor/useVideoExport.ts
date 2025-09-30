import { ref, type Ref } from 'vue';
import type { TimelineDocument } from '@/types/timeline_types';

/**
 * Video export management for the editor.
 * 
 * Responsibilities:
 * - MediaRecorder setup and control
 * - WebM recording from canvas
 * - MP4 encoding via ffmpeg (if available)
 * - .wolk project export
 * - Font copying for exports
 * 
 * @param renderCanvas - Canvas to record from
 * @param audioEl - Audio element (for audio track)
 * @param timeline - Timeline settings
 * @param songId - Current song ID
 * 
 * @example
 * ```typescript
 * const exporter = useVideoExport(canvas, audio, timeline, songId);
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
    songId: Ref<string>
) {
    const isRecording = ref(false);
    const ffmpegAvailable = ref<boolean | null>(null);
    
    let mediaRecorder: MediaRecorder | null = null;
    let recordedChunks: BlobPart[] = [];
    
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
            
            // Warn about missing fonts
            const missingFamilies = families.filter(ff =>
                !matched.find((m: any) => String(m.familyGuess || '').toLowerCase() === ff)
            );
            
            if (missingFamilies.length) {
                const proceed = globalThis.confirm(
                    `Some fonts may be missing: ${missingFamilies.join(', ')}. Continue anyway?`
                );
                if (!proceed) return false;
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
        const canvas = renderCanvas.value;
        if (!canvas || !timeline.value) return;
        
        // Copy fonts first
        const shouldContinue = await copyFontsForExport();
        if (shouldContinue === false) return;
        
        const fpsValue = timeline.value.settings.fps || 60;
        const bitrate = Math.max(1, Number(timeline.value.settings.exportBitrateMbps || 8));
        
        // Capture canvas stream
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
            
            // Encode to MP4 if ffmpeg available
            try {
                const ok = await (window as any).electronAPI.export.ffmpegAvailable();
                if (ok && res?.filePath && res?.rootDir) {
                    const mp4Out = res.rootDir + '/export.mp4';
                    await (window as any).electronAPI.export.encodeMp4FromWebM(
                        res.filePath,
                        mp4Out
                    );
                }
            } catch (error) {
                console.error('MP4 encoding failed:', error);
            }
        };
        
        // Start recording
        mediaRecorder.start();
        isRecording.value = true;
        
        // Start playback
        onPlaybackStart?.();
        
        // Auto-stop after duration
        const durationSec = Number.isFinite(audioEl.value?.duration || 0)
            ? (audioEl.value?.duration || 0)
            : 0;
        
        if (durationSec > 0) {
            setTimeout(() => {
                stopExport();
            }, Math.ceil(durationSec * 1000) + 250);
        } else {
            // Fallback: record 5 seconds
            setTimeout(() => {
                stopExport();
            }, 5000);
        }
    };
    
    /**
     * Stops video export.
     */
    const stopExport = () => {
        try {
            mediaRecorder?.stop();
        } catch (error) {
            console.error('Failed to stop recording:', error);
        }
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
        checkFfmpegAvailable,
        startExport,
        stopExport,
        exportWolk,
    };
}
