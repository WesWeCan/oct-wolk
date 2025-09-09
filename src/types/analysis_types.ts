export interface AnalysisCache {
    fps: number;
    durationSec: number;
    totalFrames: number;
    // Normalized 0..1 energy per frame
    energyPerFrame: number[];
    // Onset detection per frame (boolean)
    isOnsetPerFrame: boolean[];
    // Cumulative onset count per frame (monotonic)
    onsetIndexPerFrame: number[];
}


