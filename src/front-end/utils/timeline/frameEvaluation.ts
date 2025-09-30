import type { AnalysisCache } from '@/types/analysis_types';

/**
 * Evaluates beat energy value for a specific frame.
 * 
 * Uses precomputed analysis cache for deterministic playback.
 * Falls back to live beat envelope if cache is not available.
 * 
 * @param frame - Frame number
 * @param analysisCache - Precomputed analysis data
 * @param liveBeatEnvelope - Real-time beat envelope (fallback)
 * @returns Beat energy value (0-1)
 */
export function evalBeatForFrame(
    frame: number,
    analysisCache: AnalysisCache | null,
    liveBeatEnvelope = 0
): number {
    if (!analysisCache) {
        return liveBeatEnvelope;
    }
    
    const frameIndex = Math.min(
        analysisCache.totalFrames - 1,
        Math.max(0, Math.floor(frame))
    );
    
    return Math.min(1, Math.max(0, analysisCache.energyPerFrame[frameIndex] || 0));
}

/**
 * Evaluates word index for a specific frame.
 * 
 * Word index determines which word in the pool to display.
 * It increments at beats or onsets (depending on scene configuration).
 * 
 * Priority order:
 * 1. Beat-based index (if beatTimes available)
 * 2. Onset-based index (from analysis cache)
 * 3. Fallback: frame / 30 (changes word every 30 frames)
 * 
 * @param frame - Frame number
 * @param beatIndexPerFrame - Cumulative beat count per frame
 * @param onsetIndexPerFrame - Cumulative onset count per frame
 * @param fps - Frames per second (for fallback calculation)
 * @returns Word index (monotonically increasing integer)
 */
export function evalWordIndexForFrame(
    frame: number,
    beatIndexPerFrame: number[] | null,
    onsetIndexPerFrame: number[] | null,
    fps: number
): number {
    const frameIndex = Math.max(0, Math.floor(frame));
    
    // Priority 1: Use beat-based index
    if (beatIndexPerFrame && beatIndexPerFrame.length > frameIndex) {
        return beatIndexPerFrame[frameIndex] || 0;
    }
    
    // Priority 2: Use onset-based index
    if (onsetIndexPerFrame && onsetIndexPerFrame.length > frameIndex) {
        return onsetIndexPerFrame[frameIndex] || 0;
    }
    
    // Fallback: Change word every ~30 frames (assumes 60fps = ~0.5s per word)
    return Math.floor(frame / Math.max(1, Math.floor(fps / 2)));
}

/**
 * Computes beat-based cumulative index per frame.
 * 
 * For each frame, counts how many beats have occurred up to that point.
 * This creates a monotonically increasing index that increments at beats.
 * 
 * @param beatTimesSec - Array of beat times in seconds
 * @param totalFrames - Total number of frames
 * @param fps - Frames per second
 * @returns Cumulative beat count per frame
 */
export function computeBeatIndexPerFrame(
    beatTimesSec: number[],
    totalFrames: number,
    fps: number
): number[] {
    const sortedBeats = beatTimesSec.slice().sort((a, b) => a - b);
    const indexPerFrame: number[] = new Array(totalFrames);
    
    let beatCount = 0;
    let beatIndex = 0;
    
    for (let f = 0; f < totalFrames; f++) {
        const frameSec = f / Math.max(1, fps);
        
        // Count all beats that have occurred by this frame
        while (beatIndex < sortedBeats.length && sortedBeats[beatIndex] <= frameSec) {
            beatCount++;
            beatIndex++;
        }
        
        indexPerFrame[f] = beatCount;
    }
    
    return indexPerFrame;
}

/**
 * Computes onset-based cumulative index per frame.
 * 
 * For each frame, counts how many onsets have occurred up to that point.
 * Onsets are detected from energy threshold crossings.
 * 
 * @param isOnsetPerFrame - Boolean array indicating onset at each frame
 * @returns Cumulative onset count per frame
 */
export function computeOnsetIndexPerFrame(
    isOnsetPerFrame: boolean[]
): number[] {
    const indexPerFrame: number[] = new Array(isOnsetPerFrame.length);
    let count = 0;
    
    for (let i = 0; i < isOnsetPerFrame.length; i++) {
        if (isOnsetPerFrame[i]) {
            count++;
        }
        indexPerFrame[i] = count;
    }
    
    return indexPerFrame;
}
