import { ref, type Ref } from 'vue';
import { AnalysisService } from '@/front-end/services/AnalysisService';
import { computeWaveform } from '@/front-end/utils/audio/waveform';
import { detectBeats } from '@/front-end/utils/audio/beatDetection';
import { analyzeSpectralBands, computeBeatStrength } from '@/front-end/utils/audio/spectralAnalysis';
import type { AnalysisCache } from '@/types/analysis_types';

/**
 * Audio analysis management for the editor.
 * 
 * Responsibilities:
 * - Waveform computation for visualization
 * - Beat detection using RMS envelope
 * - Spectral analysis (3-band frequencies)
 * - Beat strength computation per frame
 * - Analysis caching for deterministic playback
 * 
 * @param fps - Frames per second for frame-based analysis
 * 
 * @example
 * ```typescript
 * const analysis = useAudioAnalysis(fps);
 * await analysis.analyzeBuffer(audioBuffer);
 * 
 * // Access results
 * console.log(analysis.beatTimesSec.value); // [0.5, 1.0, 1.5, ...]
 * console.log(analysis.waveform.value); // [max, min, max, min, ...]
 * ```
 */
export function useAudioAnalysis(fps: Ref<number>) {
    const waveform = ref<number[] | null>(null);
    const beatTimesSec = ref<number[]>([]);
    const analysisCache = ref<AnalysisCache | null>(null);
    const bandsLowPerFrame = ref<number[]>([]);
    const bandsMidPerFrame = ref<number[]>([]);
    const bandsHighPerFrame = ref<number[]>([]);
    const beatStrengthPerFrame = ref<number[]>([]);
    const isAnalyzing = ref(false);
    
    /**
     * Runs full audio analysis pipeline on a buffer.
     * 
     * Performs:
     * 1. Waveform extraction (for timeline visualization)
     * 2. Beat detection (for word timing)
     * 3. Energy/onset analysis per frame
     * 4. Spectral band analysis (low/mid/high frequencies)
     * 5. Beat strength computation
     * 
     * @param buffer - AudioBuffer to analyze
     */
    const analyzeBuffer = async (buffer: AudioBuffer) => {
        isAnalyzing.value = true;
        
        try {
            // 1. Compute waveform for visualization (1200 buckets)
            waveform.value = computeWaveform(buffer, 1200);
            
            // 2. Detect beats using RMS envelope
            beatTimesSec.value = detectBeats(buffer, 0.6);
            
            // 3. Frame-based analysis cache (energy, onsets)
            analysisCache.value = await AnalysisService.analyzeBufferToCache(
                buffer,
                fps.value
            );
            
            // 4. Spectral analysis (3-band energies per frame)
            const spectralData = await analyzeSpectralBands(buffer, fps.value);
            bandsLowPerFrame.value = spectralData.low;
            bandsMidPerFrame.value = spectralData.mid;
            bandsHighPerFrame.value = spectralData.high;
            
            // 5. Beat strength (combination of beats + energy)
            beatStrengthPerFrame.value = computeBeatStrength(
                beatTimesSec.value,
                analysisCache.value.energyPerFrame,
                fps.value
            );
        } catch (error) {
            console.error('Audio analysis failed:', error);
            throw error;
        } finally {
            isAnalyzing.value = false;
        }
    };
    
    /**
     * Clears all analysis data.
     */
    const clear = () => {
        waveform.value = null;
        beatTimesSec.value = [];
        analysisCache.value = null;
        bandsLowPerFrame.value = [];
        bandsMidPerFrame.value = [];
        bandsHighPerFrame.value = [];
        beatStrengthPerFrame.value = [];
    };
    
    return {
        // Outputs
        waveform,
        beatTimesSec,
        analysisCache,
        bandsLowPerFrame,
        bandsMidPerFrame,
        bandsHighPerFrame,
        beatStrengthPerFrame,
        isAnalyzing,
        
        // Methods
        analyzeBuffer,
        clear,
    };
}
