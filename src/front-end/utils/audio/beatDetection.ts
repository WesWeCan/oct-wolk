/**
 * Detects beat times using RMS envelope and peak picking.
 * 
 * Algorithm:
 * 1. Compute RMS (root-mean-square) envelope at ~60Hz
 * 2. Normalize envelope to 0-1 range
 * 3. Find local maxima above threshold
 * 
 * This is a simple but effective beat detection algorithm suitable
 * for most music. More sophisticated algorithms would use spectral flux
 * or machine learning.
 * 
 * @param buffer - AudioBuffer to analyze
 * @param threshold - Energy threshold (0-1, default: 0.6)
 * @returns Array of beat times in seconds
 * 
 * @example
 * ```typescript
 * const buffer = await audioContext.decodeAudioData(arrayBuffer);
 * const beats = detectBeats(buffer, 0.6);
 * // beats = [0.5, 1.0, 1.5, 2.0, ...] (in seconds)
 * ```
 */
export function detectBeats(
    buffer: AudioBuffer,
    threshold = 0.6
): number[] {
    const signal = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    // Analysis parameters
    const envelopeRate = 60; // Hz - compute envelope at ~60 samples per second
    const hop = Math.max(1, Math.floor(sampleRate / envelopeRate));
    const windowSize = Math.max(1, Math.floor(sampleRate * 0.05)); // 50ms window
    
    // Step 1: Compute RMS envelope
    const envelope: number[] = [];
    
    for (let i = 0; i < signal.length; i += hop) {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(signal.length, start + windowSize);
        
        // Calculate RMS (root mean square) for this window
        let sumSquares = 0;
        for (let j = start; j < end; j++) {
            sumSquares += signal[j] * signal[j];
        }
        
        const rms = Math.sqrt(sumSquares / Math.max(1, end - start));
        envelope.push(rms);
    }
    
    // Step 2: Normalize envelope to 0-1 range
    const maxEnvelope = Math.max(...envelope, 1e-6); // Avoid division by zero
    for (let i = 0; i < envelope.length; i++) {
        envelope[i] = envelope[i] / maxEnvelope;
    }
    
    // Step 3: Peak picking - find local maxima above threshold
    const beatTimes: number[] = [];
    
    for (let i = 1; i < envelope.length - 1; i++) {
        const current = envelope[i];
        const prev = envelope[i - 1];
        const next = envelope[i + 1];
        
        // Check if this is a local maximum above threshold
        const isLocalMax = current > prev && current >= next;
        const isAboveThreshold = current > threshold;
        
        if (isLocalMax && isAboveThreshold) {
            const timeSec = (i * hop) / sampleRate;
            beatTimes.push(timeSec);
        }
    }
    
    return beatTimes;
}
