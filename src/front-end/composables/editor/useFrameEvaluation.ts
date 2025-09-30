import { computed, type Ref, type ComputedRef } from 'vue';
import { 
    evalBeatForFrame, 
    evalWordIndexForFrame, 
    computeBeatIndexPerFrame, 
    computeOnsetIndexPerFrame 
} from '@/front-end/utils/timeline/frameEvaluation';
import { computeActiveScenesForFrame, type ActiveSceneMix } from '@/front-end/utils/timeline/sceneActivation';
import { evalGlobalWordPoolAtFrame } from '@/front-end/utils/timeline/wordPoolEvaluation';
import type { AnalysisCache } from '@/types/analysis_types';
import type { TimelineDocument, SceneDocumentBase, ActionItem } from '@/types/timeline_types';

/**
 * Frame evaluation for the editor.
 * 
 * Responsibilities:
 * - Computing beat values per frame
 * - Computing word indices per frame
 * - Determining active scenes at any frame
 * - Evaluating global word pool at any frame
 * - Detecting word overrides from action items
 * 
 * All computations are deterministic and based on precomputed analysis data.
 * 
 * @param analysisCache - Precomputed audio analysis
 * @param timeline - Timeline document
 * @param sceneDocs - Scene documents (with params)
 * @param fps - Frames per second
 * @param beatTimesSec - Detected beat times
 * @param wordBank - Full word bank (fallback)
 * 
 * @example
 * ```typescript
 * const frameEval = useFrameEvaluation(analysis, timeline, scenes, fps, beats, words);
 * 
 * const beat = frameEval.getBeatAtFrame(120);
 * const wordIdx = frameEval.getWordIndexAtFrame(120);
 * const activeScenes = frameEval.getActiveScenesAtFrame(120);
 * ```
 */
export function useFrameEvaluation(
    analysisCache: Ref<AnalysisCache | null>,
    timeline: Ref<TimelineDocument | null>,
    sceneDocs: Ref<Record<string, SceneDocumentBase>>,
    fps: Ref<number>,
    beatTimesSec: Ref<number[]>,
    wordBank: Ref<string[]>
) {
    /**
     * Precomputed beat index per frame (cumulative beat count).
     */
    const beatIndexPerFrame = computed<number[] | null>(() => {
        const beats = beatTimesSec.value;
        const cache = analysisCache.value;
        
        if (!Array.isArray(beats) || !cache) return null;
        
        return computeBeatIndexPerFrame(
            beats,
            cache.totalFrames,
            fps.value
        );
    });
    
    /**
     * Precomputed onset index per frame (cumulative onset count).
     */
    const onsetIndexPerFrame = computed<number[] | null>(() => {
        const cache = analysisCache.value;
        if (!cache) return null;
        
        return computeOnsetIndexPerFrame(cache.isOnsetPerFrame);
    });
    
    /**
     * Derived onset flags per frame (may be modified by per-scene thresholds).
     */
    const derivedOnsetPerFrame = computed<boolean[] | undefined>(() => {
        const cache = analysisCache.value;
        const t = timeline.value;
        
        if (!cache) return undefined;
        
        // Start with base onsets from cache
        const base = Array.isArray(cache.isOnsetPerFrame) 
            ? cache.isOnsetPerFrame.slice() 
            : new Array(cache.totalFrames).fill(false);
        
        if (!t || !Array.isArray(t.scenes) || !t.scenes.length) {
            return base;
        }
        
        // Apply per-scene beat thresholds (for SingleWord scenes)
        const energy = cache.energyPerFrame || [];
        
        for (const scene of t.scenes) {
            if (scene.type !== 'singleWord') continue;
            
            const params = sceneDocs.value[scene.id]?.params || {};
            const threshold = Number(params.beatThreshold);
            
            if (!Number.isFinite(threshold)) continue;
            
            const startF = Math.max(0, scene.startFrame | 0);
            const endF = Math.min(cache.totalFrames - 1, (scene.startFrame + scene.durationFrames - 1) | 0);
            
            let lastAbove = (energy[Math.max(0, startF - 1)] || 0) > threshold;
            
            for (let f = startF; f <= endF && f < energy.length; f++) {
                const above = (energy[f] || 0) > threshold;
                const onset = above && !lastAbove;
                base[f] = onset;
                lastAbove = above;
            }
        }
        
        return base;
    });
    
    /**
     * Gets beat energy value at a specific frame.
     */
    const getBeatAtFrame = (frame: number): number => {
        return evalBeatForFrame(frame, analysisCache.value, 0);
    };
    
    /**
     * Gets word index at a specific frame.
     */
    const getWordIndexAtFrame = (frame: number): number => {
        return evalWordIndexForFrame(
            frame,
            beatIndexPerFrame.value,
            onsetIndexPerFrame.value,
            fps.value
        );
    };
    
    /**
     * Gets active scene(s) at a specific frame.
     */
    const getActiveScenesAtFrame = (frame: number): ActiveSceneMix => {
        const scenes = timeline.value?.scenes || [];
        return computeActiveScenesForFrame(frame, scenes);
    };
    
    /**
     * Gets global word pool at a specific frame.
     */
    const getWordPoolAtFrame = (frame: number): string[] => {
        return evalGlobalWordPoolAtFrame(
            frame,
            timeline.value?.wordsPoolTrack,
            wordBank.value
        );
    };
    
    /**
     * Gets word override (if any) at a specific frame.
     */
    const getWordOverrideAtFrame = (frame: number): string | undefined => {
        const actions = (timeline.value?.actionTracks || []) as ActionItem[];
        
        const hit = actions.find(
            a => a.frame === frame && a.actionType === 'wordOverride'
        );
        
        return hit?.payload?.word ? String(hit.payload.word) : undefined;
    };
    
    return {
        // Precomputed indices
        beatIndexPerFrame,
        onsetIndexPerFrame,
        derivedOnsetPerFrame,
        
        // Evaluation methods
        getBeatAtFrame,
        getWordIndexAtFrame,
        getActiveScenesAtFrame,
        getWordPoolAtFrame,
        getWordOverrideAtFrame,
    };
}
