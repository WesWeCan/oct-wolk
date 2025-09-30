import type { PropertyTrack } from '@/types/timeline_types';

/**
 * Evaluates the global word pool at a specific frame.
 * 
 * The word pool determines which words are available for rendering.
 * It's controlled by keyframes on the timeline-level wordsPoolTrack.
 * 
 * Logic:
 * - If no keyframes exist, return full word bank
 * - Otherwise, return the word list from the most recent keyframe
 * 
 * @param frame - Frame number
 * @param wordsPoolTrack - Timeline-level word pool track (with keyframes)
 * @param fullWordBank - Complete word bank (fallback when no keyframes)
 * @returns Array of words available at this frame
 */
export function evalGlobalWordPoolAtFrame(
    frame: number,
    wordsPoolTrack: PropertyTrack<string[]> | null | undefined,
    fullWordBank: string[]
): string[] {
    // No track or no keyframes: use full word bank
    if (!wordsPoolTrack || !Array.isArray(wordsPoolTrack.keyframes) || wordsPoolTrack.keyframes.length === 0) {
        return fullWordBank;
    }
    
    // Sort keyframes by frame (should already be sorted, but ensure it)
    const sortedKeyframes = wordsPoolTrack.keyframes
        .slice()
        .sort((a, b) => (a.frame | 0) - (b.frame | 0));
    
    // Find most recent keyframe at or before current frame
    let mostRecentKeyframe = sortedKeyframes[0];
    
    for (const kf of sortedKeyframes) {
        if ((kf.frame | 0) <= (frame | 0)) {
            mostRecentKeyframe = kf;
        } else {
            break; // Keyframes are sorted, so we can stop here
        }
    }
    
    // Extract word list from keyframe
    const words = Array.isArray(mostRecentKeyframe.value)
        ? mostRecentKeyframe.value.map(w => String(w))
        : fullWordBank;
    
    return words;
}
