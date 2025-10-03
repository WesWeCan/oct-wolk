import { ref, computed, type Ref } from 'vue';
import { TimelineService } from '@/front-end/services/TimelineService';
import type { TimelineDocument, SceneRef, SceneDocumentBase, SceneType } from '@/types/timeline_types';

/**
 * Scene management for the editor.
 * 
 * Responsibilities:
 * - Scene CRUD operations
 * - Scene selection state
 * - Scene document loading/caching
 * - Scene parameter updates
 * 
 * @param timeline - Timeline document ref
 * @param songId - Current song ID
 * 
 * @example
 * ```typescript
 * const scenes = useSceneManagement(timeline, songId);
 * 
 * await scenes.addScene('wordcloud');
 * scenes.selectScene('scene-id-123');
 * await scenes.updateSceneParams({ color: '#ff0000' });
 * ```
 */
export function useSceneManagement(
    timeline: Ref<TimelineDocument | null>,
    songId: Ref<string>
) {
    const sceneDocs = ref<Record<string, SceneDocumentBase>>({});
    const selectedSceneId = ref<string | null>(null);
    
    /**
     * Currently selected scene reference.
     */
    const selectedScene = computed<SceneRef | null>(() => {
        if (!selectedSceneId.value || !timeline.value) return null;
        
        return timeline.value.scenes.find(s => s.id === selectedSceneId.value) || null;
    });
    
    /**
     * Currently selected scene document (with params and tracks).
     */
    const selectedSceneDoc = computed<SceneDocumentBase | null>(() => {
        if (!selectedSceneId.value) return null;
        return sceneDocs.value[selectedSceneId.value] || null;
    });
    
    /**
     * Parameters of currently selected scene.
     */
    const selectedSceneParams = computed<Record<string, any>>(() => {
        return selectedSceneDoc.value?.params || {};
    });
    
    /**
     * Adds a new scene to the timeline.
     * 
     * @param type - Scene type
     * @param audioEl - Audio element (to determine duration)
     * @param fps - Frames per second
     */
    const addScene = async (
        type: SceneType,
        audioEl: HTMLAudioElement | null,
        fps: number,
        opts?: { insertionFrame?: number; defaultDurationFrames?: number }
    ) => {
        if (!timeline.value) return;
        
        // Generate unique ID
        const id = crypto.randomUUID();
        
        // Determine insertion frame and base duration
        const totalFrames = Math.max(1, Math.floor((audioEl?.duration || 0) * fps));
        const isFirst = timeline.value.scenes.length === 0;
        const requestedInsertion = Math.max(0, Math.floor(Number(opts?.insertionFrame ?? NaN)) || 0);
        const insertionFrame = isFirst ? 0 : requestedInsertion;
        const defaultDuration = Number.isFinite(opts?.defaultDurationFrames as any) ? Math.max(1, Number(opts?.defaultDurationFrames)) : 300;
        const desiredDuration = isFirst && totalFrames > 0 ? totalFrames : defaultDuration;

        // Overlap handling: trim left scene if playhead is inside it; clamp to next scene start
        const scenes = [...timeline.value.scenes];

        // Trim preceding scene if insertion is inside it
        const prevIdx = scenes.findIndex(s => insertionFrame >= s.startFrame && insertionFrame < s.startFrame + s.durationFrames);
        if (prevIdx >= 0) {
            const prev = scenes[prevIdx];
            const newDur = insertionFrame - prev.startFrame;
            if (newDur <= 0) {
                scenes.splice(prevIdx, 1);
            } else {
                scenes[prevIdx] = { ...prev, durationFrames: newDur };
            }
        }

        // Find next scene after insertion
        const nextScenes = scenes.filter(s => s.startFrame >= insertionFrame).sort((a, b) => a.startFrame - b.startFrame);
        const next = nextScenes[0] || null;
        let durationFrames = desiredDuration;
        if (next) {
            const available = Math.max(0, next.startFrame - insertionFrame);
            durationFrames = Math.max(1, Math.min(durationFrames, available || durationFrames));
        }

        const startFrame = insertionFrame;
        
        // Create scene reference
        const sceneRef: SceneRef = {
            id,
            type,
            name: `${type} ${timeline.value.scenes.length + 1}`,
            startFrame,
            durationFrames
        };
        
        // Create scene document
        const sceneDoc: SceneDocumentBase = {
            id,
            type,
            name: sceneRef.name,
            seed: timeline.value.settings.seed || 'seed',
            params: {},
            tracks: []
        };
        
        // Save scene document
        try {
            const saved = await TimelineService.saveScene(songId.value, sceneDoc);
            sceneDocs.value[id] = saved;
        } catch (error) {
            console.error('Failed to save scene:', error);
        }
        
        // Add to timeline (keep sorted by startFrame)
        scenes.push(sceneRef);
        scenes.sort((a, b) => a.startFrame - b.startFrame);
        timeline.value.scenes = scenes;
        
        // Select new scene
        selectedSceneId.value = id;
    };
    
    /**
     * Selects a scene by ID.
     */
    const selectScene = async (id: string) => {
        selectedSceneId.value = id;
        
        // Ensure scene document is loaded
        await ensureSceneDoc(id);
    };
    
    /**
     * Updates parameters of currently selected scene.
     */
    const updateSceneParams = async (params: Record<string, any>) => {
        const id = selectedSceneId.value;
        if (!id) return;
        
        const baseDoc = sceneDocs.value[id] || createDefaultSceneDoc(id);
        
        // Merge params
        baseDoc.params = { ...baseDoc.params, ...params };
        sceneDocs.value[id] = baseDoc;
        
        // Persist to disk
        try {
            await TimelineService.saveScene(songId.value, baseDoc);
        } catch (error) {
            console.error('Failed to save scene params:', error);
        }
    };
    
    /**
     * Deletes a scene from the timeline.
     */
    const deleteScene = async (id: string) => {
        if (!timeline.value) return;
        
        const index = timeline.value.scenes.findIndex(s => s.id === id);
        if (index >= 0) {
            timeline.value.scenes.splice(index, 1);
        }
        
        // Deselect if this was selected
        if (selectedSceneId.value === id) {
            selectedSceneId.value = null;
        }
        
        // Remove from cache
        delete sceneDocs.value[id];
    };
    
    /**
     * Ensures a scene document is loaded into cache.
     */
    const ensureSceneDoc = async (id: string) => {
        if (!id) return;
        if (sceneDocs.value[id]) return; // Already loaded
        
        // Try loading from disk
        try {
            const doc = await TimelineService.loadScene(songId.value, id);
            if (doc) {
                sceneDocs.value[id] = doc;
                return;
            }
        } catch (error) {
            console.warn('Failed to load scene:', error);
        }
        
        // Create default if not found
        const sceneRef = timeline.value?.scenes.find(s => s.id === id);
        if (sceneRef) {
            const defaultDoc = createDefaultSceneDoc(id, sceneRef);
            sceneDocs.value[id] = defaultDoc;
            
            // Save it
            try {
                await TimelineService.saveScene(songId.value, defaultDoc);
            } catch (error) {
                console.error('Failed to save default scene:', error);
            }
        }
    };
    
    /**
     * Preloads all scene documents referenced in the timeline.
     */
    const preloadAllSceneDocs = async () => {
        if (!timeline.value) return;
        
        const loadPromises = timeline.value.scenes.map(scene => 
            ensureSceneDoc(scene.id)
        );
        
        await Promise.all(loadPromises);
    };
    
    /**
     * Creates a default scene document.
     */
    const createDefaultSceneDoc = (
        id: string,
        sceneRef?: SceneRef
    ): SceneDocumentBase => {
        return {
            id,
            type: sceneRef?.type || 'wordcloud',
            name: sceneRef?.name || 'Untitled Scene',
            seed: timeline.value?.settings.seed || 'seed',
            params: {},
            tracks: []
        };
    };
    
    return {
        sceneDocs,
        selectedSceneId,
        selectedScene,
        selectedSceneDoc,
        selectedSceneParams,
        addScene,
        selectScene,
        updateSceneParams,
        deleteScene,
        ensureSceneDoc,
        preloadAllSceneDocs,
    };
}
