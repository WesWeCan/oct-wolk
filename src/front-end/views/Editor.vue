<script setup lang="ts">
import { onMounted, ref, computed, nextTick, watch, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

// Services
import { TimelineService } from '@/front-end/services/TimelineService';
import { SongService } from '@/front-end/services/SongService';

// Types
import type { TimelineDocument } from '@/types/timeline_types';

// Components
import SceneList from '@/front-end/components/editor/SceneList.vue';
import Inspector from '@/front-end/components/editor/Inspector.vue';
import TimelineRoot from '@/front-end/components/timeline/TimelineRoot.vue';

// Composables
import { useAudioPlayer } from '@/front-end/composables/editor/useAudioPlayer';
import { useAudioAnalysis } from '@/front-end/composables/editor/useAudioAnalysis';
import { useRenderWorker } from '@/front-end/composables/editor/useRenderWorker';
import { useTimelinePlayback } from '@/front-end/composables/editor/useTimelinePlayback';
import { useSceneManagement } from '@/front-end/composables/editor/useSceneManagement';
import { useFrameEvaluation } from '@/front-end/composables/editor/useFrameEvaluation';
import { useVideoExport } from '@/front-end/composables/editor/useVideoExport';
import { useWolkImport } from '@/front-end/composables/editor/useWolkImport';
import { useFrameRenderer } from '@/front-end/composables/editor/useFrameRenderer';
import { useSceneActions } from '@/front-end/composables/editor/useSceneActions';
import { useTimelineNavigation } from '@/front-end/composables/editor/useTimelineNavigation';
import { useActionTracks } from '@/front-end/composables/editor/useActionTracks';
import { useWordPoolMarkers } from '@/front-end/composables/editor/useWordPoolMarkers';
import { SCENE_ANIMATABLES } from '@/front-end/workers/scenes/animatables';

// Utils
import { hashWords } from '@/front-end/utils/hash/hashWords';
import { stableStringify } from '@/front-end/utils/hash/stableStringify';

// ===== ROUTE & CORE STATE =====

const route = useRoute();
const songId = computed(() => String(route.params.songId || ''));

const timeline = ref<TimelineDocument | null>(null);
const song = ref<import('@/types/song_types').Song | null>(null);
const fps = ref(60);
const audioDurationSec = ref(0); // Store audio buffer duration as fallback

// ===== CANVAS REFS =====

const renderCanvas = ref<HTMLCanvasElement | null>(null);
const previewCanvas = ref<HTMLCanvasElement | null>(null);
const previewOverlay = ref<HTMLCanvasElement | null>(null);
const inspectorEl = ref<HTMLElement | null>(null);
const timelineEl = ref<HTMLElement | null>(null);

const targetWidth = computed(() => timeline.value?.settings.renderWidth || 1920);
const targetHeight = computed(() => timeline.value?.settings.renderHeight || 1080);
const aspectRatio = computed(() => `${targetWidth.value} / ${targetHeight.value}`);

// ===== COMPOSABLES =====

// Audio
const audioPlayer = useAudioPlayer();
const audioAnalysis = useAudioAnalysis(fps);

// Worker & Playback
const renderWorker = useRenderWorker(renderCanvas, targetWidth, targetHeight);
const maxFrame = computed(() => {
    // Use audio element duration if available, otherwise use stored buffer duration
    const dur = audioPlayer.duration.value > 0 ? audioPlayer.duration.value : audioDurationSec.value;
    return Math.max(0, Math.floor(dur * fps.value));
});
const playback = useTimelinePlayback(fps, maxFrame);

// Scenes
const wordBank = computed(() => song.value?.wordBank || []);
const scenes = useSceneManagement(timeline, songId);

// Frame Evaluation
const frameEval = useFrameEvaluation(
    audioAnalysis.analysisCache,
    timeline,
    scenes.sceneDocs,
    fps,
    audioAnalysis.beatTimesSec,
    wordBank
);

// Frame Rendering (eliminates 4x duplication)
const frameRenderer = useFrameRenderer(
    renderWorker,
    frameEval,
    audioAnalysis,
    (id: string) => scenes.sceneDocs.value?.[id]
);

// Export/Import
const videoExport = useVideoExport(
    renderCanvas,
    audioPlayer.audioEl,
    timeline,
    songId
);
const wolkImport = useWolkImport();

// Scene Actions
const sceneActions = useSceneActions(timeline, scenes, songId);

// ===== UI STATE =====

const overlayOpts = ref<{ showEnergy: boolean; showOnsets: boolean; showBeats?: boolean }>({
    showEnergy: true,
    showOnsets: true,
    showBeats: false
});

// ===== WORKER CONFIGURATION =====

let lastConfiguredKey = '';

/**
 * Computes a configuration key to detect when worker needs reconfiguration.
 */
const computeConfigKeyForFrame = (f: number): string => {
    const mix = frameEval.getActiveScenesAtFrame(f);
    const pairKey = (mix.a?.id || 'none') + '|' + (mix.b?.id || '');
    
    const pool = frameEval.getWordPoolAtFrame(f);
    const wordsKey = 'pool:' + hashWords(pool);
    
    // Include params hash so inspector changes trigger reconfiguration
    const aParams = mix.a && mix.a.id !== 'none' ? (scenes.sceneDocs.value[mix.a.id]?.params || {}) : {};
    const bParams = mix.b && mix.b.id !== 'none' ? (scenes.sceneDocs.value[mix.b.id]?.params || {}) : {};
    
    const exclude = new Set<string>(['words']);
    const aKey = stableStringify(aParams, exclude);
    const bKey = stableStringify(bParams, exclude);
    const paramsKey = `a:${aKey}|b:${bKey}`;
    
    return pairKey + '|' + wordsKey + '|' + paramsKey;
};

/**
 * Configures the worker with current scene mix and word pool.
 */
const configureWorkerScene = async () => {
    if (!timeline.value) return;
    
    const seed = String(timeline.value.settings.seed || 'seed');
    
    // Build font family chain
    const primary = String(timeline.value.settings.fontFamily || 'system-ui');
    const fallbacks = Array.isArray(timeline.value.settings.fontFallbacks)
        ? timeline.value.settings.fontFallbacks as string[]
        : [];
    const names = [primary, ...fallbacks].filter(Boolean);
    const quote = (s: string) => /[^a-zA-Z0-9-]/.test(s) ? `"${s.replace(/"/g, '"')}"` : s;
    const fontFamilyChain = names.map(quote).join(', ');
    
    const frame = playback.frame.value;
    const active = frameEval.getActiveScenesAtFrame(frame);
    
    // Ensure scene docs are loaded
    if (active.a && active.a.id !== 'none') await scenes.ensureSceneDoc(active.a.id);
    if (active.b && active.b.id !== 'none') await scenes.ensureSceneDoc(active.b.id);
    
    const pool = frameEval.getWordPoolAtFrame(frame);
    const wordsA = (active.a && active.a.id !== 'none') ? pool : [];
    const wordsB = (active.b && active.b.id !== 'none') ? pool : [];
    
    const aParamsBase = active.a && active.a.id !== 'none' ? (scenes.sceneDocs.value[active.a.id]?.params || {}) : null;
    const bParamsBase = active.b && active.b.id !== 'none' ? (scenes.sceneDocs.value[active.b.id]?.params || {}) : null;
    
    const aParams = aParamsBase ? { ...aParamsBase, words: wordsA, fontFamilyChain } : null;
    const bParams = bParamsBase ? { ...bParamsBase, words: wordsB, fontFamilyChain } : null;
    
    const configKey = computeConfigKeyForFrame(frame);
    
    if (active.a.id === 'none' && !active.b) {
        lastConfiguredKey = configKey;
        return;
    }
    
    if (configKey === lastConfiguredKey) return;
    
    lastConfiguredKey = configKey;
    
    renderWorker.configureScene({
        seed,
        fontFamilyChain,
        a: {
            sceneType: active.a.type,
            params: aParams || {}
        },
        b: bParams && active.b ? {
            sceneType: active.b.type,
            params: bParams
        } : null
    });
};

// ===== PREVIEW RENDERING =====

/**
 * Draws the preview canvas from the render canvas.
 */
const drawPreview = () => {
    const src = renderCanvas.value;
    const dst = previewCanvas.value;
    if (!src || !dst) return;
    
    const wrapper = dst.parentElement;
    if (!wrapper) return;
    
    const container = wrapper.parentElement; // monitor-display
    if (!container) return;
    
    const ctx = dst.getContext('2d');
    if (!ctx) return;
    
    const rw = targetWidth.value;
    const rh = targetHeight.value;
    const aspectRatio = rw / rh;
    
    // Get available space from container (minus padding)
    const maxW = container.clientWidth - 32; // 16px padding each side
    const maxH = container.clientHeight - 32;
    
    // Calculate display size maintaining aspect ratio
    let displayW = maxW;
    let displayH = maxW / aspectRatio;
    
    if (displayH > maxH) {
        displayH = maxH;
        displayW = maxH * aspectRatio;
    }
    
    // Set canvas to exact display size (no black bars)
    const w = dst.width = Math.floor(displayW);
    const h = dst.height = Math.floor(displayH);
    
    ctx.clearRect(0, 0, w, h);
    try {
        ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, w, h);
    } catch {}
};

// Watch for preview canvas resize
let previewResizeObserver: ResizeObserver | null = null;
let containerResizeObserver: ResizeObserver | null = null;

watch(previewCanvas, (canvas) => {
    if (previewResizeObserver) {
        previewResizeObserver.disconnect();
        previewResizeObserver = null;
    }
    
    if (canvas) {
        previewResizeObserver = new ResizeObserver(() => {
            drawPreview();
        });
        previewResizeObserver.observe(canvas);
        
        // Also observe the monitor-display container
        const wrapper = canvas.parentElement;
        const container = wrapper?.parentElement;
        if (container && !containerResizeObserver) {
            containerResizeObserver = new ResizeObserver(() => {
                drawPreview();
            });
            containerResizeObserver.observe(container);
        }
        
        // Initial draw when canvas is mounted
        nextTick(() => drawPreview());
    }
});

// Watch for render dimension changes
watch([targetWidth, targetHeight], () => {
    nextTick(() => drawPreview());
});

// ===== PLAYBACK CONTROL =====
let lastPlayStartAtFrame = 0;
let lastPlayStartTs = 0;
const SYNC_SUPPRESS_MS = 300; // allow audio currentTime to advance before enforcing sync
const SYNC_DRIFT_FRAMES = 2;  // only resync if off by > 2 frames

/**
 * Playback tick callback - sends frame data to worker.
 */
playback.onTick((_frame, dt) => {
    // Always derive the timeline frame from audio currentTime when available
    let frameToRender = playback.frame.value;
    if (audioPlayer.audioEl.value) {
        const t = audioPlayer.audioEl.value.currentTime;
        frameToRender = Math.max(0, Math.round(t * Math.max(1, fps.value)));
        if (frameToRender !== playback.frame.value) {
            playback.scrubToFrame(frameToRender);
        }
    }

    // Reconfigure scene if needed based on the frame we will render
    const cfgKey = computeConfigKeyForFrame(frameToRender);
    if (cfgKey !== lastConfiguredKey) {
        configureWorkerScene();
    }

    // Send frame-to-render to worker
    frameRenderer.sendFrameToWorker(frameToRender, dt);
});

// Render completion callback
renderWorker.onRenderComplete(() => {
    drawPreview();
});

const play = async () => {
    if (!renderWorker.isReady.value) return;
    if (maxFrame.value <= 0) return;
    
    // Sync audio
    if (audioPlayer.audioReady.value) {
        const timeSec = playback.frame.value / Math.max(1, fps.value);
        await audioPlayer.seekTo(timeSec);
        await audioPlayer.play();
    }
    
    // Record play start for sync suppression window
    lastPlayStartAtFrame = playback.frame.value;
    lastPlayStartTs = performance.now();
    
    playback.play();
};

const pause = () => {
    playback.pause();
    audioPlayer.pause();
};

const stop = () => {
    playback.stop();
    audioPlayer.stop();
    
    // Update preview for frame 0
    frameRenderer.sendFrameToWorker(0, 0);
    
    requestAnimationFrame(() => drawPreview());
};

// ===== TIMELINE HANDLERS =====

const onScrub = async (payload: { timeSec: number; frame: number }) => {
    await audioPlayer.seekTo(payload.timeSec);
    playback.scrubToFrame(payload.frame);
    
    // Check if reconfiguration needed
    const cfgKey = computeConfigKeyForFrame(payload.frame);
    if (cfgKey !== lastConfiguredKey) {
        await configureWorkerScene();
    }
    
    // Update preview immediately
    frameRenderer.sendFrameToWorker(payload.frame, 0);
    
    requestAnimationFrame(() => drawPreview());
};

const onTimelineUpdated = async (t: TimelineDocument) => {
    timeline.value = t;
    await TimelineService.save(songId.value, t);
    await scenes.preloadAllSceneDocs();
    await configureWorkerScene();
};

const onSceneUpdated = async (s: any) => {
    if (!timeline.value) return;
    
    const idx = timeline.value.scenes.findIndex(x => x.id === s.id);
    if (idx >= 0) {
        timeline.value.scenes[idx] = s;
        await TimelineService.save(songId.value, timeline.value);
    }
};

// ===== ADDITIONAL COMPOSABLES (after handlers defined) =====

// Timeline Navigation (depends on onScrub)
const timelineNavigation = useTimelineNavigation(
    timeline,
    playback,
    audioAnalysis,
    fps,
    onScrub
);

// Action Tracks (depends on onTimelineUpdated)
const actionTracks = useActionTracks(timeline, onTimelineUpdated);

// Word Pool Markers (depends on onTimelineUpdated)
const wordPoolMarkers = useWordPoolMarkers(timeline, onTimelineUpdated);

// ===== SCENE HANDLERS =====

const addScene = async (type: 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord' | 'model3d') => {
    await scenes.addScene(type, audioPlayer.audioEl.value, fps.value);
    await TimelineService.save(songId.value, timeline.value!);
    await configureWorkerScene();
};

const selectScene = async (id: string) => {
    await scenes.selectScene(id);
    await configureWorkerScene();
};

const applySceneParams = async (p: Record<string, any>) => {
    await scenes.updateSceneParams(p);
    await configureWorkerScene();
    
    // Push immediate frame update
    frameRenderer.sendFrameToWorker(playback.frame.value, 0);
};

// ===== INITIALIZATION =====

/**
 * Initializes editor for a song.
 */
const initForSong = async (id: string) => {
    pause();
    renderWorker.dispose();
    playback.scrubToFrame(0);
    
    // Load timeline
    timeline.value = await TimelineService.createOrLoad(id);
    fps.value = timeline.value.settings.fps;
    
    // Preload scene documents
    await scenes.preloadAllSceneDocs();
    
    // Load song
    song.value = await SongService.load(id);
    
    // Load audio
    if (song.value?.audioSrc) {
        // Handle custom wolk:// protocol
        let audioSrc = song.value.audioSrc;
        
        if (audioSrc.startsWith('wolk://')) {
            // For analysis, we need ArrayBuffer
            const response = await fetch(audioSrc);
            const arrayBuffer = await response.arrayBuffer();
            
            // Decode for analysis
            // CRITICAL: We must detect the file's native sample rate and use it for AudioContext
            // to avoid resampling artifacts that cause timing mismatches
            const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const tempBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
            const nativeSampleRate = tempBuffer.sampleRate;
            await tempCtx.close();
            
            // Create new context with the correct sample rate
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: nativeSampleRate });
            const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
            
            // Store buffer duration as fallback (for custom protocols where audio element might not get metadata)
            audioDurationSec.value = buffer.duration;
            
            
            // Run analysis
            await audioAnalysis.analyzeBuffer(buffer);
            
            
        } else {
            // Regular URL
            const response = await axios.get<ArrayBuffer>(audioSrc, { responseType: 'arraybuffer' });
            
            // CRITICAL: Detect native sample rate and use it to avoid resampling
            const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const tempBuffer = await tempCtx.decodeAudioData(response.data.slice(0));
            const nativeSampleRate = tempBuffer.sampleRate;
            await tempCtx.close();
            
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: nativeSampleRate });
            const buffer = await audioCtx.decodeAudioData(response.data.slice(0));
            
            // Store buffer duration as fallback
            audioDurationSec.value = buffer.duration;
            
            
            await audioAnalysis.analyzeBuffer(buffer);
            
        }
        
        // Load audio element
        await audioPlayer.load(song.value.audioSrc);
        
        // Wait for metadata to load
        if (audioPlayer.audioEl.value) {
            await new Promise((resolve) => {
                const el = audioPlayer.audioEl.value!;
                if (el.readyState >= 1) { // HAVE_METADATA
                    resolve(undefined);
                } else {
                    el.addEventListener('loadedmetadata', () => resolve(undefined), { once: true });
                }
            });
        }
        
        // Check for encoder delay by comparing durations
        const audioElDuration = audioPlayer.audioEl.value?.duration || 0;
        const bufferDuration = audioDurationSec.value;
        const durationDiff = Math.abs(audioElDuration - bufferDuration);
        
        
    }
    
    await nextTick();
    await renderWorker.start();
    await configureWorkerScene();
    
    // Initial preview draw after worker is ready
    await nextTick();
    drawPreview();
};

// Watch song ID changes
watch(songId, async (id) => {
    if (id) {
        await initForSong(id);
    }
}, { immediate: true });

// ===== EXPORT/IMPORT HANDLERS =====

const reanalyze = async () => {
    if (!song.value?.audioSrc) return;
    
    try {
        const arrayBuffer = song.value.audioSrc.startsWith('wolk://')
            ? await (await fetch(song.value.audioSrc)).arrayBuffer()
            : (await axios.get<ArrayBuffer>(song.value.audioSrc, { responseType: 'arraybuffer' })).data;
        
        // CRITICAL: Detect native sample rate to avoid resampling
        const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const tempBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
        const nativeSampleRate = tempBuffer.sampleRate;
        await tempCtx.close();
        
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: nativeSampleRate });
        const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        
        
        
        await audioAnalysis.analyzeBuffer(buffer);
        
        
        
        // Refresh current frame
        frameRenderer.sendFrameToWorker(playback.frame.value, 0);
        requestAnimationFrame(() => drawPreview());
    } catch (e) {}
};

const exportWithOptions = async () => {
    await videoExport.startExport(async () => {
        await audioPlayer.seekTo(0);
        playback.scrubToFrame(0);
        await play();
    });
};

const exportWolk = async () => {
    if (song.value) {
        await videoExport.exportWolk(song.value);
    }
};

// Monitor settings functions
const updateDimensions = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (!timeline.value || value === 'custom') return;
    
    const [width, height] = value.split('x').map(Number);
    timeline.value = {
        ...timeline.value,
        settings: {
            ...timeline.value.settings,
            renderWidth: width,
            renderHeight: height
        }
    };
};

const updateCustomDimensions = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    if (!timeline.value) return;
    
    const match = value.match(/(\d+)\s*[×x]\s*(\d+)/);
    if (match) {
        const [, width, height] = match;
        timeline.value = {
            ...timeline.value,
            settings: {
                ...timeline.value.settings,
                renderWidth: Number(width),
                renderHeight: Number(height)
            }
        };
    }
};

const toggleIncludeAudio = () => {
    if (!timeline.value) return;
    timeline.value = {
        ...timeline.value,
        settings: {
            ...timeline.value.settings,
            includeAudio: !timeline.value.settings.includeAudio
        }
    };
};

// Monitor editing state
const isEditingSettings = ref(false);
const toggleEditSettings = () => {
    isEditingSettings.value = !isEditingSettings.value;
};

const handleReset = async () => {
    try {
        const res = await (window as any).electronAPI.timeline.reset(songId.value);
        if (res?.ok && res?.doc) {
            timeline.value = res.doc;
            scenes.selectedSceneId.value = null;
            await configureWorkerScene();
        }
    } catch {}
};

// ===== COMPUTED PROPERTIES =====

/**
 * Gets the allowed words track for the currently selected scene
 */
const allowedTrack = computed(() => {
    const id = scenes.selectedSceneId.value;
    if (!id) return null;
    
    const doc = scenes.sceneDocs.value?.[id];
    const tracks = Array.isArray(doc?.tracks) ? doc.tracks : [];
    
    return tracks.find((t: any) => t.propertyPath === 'words.allowed') || null;
});

// ===== INSPECTOR HANDLERS =====

/**
 * Updates scene tracks when modified in the inspector
 */
const handleSceneTracksUpdate = async (payload: any) => {
    const sceneId = String(payload?.sceneId || '');
    const incomingTracks: any[] = Array.isArray(payload?.tracks) ? payload.tracks : [];
    
    if (!sceneId) return;
    
    const doc = scenes.sceneDocs.value?.[sceneId];
    if (!doc) return;
    
    const existingTracks: any[] = Array.isArray(doc.tracks) ? doc.tracks : [];
    
    // Merge tracks by propertyPath
    const trackMap: Record<string, any> = {};
    existingTracks.forEach((t: any) => {
        trackMap[t.propertyPath] = t;
    });
    incomingTracks.forEach((t: any) => {
        trackMap[t.propertyPath] = t;
    });
    
    const mergedTracks = Object.values(trackMap);
    const updatedDoc = { ...doc, tracks: mergedTracks };
    
    (scenes.sceneDocs.value as any)[sceneId] = updatedDoc;
    await TimelineService.saveScene(songId.value, updatedDoc);
    await configureWorkerScene();
};

// ===== PROPERTY TRACK HANDLERS (timeline) =====

const handlePropAddKf = (payload: { propertyPath: string; frame: number; value: any }) => {
    const id = scenes.selectedSceneId.value; if (!id) return;
    const doc = scenes.sceneDocs.value[id]; if (!doc) return;
    const tracks = Array.isArray(doc.tracks) ? doc.tracks.slice() : [];
    const idx = tracks.findIndex((t: any) => t.propertyPath === payload.propertyPath);
    if (idx >= 0) {
        const list = Array.isArray(tracks[idx].keyframes) ? tracks[idx].keyframes.slice() : [];
        list.push({ frame: Math.max(0, payload.frame|0), value: payload.value });
        list.sort((a:any,b:any)=> (a.frame|0)-(b.frame|0));
        tracks[idx] = { ...tracks[idx], keyframes: list };
    } else {
        tracks.push({ propertyPath: payload.propertyPath, keyframes: [{ frame: Math.max(0, payload.frame|0), value: payload.value }] });
    }
    (scenes.sceneDocs.value as any)[id] = { ...doc, tracks };
    TimelineService.saveScene(songId.value, (scenes.sceneDocs.value as any)[id]);
};

const handlePropMoveKf = (payload: { propertyPath: string; index: number; frame: number }) => {
    console.log('[Editor] handlePropMoveKf:', payload);
    const id = scenes.selectedSceneId.value; 
    if (!id) {
        console.warn('[Editor] No selected scene id');
        return;
    }
    const doc = scenes.sceneDocs.value[id]; 
    if (!doc) {
        console.warn('[Editor] No scene doc found for id:', id);
        return;
    }
    const tracks = Array.isArray(doc.tracks) ? doc.tracks.slice() : [];
    console.log('[Editor] Current tracks:', tracks);
    const tIdx = tracks.findIndex((t: any) => t.propertyPath === payload.propertyPath);
    console.log('[Editor] Track index:', tIdx);
    if (tIdx >= 0) {
        const list = Array.isArray(tracks[tIdx].keyframes) ? tracks[tIdx].keyframes.slice() : [];
        console.log('[Editor] Keyframes in track:', list);
        if (payload.index >= 0 && payload.index < list.length) {
            const k = { ...list[payload.index], frame: Math.max(0, payload.frame|0) };
            console.log('[Editor] Updating keyframe:', payload.index, 'to frame:', payload.frame);
            list[payload.index] = k;
            list.sort((a:any,b:any)=> (a.frame|0)-(b.frame|0));
            tracks[tIdx] = { ...tracks[tIdx], keyframes: list };
            (scenes.sceneDocs.value as any)[id] = { ...doc, tracks };
            TimelineService.saveScene(songId.value, (scenes.sceneDocs.value as any)[id]);
            console.log('[Editor] Keyframe updated and saved');
        } else {
            console.warn('[Editor] Invalid keyframe index:', payload.index, 'list length:', list.length);
        }
    } else {
        console.warn('[Editor] Track not found for propertyPath:', payload.propertyPath);
    }
};

// ===== TIMELINE PROPERTY TRACKS (UI computation) =====
const scenePropertyTracksForUI = computed<any[]>(() => {
    const id = scenes.selectedSceneId.value; if (!id) return [];
    const doc = (scenes.sceneDocs.value as any)[String(id)];
    const tracks = Array.isArray(doc?.tracks) ? doc.tracks : [];
    // Only show lanes for tracks that actually have keyframes
    return tracks.filter((t: any) => Array.isArray(t?.keyframes) && t.keyframes.length > 0);
});

const handleDeleteKeyframe = (payload: { propertyPath: string; index: number }) => {
    console.log('[Editor] handleDeleteKeyframe called:', payload);
    const id = scenes.selectedSceneId.value; 
    if (!id) {
        console.log('[Editor] No selected scene ID');
        return;
    }
    const doc = scenes.sceneDocs.value[id]; 
    if (!doc) {
        console.log('[Editor] No document found for scene:', id);
        return;
    }
    const tracks = Array.isArray(doc.tracks) ? doc.tracks.slice() : [];
    console.log('[Editor] Current tracks:', tracks);
    const tIdx = tracks.findIndex((t: any) => t.propertyPath === payload.propertyPath);
    console.log('[Editor] Track index:', tIdx);
    if (tIdx >= 0) {
        const list = Array.isArray(tracks[tIdx].keyframes) ? tracks[tIdx].keyframes.slice() : [];
        console.log('[Editor] Keyframes before delete:', list);
        if (payload.index >= 0 && payload.index < list.length) {
            list.splice(payload.index, 1);
            console.log('[Editor] Keyframes after delete:', list);
            if (list.length === 0) {
                // Remove track entirely when empty
                tracks.splice(tIdx, 1);
            } else {
                tracks[tIdx] = { ...tracks[tIdx], keyframes: list };
            }
            (scenes.sceneDocs.value as any)[id] = { ...doc, tracks };
            TimelineService.saveScene(songId.value, (scenes.sceneDocs.value as any)[id]);
            console.log('[Editor] Saved scene');
        } else {
            console.log('[Editor] Index out of range:', { index: payload.index, length: list.length });
        }
    } else {
        console.log('[Editor] Track not found for property:', payload.propertyPath);
    }
};

const scenePropertyMetas = computed<any[]>(() => {
    const id = scenes.selectedSceneId.value; if (!id) return [] as any[];
    const tlAny: any = timeline.value as any;
    const scenesArr: any[] = Array.isArray(tlAny?.scenes) ? tlAny.scenes : [];
    const sc = scenesArr.find((x: any) => x && x.id === id);
    const type = sc?.type as any;
    return type ? (SCENE_ANIMATABLES as any)[String(type)] || [] : [];
});

const handlePropChangeValue = (payload: { propertyPath: string; value: any }) => {
    console.log('[Editor] handlePropChangeValue:', payload);
    const id = scenes.selectedSceneId.value; if (!id) return;
    const doc = scenes.sceneDocs.value[id]; if (!doc) return;
    const frame = playback.frame.value | 0;
    const tracks = Array.isArray(doc.tracks) ? doc.tracks.slice() : [];
    let idx = tracks.findIndex((t: any) => t.propertyPath === payload.propertyPath);
    
    if (idx < 0) {
        // No track exists - create one with keyframe at current frame
        console.log('[Editor] Creating new track with keyframe at frame', frame);
        tracks.push({ propertyPath: payload.propertyPath, keyframes: [{ frame, value: payload.value }] });
    } else {
        // Track exists - check if keyframe exists at current frame
        const list = Array.isArray(tracks[idx].keyframes) ? tracks[idx].keyframes.slice() : [];
        const kfIdx = list.findIndex((k: any) => (k.frame|0) === frame);
        
        if (kfIdx >= 0) {
            // Keyframe exists at current frame - update its value
            console.log('[Editor] Updating existing keyframe at frame', frame);
            list[kfIdx] = { ...list[kfIdx], value: payload.value };
        } else {
            // No keyframe at current frame - create one
            console.log('[Editor] Creating new keyframe at frame', frame);
            list.push({ frame, value: payload.value });
        }
        
        tracks[idx] = { ...tracks[idx], keyframes: list.sort((a:any,b:any)=> (a.frame|0)-(b.frame|0)) };
    }
    
    (scenes.sceneDocs.value as any)[id] = { ...doc, tracks };
    TimelineService.saveScene(songId.value, (scenes.sceneDocs.value as any)[id]);
    
    // Force a frame update to reflect the change immediately
    frameRenderer.sendFrameToWorker(frame, 0);
};

// ===== SCROLL HANDLERS =====

const handleScrollToProperty = (payload: { propertyPath: string }) => {
    // Scroll to the corresponding property lane in the timeline
    nextTick(() => {
        const laneEl = timelineEl.value?.querySelector(`[data-property-path="${payload.propertyPath}"]`) as HTMLElement;
        if (laneEl) {
            laneEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add highlight effect
            laneEl.style.background = 'rgba(0, 212, 255, 0.2)';
            setTimeout(() => {
                laneEl.style.background = '';
            }, 1000);
        }
    });
};

const handleScrollToInspector = (payload: { propertyPath: string }) => {
    // Scroll to the corresponding property in the inspector
    nextTick(() => {
        const propEl = inspectorEl.value?.querySelector(`[data-property-path="${payload.propertyPath}"]`) as HTMLElement;
        if (propEl) {
            // Open the details group containing this property
            const detailsEl = propEl.closest('details');
            if (detailsEl) {
                detailsEl.open = true;
            }
            
            propEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add highlight effect to the property header
            const headerEl = propEl.querySelector('.property-header') as HTMLElement;
            if (headerEl) {
                headerEl.style.background = 'rgba(0, 212, 255, 0.2)';
                setTimeout(() => {
                    headerEl.style.background = '';
                }, 1000);
            }
        }
    });
};

// ===== LIFECYCLE =====

onMounted(async () => {
    document.title = 'Editor - Words On Live Kanvas - Open Culture Tech';
    await videoExport.checkFfmpegAvailable();
    
    // Load saved panel widths from localStorage
    const savedSidebarWidth = localStorage.getItem('editor-sidebar-width');
    const savedInspectorWidth = localStorage.getItem('editor-inspector-width');
    
    const editorEl = document.querySelector('.editor') as HTMLElement;
    if (editorEl) {
        if (savedSidebarWidth) {
            editorEl.style.setProperty('--sidebar-width', savedSidebarWidth + 'px');
        }
        if (savedInspectorWidth) {
            editorEl.style.setProperty('--inspector-width', savedInspectorWidth + 'px');
        }
    }
    
    // Setup sidebar resize
    const sidebar = document.querySelector('.editor__sidebar') as HTMLElement;
    if (sidebar) {
        const onPointerDown = (e: PointerEvent) => {
            const rect = sidebar.getBoundingClientRect();
            if (e.clientX < rect.right - 6) return; // only grab right edge
            
            sidebar.classList.add('is-resizing');
            const startW = sidebar.offsetWidth;
            const startX = e.clientX;
            
            const onMove = (ev: PointerEvent) => {
                const dx = ev.clientX - startX;
                const newW = Math.max(200, Math.min(500, startW + dx));
                editorEl.style.setProperty('--sidebar-width', newW + 'px');
            };
            
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                sidebar.classList.remove('is-resizing');
                
                // Save to localStorage
                const currentWidth = sidebar.offsetWidth;
                localStorage.setItem('editor-sidebar-width', currentWidth.toString());
            };
            
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        };
        
        sidebar.addEventListener('pointerdown', onPointerDown);
    }
    
    // Setup inspector resize
    const inspector = document.querySelector('.editor__inspector') as HTMLElement;
    if (inspector) {
        const onPointerDown = (e: PointerEvent) => {
            const rect = inspector.getBoundingClientRect();
            if (e.clientX > rect.left + 6) return; // only grab left edge
            
            inspector.classList.add('is-resizing');
            const startW = inspector.offsetWidth;
            const startX = e.clientX;
            
            const onMove = (ev: PointerEvent) => {
                const dx = startX - ev.clientX;
                const newW = Math.max(280, Math.min(600, startW + dx));
                editorEl.style.setProperty('--inspector-width', newW + 'px');
            };
            
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                inspector.classList.remove('is-resizing');
                
                // Save to localStorage
                const currentWidth = inspector.offsetWidth;
                localStorage.setItem('editor-inspector-width', currentWidth.toString());
            };
            
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        };
        
        inspector.addEventListener('pointerdown', onPointerDown);
    }
});

onUnmounted(() => {
    renderWorker.dispose();
    audioPlayer.dispose();
    if (previewResizeObserver) {
        previewResizeObserver.disconnect();
    }
    if (containerResizeObserver) {
        containerResizeObserver.disconnect();
    }
});
</script>

<template>
    <div class="editor-root">
    <div class="editor">
        <div class="editor__toolbar">
            <div class="toolbar__left">
                <button @click="play" :disabled="playback.playing.value" class="primary">Play</button>
                <button @click="pause" :disabled="!playback.playing.value">Pause</button>
                <button @click="stop" :disabled="!playback.playing.value && playback.frame.value === 0">Stop</button>
            </div>
            <div class="toolbar__right">
                <button @click="reanalyze" :disabled="!audioPlayer.audioReady.value">Reanalyze</button>
                <button @click="exportWolk" class="export">Export .wolk</button>
            </div>
            <span v-if="videoExport.ffmpegAvailable.value === false" class="toolbar__notice">
                ffmpeg not found. On macOS: install with <code>brew install ffmpeg</code>. Only WebM will be produced.
            </span>
        </div>

        <div class="editor__sidebar">
            <SceneList
                :scenes="timeline?.scenes || []"
                :selected-id="scenes.selectedSceneId.value || undefined"
                :current-frame="playback.frame.value"
                :fps="fps"
                @select="selectScene"
                @add="addScene"
                @delete="sceneActions.handleDeleteScene"
                @duplicate="sceneActions.handleDuplicateScene"
                @rename="sceneActions.handleRenameScene"
                @switchHere="sceneActions.handleSwitchHere"
            />
        </div>

        <div class="editor__preview">
            <div class="monitor-container">
                <div class="monitor-header">
                    <div class="monitor-title-section">
                        <h3 class="monitor-title">MONITOR</h3>
                        <span class="monitor-frame">Frame: {{ playback.frame.value }}</span>
                    </div>
                    <div class="monitor-export-controls">
                        <button @click="videoExport.stopExport" class="export danger" :disabled="!videoExport.isRecording.value">Stop Export</button>
                        <button @click="exportWithOptions" class="export success">Export</button>
                    </div>
                </div>
                
                <div class="monitor-display">
                    <!-- 
                        Render canvas: Full resolution (e.g., 1920x1080) canvas hidden off-screen.
                        This is transferred to a Web Worker for high-quality rendering and export.
                    -->
                    <canvas ref="renderCanvas" class="preview__canvas-offscreen"></canvas>
                    
                    <!-- 
                        Preview canvas: Scaled-down display canvas that shows the render output.
                        drawPreview() copies from renderCanvas to this canvas, fitting to container size.
                    -->
                    <div class="preview__canvas-wrapper">
                        <canvas ref="previewCanvas" class="preview__canvas"></canvas>
                        <canvas ref="previewOverlay" class="preview__overlay"></canvas>
                    </div>
                </div>
                
                <div class="monitor-settings">
                    <div class="monitor-info">
                        <!-- Read-only mode -->
                        <template v-if="!isEditingSettings">
                            <span class="info-item">{{ timeline?.settings.fps || 60 }} FPS</span>
                            <span class="info-separator">•</span>
                            <span class="info-item">{{ timeline?.settings.renderWidth || 1920 }} × {{ timeline?.settings.renderHeight || 1080 }}</span>
                            <span class="info-separator">•</span>
                            <span class="info-item">{{ timeline?.settings.exportBitrateMbps || 8 }} Mbps</span>
                        </template>
                        
                        <!-- Edit mode -->
                        <template v-else>
                            <input 
                                v-if="timeline" 
                                type="number" 
                                :value="timeline.settings.fps" 
                                @input="e => { if (timeline) timeline.settings.fps = Number((e.target as HTMLInputElement).value) }"
                                class="fps-input"
                                placeholder="FPS"
                                min="1"
                                max="120"
                            />
                            <span class="info-label">FPS</span>
                            <span class="info-separator">•</span>
                            <select v-if="timeline" @change="updateDimensions" :value="`${timeline.settings.renderWidth}x${timeline.settings.renderHeight}`" class="dimension-preset">
                                <option value="1920x1080">1920 × 1080</option>
                                <option value="1280x720">1280 × 720</option>
                                <option value="3840x2160">3840 × 2160 (4K)</option>
                                <option value="2560x1440">2560 × 1440 (2K)</option>
                                <option value="1080x1920">1080 × 1920 (Vertical)</option>
                                <option value="custom">Custom</option>
                            </select>
                            <input 
                                v-if="timeline && `${timeline.settings.renderWidth}x${timeline.settings.renderHeight}` === 'custom'" 
                                type="text" 
                                :value="`${timeline.settings.renderWidth} × ${timeline.settings.renderHeight}`"
                                @input="updateCustomDimensions"
                                class="custom-dimensions"
                                placeholder="Width × Height"
                            />
                            <span class="info-separator">•</span>
                            <input 
                                v-if="timeline" 
                                type="number" 
                                :value="timeline.settings.exportBitrateMbps" 
                                @input="e => { if (timeline) timeline.settings.exportBitrateMbps = Number((e.target as HTMLInputElement).value) }"
                                class="bitrate-input"
                                placeholder="Mbps"
                                min="1"
                                max="100"
                            />
                            <span class="info-label">Mbps</span>
                        </template>
                    </div>
                    <div class="monitor-controls">
                        <button @click="toggleEditSettings" class="edit-toggle">
                            {{ isEditingSettings ? '✓ Done' : '✎ Edit' }}
                        </button>
                        <button @click="toggleIncludeAudio" :class="['audio-toggle', { active: timeline?.settings.includeAudio }]">
                            <span class="audio-icon">{{ timeline?.settings.includeAudio ? '✓' : '✗' }}</span>
                            Include Audio
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="editor__inspector" ref="inspectorEl">
            <Inspector
                :timeline="timeline"
                :selected-scene="scenes.selectedScene.value"
                :scene-params="scenes.selectedSceneParams.value"
                :scene-tracks="scenePropertyTracksForUI"
                :overlay-opts="overlayOpts"
                :current-frame="playback.frame.value"
                :word-bank="song?.wordBank || []"
                :word-groups="song?.wordGroups || []"
                :allowed-track="allowedTrack"
                @update:overlayOpts="v => overlayOpts = v"
                @update:timeline="onTimelineUpdated"
                @update:scene="onSceneUpdated"
                @update:sceneParams="applySceneParams"
                @update:sceneTracks="handleSceneTracksUpdate"
                @propChangeValue="handlePropChangeValue"
                @addKeyframe="handlePropAddKf"
                @deleteKeyframe="handleDeleteKeyframe"
                @navigate="({ dir }) => timelineNavigation.navigateTo(dir)"
                @scrubToFrame="(frame) => playback.scrubToFrame(frame)"
                @resetProject="handleReset"
                @importWolk="wolkImport.openDialog"
                @scrollToProperty="handleScrollToProperty"
            />
        </div>

        <div class="editor__timeline timeline-host" ref="timelineEl">
            <TimelineRoot
                :fps="fps"
                :current-frame="playback.frame.value"
                :duration-sec="audioPlayer.duration.value || audioDurationSec"
                :analyzed-duration-sec="audioAnalysis.analysisCache.value?.durationSec"
                :beats="audioAnalysis.beatTimesSec.value || undefined"
                :waveform="(audioAnalysis.waveform.value || []) as any"
                :energy-per-frame="audioAnalysis.analysisCache.value?.energyPerFrame as any"
                :bands-low-per-frame="audioAnalysis.bandsLowPerFrame.value || undefined"
                :bands-mid-per-frame="audioAnalysis.bandsMidPerFrame.value || undefined"
                :bands-high-per-frame="audioAnalysis.bandsHighPerFrame.value || undefined"
                :beat-strength-per-frame="audioAnalysis.beatStrengthPerFrame.value || undefined"
                :is-onset-per-frame="frameEval.derivedOnsetPerFrame.value || audioAnalysis.analysisCache.value?.isOnsetPerFrame"
                :show-energy="overlayOpts.showEnergy"
                :show-onsets="overlayOpts.showOnsets && scenes.selectedScene.value?.type === 'singleWord'"
                :scenes="timeline?.scenes || []"
                :selected-scene-id="scenes.selectedSceneId.value || undefined"
                :action-items="(timeline?.actionTracks || []) as any"
                :word-keyframes="timeline?.wordsPoolTrack?.keyframes?.map((k: any) => k.frame) || []"
                :scene-property-tracks="scenePropertyTracksForUI as any"
                :scene-property-metas="scenePropertyMetas as any[]"
                :scene-param-snapshot="(scenes.selectedSceneParams.value || {}) as any"
                @scrub="onScrub"
                @dragGlobalPoolMarker="({ index, frame, originalFrame }) => wordPoolMarkers.moveMarker(index, frame, originalFrame)"
                @sceneUpdate="sceneActions.handleSceneUpdate"
                @sceneSelect="({ id }) => selectScene(id)"
                @actionToggle="actionTracks.toggleWordOverride"
                @propAddKf="handlePropAddKf"
                @propMoveKf="handlePropMoveKf"
                @propDeleteKf="handleDeleteKeyframe"
                @propChangeValue="handlePropChangeValue"
                @scrollToInspector="handleScrollToInspector"
            />
        </div>
    </div>

    <!-- Import Dialog -->
    <div v-if="wolkImport.showDialog.value" class="modal-backdrop">
        <div class="modal">
            <h3>Import .wolk</h3>
            <div>
                <input
                    type="file"
                    accept=".wolk,application/zip,application/gzip"
                    @change="wolkImport.pickFile"
                />
            </div>
            <div class="import-options">
                <label>
                    <input type="radio" value="copy" v-model="wolkImport.strategy.value" />
                    Copy (create new project)
                </label>
                <label>
                    <input type="radio" value="override" v-model="wolkImport.strategy.value" />
                    Override (replace if same ID)
                </label>
            </div>
            <div v-if="wolkImport.error.value" class="error">{{ wolkImport.error.value }}</div>
            <div class="actions">
                <button @click="wolkImport.closeDialog" :disabled="wolkImport.isImporting.value">Cancel</button>
                <button @click="wolkImport.doImport" :disabled="wolkImport.isImporting.value || !wolkImport.file.value" class="primary">
                    {{ wolkImport.isImporting.value ? 'Importing…' : 'Import' }}
                </button>
            </div>
        </div>
    </div>
    </div>
</template>
