import type { SceneRef } from '@/types/timeline_types';

/**
 * Result of active scene computation for a frame.
 */
export interface ActiveSceneMix {
    /** Primary scene (always present, uses 'none' placeholder if no scenes) */
    a: SceneRef;
    /** Secondary scene for transitions (null if no transition) */
    b: SceneRef | null;
    /** Opacity of primary scene (0-1) */
    alphaA: number;
    /** Opacity of secondary scene (0-1) */
    alphaB: number;
}

/**
 * Computes which scene(s) are active at a given frame.
 * 
 * Currently supports single-scene display (no transitions yet).
 * Future: Will support crossfade transitions between scenes.
 * 
 * @param frame - Frame number
 * @param scenes - Array of scene references from timeline
 * @returns Active scene(s) with opacity values
 */
export function computeActiveScenesForFrame(
    frame: number,
    scenes: SceneRef[]
): ActiveSceneMix {
    // Placeholder scene for empty timeline
    const dummyScene: SceneRef = {
        id: 'none',
        type: 'wordcloud',
        name: 'None',
        startFrame: 0,
        durationFrames: 1
    };
    
    // Empty timeline case
    if (!scenes || scenes.length === 0) {
        return {
            a: dummyScene,
            b: null,
            alphaA: 0,
            alphaB: 0
        };
    }
    
    // Find scene that contains this frame
    const activeScene = scenes.find(s => 
        frame >= s.startFrame && 
        frame < s.startFrame + s.durationFrames
    );
    
    // Frame is outside all scenes
    if (!activeScene) {
        return {
            a: dummyScene,
            b: null,
            alphaA: 0,
            alphaB: 0
        };
    }
    
    // TODO: Implement transition support
    // For now, just show active scene at full opacity
    return {
        a: activeScene,
        b: null,
        alphaA: 1,
        alphaB: 0
    };
}
