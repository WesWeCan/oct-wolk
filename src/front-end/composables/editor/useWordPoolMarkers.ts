import { type Ref } from 'vue';
import type { TimelineDocument } from '@/types/timeline_types';

/**
 * Composable for managing word pool markers (keyframes)
 * 
 * Handles:
 * - Moving word pool markers to new frame positions
 * - Maintaining sorted keyframe order
 */
export function useWordPoolMarkers(
  timeline: Ref<TimelineDocument | null>,
  onTimelineUpdated: (timeline: TimelineDocument) => void
) {
  /**
   * Moves a word pool marker to a new frame position
   * 
   * @param index - Index of the marker in the keyframes array
   * @param newFrame - Target frame position
   * @param originalFrame - Optional original frame for more precise matching
   */
  const moveMarker = (
    index: number,
    newFrame: number,
    originalFrame?: number
  ) => {
    if (!timeline.value) return;
    
    const track = timeline.value.wordsPoolTrack || {
      propertyPath: 'timeline.words.pool',
      keyframes: []
    };
    
    const frames = (track.keyframes || []).slice() as any[];
    
    // Try to find by original frame if provided
    let targetIdx = index;
    if (typeof originalFrame === 'number') {
      const candidateIdx = frames.findIndex(
        (k: any) => (k.frame | 0) === (originalFrame | 0)
      );
      
      if (candidateIdx >= 0) {
        targetIdx = candidateIdx;
      }
    }
    
    // Validate index
    if (targetIdx < 0 || targetIdx >= frames.length) return;
    
    // Remove the marker at its current position
    const [marker] = frames.splice(targetIdx, 1);
    
    // Create updated marker with new frame
    const updatedMarker = {
      frame: Math.max(0, newFrame | 0),
      value: Array.isArray(marker.value) ? marker.value : []
    };
    
    // Add back to array
    frames.push(updatedMarker);
    
    // Sort by frame
    frames.sort((a: any, b: any) => (a.frame | 0) - (b.frame | 0));
    
    // Update timeline
    const updatedTimeline: TimelineDocument = {
      ...timeline.value,
      wordsPoolTrack: {
        propertyPath: 'timeline.words.pool',
        keyframes: frames
      }
    };
    
    onTimelineUpdated(updatedTimeline);
  };
  
  return {
    moveMarker
  };
}


