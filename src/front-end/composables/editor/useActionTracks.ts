import { type Ref } from 'vue';
import type { TimelineDocument } from '@/types/timeline_types';

/**
 * Composable for managing action tracks
 * 
 * Handles:
 * - Toggling word override actions at specific frames
 * - Managing action items on the timeline
 */
export function useActionTracks(
  timeline: Ref<TimelineDocument | null>,
  onTimelineUpdated: (timeline: TimelineDocument) => void
) {
  /**
   * Generate a unique ID for new actions
   */
  const generateId = (): string => {
    return crypto.randomUUID();
  };
  
  /**
   * Toggles a word override action at the specified frame
   * 
   * If an action exists at that frame, removes it.
   * If no action exists, creates one.
   */
  const toggleWordOverride = ({ frame }: { frame: number }) => {
    if (!timeline.value) return;
    
    const actions = Array.isArray(timeline.value.actionTracks)
      ? [...timeline.value.actionTracks]
      : [];
    
    // Check if action already exists at this frame
    const existingIdx = actions.findIndex(
      (a: any) => a.frame === frame && a.actionType === 'wordOverride'
    );
    
    if (existingIdx >= 0) {
      // Remove existing action
      actions.splice(existingIdx, 1);
    } else {
      // Add new action
      actions.push({
        id: generateId(),
        frame,
        actionType: 'wordOverride',
        payload: { word: 'WOLK' }
      });
    }
    
    const updatedTimeline: TimelineDocument = {
      ...timeline.value,
      actionTracks: actions
    };
    
    onTimelineUpdated(updatedTimeline);
  };
  
  return {
    toggleWordOverride
  };
}


