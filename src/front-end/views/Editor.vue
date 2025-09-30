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
    const result = Math.max(0, Math.floor(dur * fps.value));
    console.log('[Editor] maxFrame computed:', result, 'from duration:', dur, 'audioDurationSec:', audioDurationSec.value, 'audioPlayer.duration:', audioPlayer.duration.value, 'fps:', fps.value);
    return result;
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

// Export/Import
const videoExport = useVideoExport(
    renderCanvas,
    audioPlayer.audioEl,
    timeline,
    songId
);
const wolkImport = useWolkImport();

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
    
    const ctx = dst.getContext('2d');
    if (!ctx) return;
    
    const w = dst.width = dst.clientWidth;
    const h = dst.height = dst.clientHeight;
    const rw = targetWidth.value;
    const rh = targetHeight.value;
    
    const scale = Math.min(w / Math.max(1, rw), h / Math.max(1, rh));
    const dw = Math.floor(rw * scale);
    const dh = Math.floor(rh * scale);
    const dx = Math.floor((w - dw) / 2);
    const dy = Math.floor((h - dh) / 2);
    
    ctx.clearRect(0, 0, w, h);
    try {
        ctx.drawImage(src, 0, 0, src.width, src.height, dx, dy, dw, dh);
    } catch {}
};

// ===== PLAYBACK CONTROL =====
let lastPlayStartAtFrame = 0;
let lastPlayStartTs = 0;
const SYNC_SUPPRESS_MS = 300; // allow audio currentTime to advance before enforcing sync
const SYNC_DRIFT_FRAMES = 2;  // only resync if off by > 2 frames

/**
 * Playback tick callback - sends frame data to worker.
 */
console.log('[Editor] Registering playback.onTick callback, playback is:', playback, 'onTick exists?', typeof playback.onTick);
playback.onTick((frame, dt) => {
    console.log('[Editor] playback tick - frame:', frame, 'playback.frame.value:', playback.frame.value);
    // Hard-sync timeline frame to audio element time to avoid drift
    if (audioPlayer.isPlaying.value && audioPlayer.audioEl.value) {
        const now = performance.now();
        const t = audioPlayer.audioEl.value.currentTime;
        const fFromAudio = Math.max(0, Math.round(t * Math.max(1, fps.value)));
        const drift = Math.abs(fFromAudio - playback.frame.value);
        // Suppress early snaps right after play to avoid snapping to 0 while audio time warms up
        const withinSuppress = (now - lastPlayStartTs) < SYNC_SUPPRESS_MS;
        // Only sync forward; never snap backward to earlier frames
        const shouldSyncForward = fFromAudio > playback.frame.value && drift > SYNC_DRIFT_FRAMES;
        if (!withinSuppress && shouldSyncForward) {
            playback.scrubToFrame(fFromAudio);
        }
    }
    const beat = frameEval.getBeatAtFrame(frame);
    const wordIndex = frameEval.getWordIndexAtFrame(frame);
    const mix = frameEval.getActiveScenesAtFrame(frame);
    const wordOverride = frameEval.getWordOverrideAtFrame(frame);
    
    // Get spectral bands
    const cache = audioAnalysis.analysisCache.value;
    const lowBand = audioAnalysis.bandsLowPerFrame.value[Math.min(cache?.totalFrames || 0 - 1, Math.max(0, frame))] || 0;
    const midBand = audioAnalysis.bandsMidPerFrame.value[Math.min(cache?.totalFrames || 0 - 1, Math.max(0, frame))] || 0;
    const highBand = audioAnalysis.bandsHighPerFrame.value[Math.min(cache?.totalFrames || 0 - 1, Math.max(0, frame))] || 0;
    
    // Check if reconfiguration needed
    const cfgKey = computeConfigKeyForFrame(frame);
    if (cfgKey !== lastConfiguredKey) {
        configureWorkerScene();
    }
    
    renderWorker.sendFrame({
        frame,
        dt,
        beat,
        wordIndex,
        alphaA: mix.alphaA,
        alphaB: mix.alphaB,
        wordOverride,
        lowBand,
        midBand,
        highBand
    });
});

// Render completion callback
renderWorker.onRenderComplete(() => {
    drawPreview();
});

const play = async () => {
    console.log('[Editor] play() called. audioReady:', audioPlayer.audioReady.value, 'duration:', audioPlayer.duration.value, 'maxFrame:', maxFrame.value, 'worker.isReady:', renderWorker.isReady.value);
    
    if (!renderWorker.isReady.value) {
        console.log('[Editor] Worker not ready, aborting play');
        return;
    }
    
    if (maxFrame.value <= 0) {
        console.log('[Editor] maxFrame is 0, aborting play');
        return;
    }
    
    // Record play start for sync suppression window
    lastPlayStartAtFrame = playback.frame.value;
    lastPlayStartTs = performance.now();
    // Sync audio
    if (audioPlayer.audioReady.value) {
        const timeSec = playback.frame.value / Math.max(1, fps.value);
        audioPlayer.seekTo(timeSec);
        await audioPlayer.play();
    }
    
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
    const beat0 = frameEval.getBeatAtFrame(0);
    const wordIndex0 = frameEval.getWordIndexAtFrame(0);
    const mix0 = frameEval.getActiveScenesAtFrame(0);
    const wordOverride0 = frameEval.getWordOverrideAtFrame(0);
    
    renderWorker.sendFrame({
        frame: 0,
        dt: 0,
        beat: beat0,
        wordIndex: wordIndex0,
        alphaA: mix0.alphaA,
        alphaB: mix0.alphaB,
        wordOverride: wordOverride0
    });
    
    requestAnimationFrame(() => drawPreview());
};

// ===== TIMELINE HANDLERS =====

const onScrub = async (payload: { timeSec: number; frame: number }) => {
    audioPlayer.seekTo(payload.timeSec);
    playback.scrubToFrame(payload.frame);
    
    // Update preview immediately
    const beat = frameEval.getBeatAtFrame(payload.frame);
    const wordIndex = frameEval.getWordIndexAtFrame(payload.frame);
    const mix = frameEval.getActiveScenesAtFrame(payload.frame);
    const wordOverride = frameEval.getWordOverrideAtFrame(payload.frame);
    
    const cfgKey = computeConfigKeyForFrame(payload.frame);
    if (cfgKey !== lastConfiguredKey) {
        await configureWorkerScene();
    }
    
    const cache = audioAnalysis.analysisCache.value;
    const lowBand = audioAnalysis.bandsLowPerFrame.value[Math.min(cache?.totalFrames || 0 - 1, Math.max(0, payload.frame))] || 0;
    const midBand = audioAnalysis.bandsMidPerFrame.value[Math.min(cache?.totalFrames || 0 - 1, Math.max(0, payload.frame))] || 0;
    const highBand = audioAnalysis.bandsHighPerFrame.value[Math.min(cache?.totalFrames || 0 - 1, Math.max(0, payload.frame))] || 0;
    
    renderWorker.sendFrame({
        frame: payload.frame,
        dt: 0,
        beat,
        wordIndex,
        alphaA: mix.alphaA,
        alphaB: mix.alphaB,
        wordOverride,
        lowBand,
        midBand,
        highBand
    });
    
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
    const f = playback.frame.value;
    const beat = frameEval.getBeatAtFrame(f);
    const wordIndex = frameEval.getWordIndexAtFrame(f);
    const mix = frameEval.getActiveScenesAtFrame(f);
    const wordOverride = frameEval.getWordOverrideAtFrame(f);
    
    renderWorker.sendFrame({
        frame: f,
        dt: 0,
        beat,
        wordIndex,
        alphaA: mix.alphaA,
        alphaB: mix.alphaB,
        wordOverride
    });
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
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
            
            // Store buffer duration as fallback (for custom protocols where audio element might not get metadata)
            audioDurationSec.value = buffer.duration;
            console.log('[Editor] Stored audio buffer duration:', buffer.duration);
            
            // Run analysis
            await audioAnalysis.analyzeBuffer(buffer);
        } else {
            // Regular URL
            const response = await axios.get<ArrayBuffer>(audioSrc, { responseType: 'arraybuffer' });
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const buffer = await audioCtx.decodeAudioData(response.data.slice(0));
            
            // Store buffer duration as fallback
            audioDurationSec.value = buffer.duration;
            console.log('[Editor] Stored audio buffer duration:', buffer.duration);
            
            await audioAnalysis.analyzeBuffer(buffer);
        }
        
        // Load audio element
        await audioPlayer.load(song.value.audioSrc);
    }
    
    await nextTick();
    await renderWorker.start();
    await configureWorkerScene();
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
        
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        
        await audioAnalysis.analyzeBuffer(buffer);
        
        // Refresh current frame
        const f = playback.frame.value;
        const beat = frameEval.getBeatAtFrame(f);
        const wordIndex = frameEval.getWordIndexAtFrame(f);
        const mix = frameEval.getActiveScenesAtFrame(f);
        const wordOverride = frameEval.getWordOverrideAtFrame(f);
        
        renderWorker.sendFrame({ frame: f, dt: 0, beat, wordIndex, alphaA: mix.alphaA, alphaB: mix.alphaB, wordOverride });
        requestAnimationFrame(() => drawPreview());
    } catch {}
};

const exportWithOptions = async () => {
    await videoExport.startExport(() => {
        audioPlayer.seekTo(0);
        playback.scrubToFrame(0);
        play();
    });
};

const exportWolk = async () => {
    if (song.value) {
        await videoExport.exportWolk(song.value);
    }
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

const genId = () => crypto.randomUUID();

// Move global pool marker
const moveGlobalPoolMarker = (index: number, newFrame: number, originalFrame?: number) => {
    if (!timeline.value) return;
    
    const track = timeline.value.wordsPoolTrack || { propertyPath: 'timeline.words.pool', keyframes: [] } as any;
    const frames = (track.keyframes || []).slice();
    
    let targetIdx = index;
    if (typeof originalFrame === 'number') {
        const cand = frames.findIndex((k: any) => (k.frame | 0) === (originalFrame | 0));
        if (cand >= 0) targetIdx = cand;
    }
    
    if (targetIdx < 0 || targetIdx >= frames.length) return;
    
    const updated = frames.slice();
    const target = updated[targetIdx];
    updated.splice(targetIdx, 1);
    
    const next = { frame: Math.max(0, newFrame | 0), value: Array.isArray(target.value) ? target.value : [] };
    updated.push(next);
    updated.sort((a: any, b: any) => (a.frame | 0) - (b.frame | 0));
    
    const nextDoc: TimelineDocument = {
        ...(timeline.value as any),
        wordsPoolTrack: { propertyPath: 'timeline.words.pool', keyframes: updated }
    };
    
    onTimelineUpdated(nextDoc);
};

// ===== LIFECYCLE =====

onMounted(async () => {
    document.title = 'Editor - Words On Live Kanvas - Open Culture Tech';
    await videoExport.checkFfmpegAvailable();
});

onUnmounted(() => {
    renderWorker.dispose();
    audioPlayer.dispose();
});
</script>

<template>
    <div class="editor-root">
    <div class="editor">
        <div class="editor__toolbar">
            <button @click="play" :disabled="playback.playing.value">Play</button>
            <button @click="pause" :disabled="!playback.playing.value">Pause</button>
            <button @click="stop" :disabled="!playback.playing.value && playback.frame.value === 0">Stop</button>
            <button @click="reanalyze" :disabled="!audioPlayer.audioReady.value">Reanalyze</button>
            <span>Frame: {{ playback.frame.value }}</span>
            <button @click="exportWithOptions" style="margin-left:8px;">Export</button>
            <button @click="exportWolk" style="margin-left:8px;">Export .wolk</button>
            <button @click="videoExport.stopExport" style="margin-left:8px;" :disabled="!videoExport.isRecording.value">Stop Export</button>
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
                @delete="(id: string) => {
                    scenes.deleteScene(id);
                    if (timeline) TimelineService.save(songId, timeline);
                }"
                @switchHere="({ frame }) => {
                    const scenesList = [...(timeline?.scenes || [])];
                    if (!scenesList.length) return;
                    const idx = scenesList.findIndex(s => frame >= s.startFrame && frame < s.startFrame + s.durationFrames);
                    if (idx < 0 || idx + 1 >= scenesList.length) return;
                    const a = { ...scenesList[idx] } as any;
                    const b = { ...scenesList[idx + 1] } as any;
                    const leftDur = Math.max(1, frame - a.startFrame);
                    a.durationFrames = leftDur;
                    b.startFrame = frame;
                    scenesList[idx] = a;
                    scenesList[idx + 1] = b;
                    if (timeline) onTimelineUpdated({ ...(timeline as any), scenes: scenesList });
                }"
            />
        </div>

        <div class="editor__preview" :style="{ aspectRatio }">
            <div class="preview__canvas-wrapper">
                <canvas ref="renderCanvas" class="preview__canvas"></canvas>
                <canvas ref="previewCanvas" class="preview__canvas"></canvas>
                <canvas ref="previewOverlay" class="preview__overlay"></canvas>
            </div>
        </div>

        <div class="editor__inspector">
            <Inspector
                :timeline="timeline"
                :selected-scene="scenes.selectedScene.value"
                :scene-params="scenes.selectedSceneParams.value"
                :overlay-opts="overlayOpts"
                :current-frame="playback.frame.value"
                :word-bank="song?.wordBank || []"
                :word-groups="song?.wordGroups || []"
                :allowed-track="(() => {
                    const id = scenes.selectedSceneId.value;
                    if (!id) return null;
                    const doc = scenes.sceneDocs.value?.[id];
                    const tracks = Array.isArray(doc?.tracks) ? doc.tracks : [];
                    return tracks.find((t: any) => t.propertyPath === 'words.allowed') || null;
                })()"
                @update:overlayOpts="v => overlayOpts = v"
                @update:timeline="onTimelineUpdated"
                @update:scene="onSceneUpdated"
                @update:sceneParams="applySceneParams"
                @update:sceneTracks="(payload: any) => {
                    const sid = String(payload?.sceneId || '');
                    const incoming: any[] = Array.isArray(payload?.tracks) ? payload.tracks : [];
                    if (!sid) return;
                    const doc = scenes.sceneDocs.value?.[sid];
                    if (!doc) return;
                    const existing: any[] = Array.isArray(doc.tracks) ? doc.tracks : [];
                    const map: Record<string, any> = {};
                    existing.forEach((t: any) => { map[t.propertyPath] = t; });
                    incoming.forEach((t: any) => { map[t.propertyPath] = t; });
                    const merged = Object.values(map);
                    const updated = { ...doc, tracks: merged };
                    (scenes.sceneDocs.value as any)[sid] = updated;
                    TimelineService.saveScene(songId, updated);
                    configureWorkerScene();
                }"
                @navigate="({ dir }) => {
                    const track = timeline?.wordsPoolTrack;
                    const kf: number[] = Array.isArray(track?.keyframes)
                        ? (track as any).keyframes.map((k: any) => Math.max(0, (k.frame | 0))).sort((a: number, b: number) => a - b)
                        : [];
                    const beats = audioAnalysis.beatTimesSec.value;
                    const cur = playback.frame.value;
                    const secs = (f: number) => f / Math.max(1, fps);
                    const toFrame = (t: number) => Math.max(0, Math.round(t * Math.max(1, fps)));
                    
                    if (dir === 'nextKf' && kf.length) {
                        const n = kf.find((f: number) => f > cur);
                        if (typeof n === 'number') { onScrub({ timeSec: secs(n), frame: n }); return; }
                    }
                    if (dir === 'prevKf' && kf.length) {
                        const p = [...kf].reverse().find((f: number) => f < cur);
                        if (typeof p === 'number') { onScrub({ timeSec: secs(p), frame: p }); return; }
                    }
                    if ((dir === 'nextBeat' || dir === 'prevBeat') && beats.length) {
                        const curT = secs(cur);
                        const sorted = beats.slice().sort((a: number, b: number) => a - b);
                        if (dir === 'nextBeat') {
                            const nb = sorted.find((b: number) => b > curT);
                            if (typeof nb === 'number') { onScrub({ timeSec: nb, frame: toFrame(nb) }); return; }
                        } else {
                            const pb = [...sorted].reverse().find((b: number) => b < curT);
                            if (typeof pb === 'number') { onScrub({ timeSec: pb, frame: toFrame(pb) }); return; }
                        }
                    }
                }"
                @resetProject="handleReset"
                @importWolk="wolkImport.openDialog"
            />
        </div>

        <div class="editor__timeline timeline-host">
            <TimelineRoot
                :fps="fps"
                :current-frame="playback.frame.value"
                :duration-sec="audioPlayer.duration.value || audioDurationSec"
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
                @scrub="onScrub"
                @dragGlobalPoolMarker="({ index, frame, originalFrame }) => moveGlobalPoolMarker(index, frame, originalFrame)"
                @sceneUpdate="(s: any) => {
                    const list = [...(timeline?.scenes || [])];
                    const i = list.findIndex(x => x.id === s.id);
                    if (i >= 0) {
                        list[i] = s;
                        if (timeline) onTimelineUpdated({ ...(timeline as any), scenes: list });
                    }
                }"
                @sceneSelect="({ id }) => selectScene(id)"
                @actionToggle="({ frame }) => {
                    const acts = Array.isArray(timeline?.actionTracks) ? [...(timeline as any).actionTracks] : [];
                    const idx = acts.findIndex((a: any) => a.frame === frame && a.actionType === 'wordOverride');
                    if (idx >= 0) {
                        acts.splice(idx, 1);
                    } else {
                        acts.push({ id: genId(), frame, actionType: 'wordOverride', payload: { word: 'WOLK' } });
                    }
                    if (timeline) onTimelineUpdated({ ...(timeline as any), actionTracks: acts });
                }"
            />
        </div>
    </div>

    <!-- Import Dialog -->
    <div v-if="wolkImport.showDialog.value" class="modal-backdrop">
        <div class="modal">
            <h3>Import .wolk</h3>
            <div style="margin:8px 0;">
                <input
                    type="file"
                    accept=".wolk,application/zip,application/gzip"
                    @change="wolkImport.pickFile"
                />
            </div>
            <div style="margin:8px 0; display:flex; gap:12px; align-items:center;">
                <label>
                    <input type="radio" value="copy" v-model="wolkImport.strategy.value" />
                    Copy (create new project)
                </label>
                <label>
                    <input type="radio" value="override" v-model="wolkImport.strategy.value" />
                    Override (replace if same ID)
                </label>
            </div>
            <div v-if="wolkImport.error.value" style="color:#e66;">{{ wolkImport.error.value }}</div>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
                <button @click="wolkImport.closeDialog" :disabled="wolkImport.isImporting.value">Cancel</button>
                <button @click="wolkImport.doImport" :disabled="wolkImport.isImporting.value || !wolkImport.file.value">
                    {{ wolkImport.isImporting.value ? 'Importing…' : 'Import' }}
                </button>
            </div>
        </div>
    </div>
    </div>
</template>
