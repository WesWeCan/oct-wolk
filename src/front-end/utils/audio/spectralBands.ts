/**
 * Extracts spectral band values at a specific frame
 * 
 * @param frame - The frame number to extract bands for
 * @param lowBands - Array of low frequency band values (0-200 Hz)
 * @param midBands - Array of mid frequency band values (200-2000 Hz)
 * @param highBands - Array of high frequency band values (2000+ Hz)
 * @param totalFrames - Total number of frames in the analysis
 * @returns Object containing low, mid, and high band values (0-1)
 */
export function getSpectralBandsAtFrame(
  frame: number,
  lowBands: number[],
  midBands: number[],
  highBands: number[],
  totalFrames: number
): { lowBand: number; midBand: number; highBand: number } {
  const idx = Math.min(totalFrames - 1, Math.max(0, frame));
  
  return {
    lowBand: lowBands[idx] || 0,
    midBand: midBands[idx] || 0,
    highBand: highBands[idx] || 0
  };
}


