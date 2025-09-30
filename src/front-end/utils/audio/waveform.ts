/**
 * Computes waveform visualization data from audio buffer.
 * 
 * Divides the audio into buckets and finds the min/max peak
 * values in each bucket for efficient rendering. Each bucket
 * contributes two values (max, min) to enable waveform drawing.
 * 
 * @param buffer - AudioBuffer to analyze
 * @param buckets - Number of visualization buckets (default: 1000)
 * @returns Array of [max, min] pairs for each bucket (length = buckets * 2)
 * 
 * @example
 * ```typescript
 * const buffer = await audioContext.decodeAudioData(arrayBuffer);
 * const peaks = computeWaveform(buffer, 1000);
 * // peaks = [max0, min0, max1, min1, ..., max999, min999]
 * ```
 */
export function computeWaveform(
    buffer: AudioBuffer, 
    buckets = 1000
): number[] {
    const channelData = buffer.getChannelData(0); // Use first channel (mono or left)
    const samplesPerBucket = Math.max(1, Math.floor(channelData.length / buckets));
    const peaks: number[] = [];
    
    for (let i = 0; i < buckets; i++) {
        const start = i * samplesPerBucket;
        let min = 1;   // Audio samples are normalized to [-1, 1]
        let max = -1;
        
        // Find min/max in this bucket
        for (let j = 0; j < samplesPerBucket && start + j < channelData.length; j++) {
            const sample = channelData[start + j];
            if (sample < min) min = sample;
            if (sample > max) max = sample;
        }
        
        // Store as [max, min] pairs for waveform rendering
        peaks.push(max, min);
    }
    
    return peaks;
}
