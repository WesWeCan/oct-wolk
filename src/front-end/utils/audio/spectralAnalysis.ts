import Meyda from 'meyda';

/**
 * Result of 3-band spectral analysis.
 */
export interface SpectralBands {
    /** Low frequency energy per frame (0-200 Hz) */
    low: number[];
    /** Mid frequency energy per frame (200-2000 Hz) */
    mid: number[];
    /** High frequency energy per frame (2000+ Hz) */
    high: number[];
}

/**
 * Analyzes audio buffer and extracts 3-band frequency energies per frame.
 * 
 * Divides the frequency spectrum into three bands:
 * - Low: 0-200 Hz (bass)
 * - Mid: 200-2000 Hz (vocals, most instruments)
 * - High: 2000+ Hz (cymbals, high-frequency content)
 * 
 * Each frame gets normalized energy values (0-1) for each band.
 * 
 * @param buffer - AudioBuffer to analyze
 * @param fps - Target frames per second for analysis
 * @returns Per-frame energy values for low/mid/high bands
 */
export async function analyzeSpectralBands(
    buffer: AudioBuffer,
    fps: number
): Promise<SpectralBands> {
    const N = 1024; // FFT size
    const featureRate = 60; // Hz - compute features at 60 samples/second
    const totalSteps = Math.max(1, Math.ceil(buffer.duration * featureRate));
    
    const channelData = buffer.getChannelData(0);
    const windowed = new Float32Array(N);
    const nyquist = buffer.sampleRate / 2;
    
    // Temporary storage for feature-rate analysis
    const lowEnv: number[] = new Array(totalSteps);
    const midEnv: number[] = new Array(totalSteps);
    const highEnv: number[] = new Array(totalSteps);
    
    // Analyze at feature rate
    for (let i = 0; i < totalSteps; i++) {
        const t = i / featureRate;
        const center = Math.floor(t * buffer.sampleRate);
        const half = Math.floor(N / 2);
        const start = Math.max(0, center - half);
        const end = Math.min(channelData.length, start + N);
        
        // Apply Hann window to reduce spectral leakage
        for (let j = 0; j < N; j++) windowed[j] = 0;
        for (let j = start, k = 0; j < end && k < N; j++, k++) {
            const hannWindow = 0.5 * (1 - Math.cos((2 * Math.PI * k) / Math.max(1, N - 1)));
            windowed[k] = channelData[j] * hannWindow;
        }
        
        // Extract amplitude spectrum using Meyda
        const spectrum: number[] = (Meyda as any).extract('amplitudeSpectrum', windowed, {
            bufferSize: N,
            sampleRate: buffer.sampleRate
        }) || [];
        
        // Integrate energy in each band
        const bins = spectrum.length;
        const hzPerBin = nyquist / Math.max(1, bins);
        
        let lowSum = 0;
        let midSum = 0;
        let highSum = 0;
        
        for (let b = 0; b < bins; b++) {
            const freq = (b + 0.5) * hzPerBin;
            const energy = spectrum[b] || 0;
            
            if (freq < 200) {
                lowSum += energy;
            } else if (freq < 2000) {
                midSum += energy;
            } else {
                highSum += energy;
            }
        }
        
        // Log-compress and normalize per-step (makes values more perceptually uniform)
        const lowLog = Math.log1p(lowSum);
        const midLog = Math.log1p(midSum);
        const highLog = Math.log1p(highSum);
        const maxLog = Math.max(1e-6, lowLog, midLog, highLog);
        
        lowEnv[i] = lowLog / maxLog;
        midEnv[i] = midLog / maxLog;
        highEnv[i] = highLog / maxLog;
    }
    
    // Map to per-frame arrays at target fps
    const totalFrames = Math.max(1, Math.floor(buffer.duration * Math.max(1, fps)));
    const lowPerFrame: number[] = new Array(totalFrames);
    const midPerFrame: number[] = new Array(totalFrames);
    const highPerFrame: number[] = new Array(totalFrames);
    
    for (let f = 0; f < totalFrames; f++) {
        const t = f / Math.max(1, fps);
        const idx = Math.min(lowEnv.length - 1, Math.floor(t * featureRate));
        
        lowPerFrame[f] = lowEnv[idx] || 0;
        midPerFrame[f] = midEnv[idx] || 0;
        highPerFrame[f] = highEnv[idx] || 0;
    }
    
    return {
        low: lowPerFrame,
        mid: midPerFrame,
        high: highPerFrame
    };
}

/**
 * Computes beat strength per frame by combining beat times with energy.
 * 
 * For each frame:
 * - If a beat occurs within 0.5 frame duration, strength = energy at that frame
 * - Otherwise, strength = 0
 * 
 * This creates a pulsing effect synchronized with beats.
 * 
 * @param beatTimes - Array of beat times in seconds
 * @param energyPerFrame - Energy values (0-1) for each frame
 * @param fps - Frames per second
 * @returns Beat strength (0-1) for each frame
 */
export function computeBeatStrength(
    beatTimes: number[],
    energyPerFrame: number[],
    fps: number
): number[] {
    const totalFrames = energyPerFrame.length;
    const sortedBeats = beatTimes.slice().sort((a, b) => a - b);
    const beatStrength: number[] = new Array(totalFrames).fill(0);
    
    let beatIndex = 0;
    
    for (let f = 0; f < totalFrames; f++) {
        const frameSec = f / Math.max(1, fps);
        const tolerance = 0.5 / Math.max(1, fps); // Half a frame duration
        
        // Move beat index forward to catch up with current frame
        while (beatIndex < sortedBeats.length && sortedBeats[beatIndex] < frameSec - tolerance) {
            beatIndex++;
        }
        
        // Check if current beat is within tolerance of this frame
        const isBeat = (beatIndex < sortedBeats.length) && 
                      Math.abs(sortedBeats[beatIndex] - frameSec) <= tolerance;
        
        if (isBeat) {
            // Use energy as beat strength (0-1 range)
            beatStrength[f] = energyPerFrame[f] || 1;
        } else {
            beatStrength[f] = 0;
        }
    }
    
    return beatStrength;
}
