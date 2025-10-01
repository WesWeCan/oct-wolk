import { type Ref } from 'vue';
import type { TimelineDocument, SceneRef } from '@/types/timeline_types';
import { TimelineService } from '@/front-end/services/TimelineService';
import type { useSceneManagement } from './useSceneManagement';

/**
 * Composable for scene-level actions and operations
 * 
 * Handles:
 * - Scene deletion
 * - Scene switching/splitting at current frame
 * - Scene updates
 */
export function useSceneActions(
  timeline: Ref<TimelineDocument | null>,
  scenes: ReturnType<typeof useSceneManagement>,
  songId: Ref<string>
) {
  /**
   * Deletes a scene and saves timeline
   */
  const handleDeleteScene = async (id: string) => {
    await scenes.deleteScene(id);
    
    if (timeline.value) {
      await TimelineService.save(songId.value, timeline.value);
    }
  };
  
  /**
   * Switches/splits scenes at the given frame
   * 
   * This finds the scene at the frame and splits it, moving the next scene
   * to start at the frame position.
   */
  const handleSwitchHere = async ({ frame }: { frame: number }) => {
    if (!timeline.value) return;
    
    const scenesList = [...(timeline.value.scenes || [])];
    
    if (!scenesList.length) return;
    
    // Find scene containing the frame
    const idx = scenesList.findIndex(
      s => frame >= s.startFrame && frame < s.startFrame + s.durationFrames
    );
    
    if (idx < 0 || idx + 1 >= scenesList.length) return;
    
    // Split the scene
    const sceneA = { ...scenesList[idx] };
    const sceneB = { ...scenesList[idx + 1] };
    
    const leftDuration = Math.max(1, frame - sceneA.startFrame);
    sceneA.durationFrames = leftDuration;
    sceneB.startFrame = frame;
    
    scenesList[idx] = sceneA;
    scenesList[idx + 1] = sceneB;
    
    const updatedTimeline: TimelineDocument = {
      ...timeline.value,
      scenes: scenesList
    };
    
    timeline.value = updatedTimeline;
    await TimelineService.save(songId.value, updatedTimeline);
  };
  
  /**
   * Updates a scene and saves timeline
   */
  const handleSceneUpdate = async (updatedScene: SceneRef) => {
    if (!timeline.value) return;
    
    const scenesList = [...timeline.value.scenes];
    const idx = scenesList.findIndex(s => s.id === updatedScene.id);
    
    if (idx >= 0) {
      scenesList[idx] = updatedScene;
      
      const updatedTimeline: TimelineDocument = {
        ...timeline.value,
        scenes: scenesList
      };
      
      timeline.value = updatedTimeline;
      await TimelineService.save(songId.value, updatedTimeline);
    }
  };
  
  return {
    handleDeleteScene,
    handleSwitchHere,
    handleSceneUpdate
  };
}


