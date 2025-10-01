import { type Ref } from 'vue';
import type { useRenderWorker } from './useRenderWorker';
import type { useFrameEvaluation } from './useFrameEvaluation';
import type { useAudioAnalysis } from './useAudioAnalysis';
import { getSpectralBandsAtFrame } from '@/front-end/utils/audio/spectralBands';

/**
 * Composable for rendering frames to the worker
 * 
 * Consolidates the logic of:
 * 1. Evaluating frame data (beat, word, scene mix)
 * 2. Extracting spectral bands
 * 3. Sending frame to render worker
 * 
 * This eliminates 4x duplication in Editor.vue
 */
export function useFrameRenderer(
  renderWorker: ReturnType<typeof useRenderWorker>,
  frameEval: ReturnType<typeof useFrameEvaluation>,
  audioAnalysis: ReturnType<typeof useAudioAnalysis>
) {
  /**
   * Sends a complete frame data packet to the render worker
   * 
   * @param frame - Frame number to render
   * @param dt - Delta time since last frame (seconds)
   */
  const sendFrameToWorker = (frame: number, dt = 0) => {
    const beat = frameEval.getBeatAtFrame(frame);
    const wordIndex = frameEval.getWordIndexAtFrame(frame);
    const mix = frameEval.getActiveScenesAtFrame(frame);
    const wordOverride = frameEval.getWordOverrideAtFrame(frame);
    
    // Extract spectral bands
    const cache = audioAnalysis.analysisCache.value;
    const totalFrames = cache?.totalFrames || 0;
    
    const bands = getSpectralBandsAtFrame(
      frame,
      audioAnalysis.bandsLowPerFrame.value,
      audioAnalysis.bandsMidPerFrame.value,
      audioAnalysis.bandsHighPerFrame.value,
      totalFrames
    );
    
    renderWorker.sendFrame({
      frame,
      dt,
      beat,
      wordIndex,
      alphaA: mix.alphaA,
      alphaB: mix.alphaB,
      wordOverride,
      lowBand: bands.lowBand,
      midBand: bands.midBand,
      highBand: bands.highBand
    });
  };
  
  return {
    sendFrameToWorker
  };
}


