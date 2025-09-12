<script setup lang="ts">
import { onMounted, ref, shallowRef, computed, nextTick, watch, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TimelineService } from '@/front-end/services/TimelineService';
import { SongService } from '@/front-end/services/SongService';
import type { TimelineDocument, SceneRef, SceneDocumentBase, ActionItem, TransitionEasing, PropertyTrack } from '@/types/timeline_types';
import SceneList from '@/front-end/components/editor/SceneList.vue';
import Inspector from '@/front-end/components/editor/Inspector.vue';
import TimelineRoot from '@/front-end/components/timeline/TimelineRoot.vue';
import axios from 'axios';
import Meyda from 'meyda';
import { AnalysisService } from '@/front-end/services/AnalysisService';
import type { AnalysisCache } from '@/types/analysis_types';
const handleReset = async () => {
    try {
        const res = await (window as any).electronAPI.timeline.reset(songId.value as string);
        if (res?.ok && res?.doc) {
            timeline.value = res.doc as any;
            selectedSceneId.value = null;
            sceneDocs.value = {} as any;
            await configureWorkerScene();
        }
    } catch {}
};

// Import dialog state and actions
const showImportDialog = ref(false);
const importStrategy = ref<'copy' | 'override'>('copy');
const importFile = ref<File | null>(null);
const isImporting = ref(false);
const importError = ref<string | null>(null);

const route = useRoute();
const router = useRouter();
const handleOpenImportDialog = () => {
    showImportDialog.value = true;
    importStrategy.value = 'copy';
    importFile.value = null;
    importError.value = null;
};
const handleCancelImport = () => {
    showImportDialog.value = false;
    importFile.value = null;
    importError.value = null;
};
const handlePickImportFile = (e: Event) => {
    const files = (e.target as HTMLInputElement).files;
    importFile.value = files && files[0] ? files[0] : null;
};
const handleDoImport = async () => {
    if (!importFile.value) { importError.value = 'Choose a .wolk file'; return; }
    try {
        isImporting.value = true; importError.value = null;
        const arrayBuffer = await importFile.value.arrayBuffer();
        const res = await (window as any).electronAPI.export.importWolkBytes(arrayBuffer, importStrategy.value);
        if (res?.songId) {
            showImportDialog.value = false;
            await router.push({ name: 'Editor', params: { songId: res.songId } });
        } else {
            importError.value = String(res?.error || 'Import failed. Please check the file.');
        }
    } catch (e: any) {
        importError.value = String(e?.message || 'Import error');
    } finally {
        isImporting.value = false;
    }
};
const props = defineProps<{ songId?: string }>();
const songId = computed(() => String(props.songId || (route.params.songId as string) || ''));

const timeline = ref<TimelineDocument | null>(null);
const song = ref<import('@/types/song_types').Song | null>(null);
const playing = ref(false);
const frame = ref(0);
const fps = ref(60);

const renderCanvas = ref<HTMLCanvasElement | null>(null);
const previewCanvas = ref<HTMLCanvasElement | null>(null);
const previewOverlay = ref<HTMLCanvasElement | null>(null);
const workerRef = shallowRef<Worker | null>(null);
let lastTime = 0;

// Export state
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];
const isRecording = ref(false);
const ffmpegAvailable = ref<boolean | null>(null);

const checkFfmpeg = async () => {
    try {
        const ok = await (window as any).electronAPI.export.ffmpegAvailable();
        ffmpegAvailable.value = !!ok;
    } catch {
        ffmpegAvailable.value = false;
    }
};

const targetWidth = computed(() => timeline.value?.settings.renderWidth || 1920);
const targetHeight = computed(() => timeline.value?.settings.renderHeight || 1080);
const aspectRatio = computed(() => `${targetWidth.value} / ${targetHeight.value}`);

// Scene selection
const selectedSceneId = ref<string | null>(null);
const selectedScene = computed(() => (timeline.value?.scenes || []).find(s => s.id === selectedSceneId.value) || null);
const isSingleWordScene = computed(() => ((selectedScene.value?.type || '') === 'singleWord'));
// Keyframe selection state (global opacity track)
const selectedKfIndex = ref<number | null>(null);

// Audio state
let audioEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let meydaAnalyzer: any | null = null;
const waveform = ref<number[] | null>(null);
const beatEnvelope = ref<number>(0);
const beatTimesSec = ref<number[] | null>(null);
const audioReady = ref(false);
const analysisCache = ref<AnalysisCache | null>(null);
const overlayOpts = ref<{ showEnergy: boolean; showOnsets: boolean; showBeats?: boolean }>({ showEnergy: true, showOnsets: true, showBeats: false });
// Precomputed beat envelope samples (~60Hz) for deterministic scrubbing
const beatEnv = ref<number[] | null>(null);
// Additional precomputed per-frame features
const bandsLowPerFrame = ref<number[] | null>(null);
const bandsMidPerFrame = ref<number[] | null>(null);
const bandsHighPerFrame = ref<number[] | null>(null);
const beatStrengthPerFrame = ref<number[] | null>(null);
// Per-scene documents cache (lazy-loaded)
const sceneDocs = ref<Record<string, SceneDocumentBase>>({});
const sceneParamsView = computed<Record<string, any>>(() => {
    const id = selectedSceneId.value || '';
    return (id && sceneDocs.value[id]?.params) ? (sceneDocs.value[id].params as any) : {};
});
// Derived onsets per frame (optionally using per-scene threshold)
const derivedOnsetPerFrame = computed<boolean[] | undefined>(() => {
    const cache = analysisCache.value;
    const t = timeline.value;
    if (!cache) return undefined;
    const base = Array.isArray(cache.isOnsetPerFrame) ? cache.isOnsetPerFrame.slice() : new Array(cache.totalFrames).fill(false);
    if (!t || !Array.isArray(t.scenes) || !t.scenes.length) return base;
    const e = cache.energyPerFrame || [];
    for (const s of t.scenes) {
        if ((s as any).type !== 'singleWord') continue;
        const params = sceneDocs.value[s.id]?.params || {};
        const thr = Number((params as any).beatThreshold);
        if (!Number.isFinite(thr)) continue;
        const startF = Math.max(0, s.startFrame | 0);
        const endF = Math.min(cache.totalFrames - 1, (s.startFrame + s.durationFrames - 1) | 0);
        let lastAbove = (e[Math.max(0, startF - 1)] || 0) > thr;
        for (let f = startF; f <= endF && f < e.length; f++) {
            const above = (e[f] || 0) > thr;
            const onset = above && !lastAbove;
            base[f] = onset;
            lastAbove = above;
        }
    }
    return base;
});

const derivedOnsetIndexPerFrame = computed<number[] | undefined>(() => {
    const cache = analysisCache.value;
    const on = derivedOnsetPerFrame.value || cache?.isOnsetPerFrame;
    if (!on || !on.length) return undefined;
    const out: number[] = new Array(on.length);
    let c = 0;
    for (let i = 0; i < on.length; i++) {
        if (on[i]) c++;
        out[i] = c;
    }
    return out;
});

// Beat-based cumulative index per frame (monotonic, increments on each beat time)
const derivedBeatIndexPerFrame = computed<number[] | undefined>(() => {
    const beats = beatTimesSec.value;
    const cache = analysisCache.value;
    if (!Array.isArray(beats) || !cache) return undefined;
    const totalFrames = Math.max(1, cache.totalFrames);
    const fpsVal = Math.max(1, fps.value);
    const out: number[] = new Array(totalFrames);
    const sorted = beats.slice().sort((a, b) => a - b);
    let count = 0;
    let bi = 0;
    for (let f = 0; f < totalFrames; f++) {
        const t = f / fpsVal;
        while (bi < sorted.length && sorted[bi] <= t) { count++; bi++; }
        out[f] = count;
    }
    return out;
});
let lastConfiguredPair = '';

const applySceneParams = async (p: Record<string, any>) => {
    const id = selectedSceneId.value || null;
    if (!id) return;
    const baseDoc: SceneDocumentBase = sceneDocs.value[id] || {
        id: (selectedScene.value as any)?.id,
        type: (selectedScene.value as any)?.type,
        name: (selectedScene.value as any)?.name,
        seed: String(timeline.value?.settings.seed || 'seed'),
        params: {},
        tracks: [] as any,
    } as any;
    baseDoc.params = { ...(baseDoc.params || {}), ...(p || {}) };
    sceneDocs.value[id] = baseDoc as any;
    try { await TimelineService.saveScene(songId.value as any, baseDoc as any); } catch {}
    await configureWorkerScene();
    // Push a new frame immediately so preview updates without needing to scrub/play
    const be = evalBeatForFrame(frame.value);
    const wi = evalWordIndexForFrame(frame.value);
    const mix = computeActiveScenesForFrame(frame.value);
    const wov = evalWordOverrideForFrame(frame.value);
    try { workerRef.value?.postMessage({ type: 'frame', frame: frame.value, dt: 0, beat: be, wordIndex: wi, alphaA: mix.alphaA, alphaB: mix.alphaB, wordOverride: wov } as any); } catch {}
};

const computeWaveform = (buffer: AudioBuffer, buckets = 1000): number[] => {
    const channelData = buffer.getChannelData(0);
    const samplesPerBucket = Math.max(1, Math.floor(channelData.length / buckets));
    const peaks: number[] = [];
    for (let i = 0; i < buckets; i++) {
        const start = i * samplesPerBucket;
        let min = 1, max = -1;
        for (let j = 0; j < samplesPerBucket && start + j < channelData.length; j++) {
            const v = channelData[start + j];
            if (v < min) min = v;
            if (v > max) max = v;
        }
        peaks.push(max, min);
    }
    return peaks;
};

const disposeWorker = () => {
    try {
        workerRef.value?.postMessage({ type: 'dispose' });
        workerRef.value?.terminate();
    } catch {}
    workerRef.value = null;
};

const startWorker = async () => {
    if (!renderCanvas.value) return;
    // Ensure the visible canvas has the correct bitmap size for preview copy
    try {
        renderCanvas.value.width = targetWidth.value;
        renderCanvas.value.height = targetHeight.value;
    } catch {}
    const canvas = renderCanvas.value.transferControlToOffscreen();
    const worker = new Worker(new URL('../workers/renderWorker.ts', import.meta.url), { type: 'module' });
    worker.postMessage({ type: 'init', canvas, width: targetWidth.value, height: targetHeight.value }, [canvas]);
    try {
        worker.addEventListener('message', (e: MessageEvent) => {
            const data: any = e.data;
            if (data && data.type === 'rendered') {
                drawPreview();
            }
        });
    } catch {}
    workerRef.value = worker;
};

const tick = (now: number) => {
    if (!playing.value) return;
    const dt = lastTime ? (now - lastTime) / 1000 : 0;
    lastTime = now;
    if (audioEl) {
        const dur = Number.isFinite(audioEl.duration) ? (audioEl.duration || 0) : 0;
        if (!audioEl.paused) {
            frame.value = Math.max(0, Math.floor((audioEl.currentTime || 0) * fps.value));
        } else {
            frame.value += Math.max(1, Math.round(dt * fps.value));
        }
        if (dur > 0) {
            const maxFrame = Math.max(0, Math.floor(dur * fps.value));
            if (frame.value >= maxFrame) {
                frame.value = maxFrame;
                pause();
                return;
            }
        }
    } else {
        frame.value += Math.max(1, Math.round(dt * fps.value));
    }
    const beat = evalBeatForFrame(frame.value);
    const wordIndex = evalWordIndexForFrame(frame.value);
    const lowB = (bandsLowPerFrame.value && analysisCache.value) ? (bandsLowPerFrame.value[Math.min(analysisCache.value.totalFrames - 1, Math.max(0, frame.value))] || 0) : undefined;
    const midB = (bandsMidPerFrame.value && analysisCache.value) ? (bandsMidPerFrame.value[Math.min(analysisCache.value.totalFrames - 1, Math.max(0, frame.value))] || 0) : undefined;
    const highB = (bandsHighPerFrame.value && analysisCache.value) ? (bandsHighPerFrame.value[Math.min(analysisCache.value.totalFrames - 1, Math.max(0, frame.value))] || 0) : undefined;
    const mix = computeActiveScenesForFrame(frame.value);
    const pairKey = mix.a.id + '|' + (mix.b?.id || '');
    if (pairKey !== lastConfiguredPair) {
        // reconfigure scenes when pair changes
        configureWorkerScene();
    }
    const wordOverride = evalWordOverrideForFrame(frame.value);
    workerRef.value?.postMessage({ type: 'frame', frame: frame.value, dt, beat, wordIndex, alphaA: mix.alphaA, alphaB: mix.alphaB, wordOverride, lowBand: lowB, midBand: midB, highBand: highB } as any);
    drawPreview();
    requestAnimationFrame(tick);
};

// global opacity track deprecated (M2 moves to scene property tracks). Keep stub for compatibility, return 1.
const evalGlobalOpacityForFrame = (_f: number): number => 1;

const play = () => {
    if (!workerRef.value) return;
    playing.value = true;
    lastTime = 0;
    if (audioEl && audioReady.value) {
        // Ensure playback resumes from the current scrubbed frame
        try {
            const t = Math.max(0, (frame.value || 0) / Math.max(1, fps.value));
            if (Number.isFinite(t)) {
                audioEl.currentTime = t;
            }
        } catch {}
        audioEl.play().catch(() => {});
        try { audioCtx?.resume(); } catch {}
        try { meydaAnalyzer?.start(); } catch {}
    }
    requestAnimationFrame(tick);
};

const pause = () => {
    playing.value = false;
    if (audioEl) audioEl.pause();
    try { meydaAnalyzer?.stop(); } catch {}
};

const stop = () => {
    // Stop playback and reset to start
    pause();
    frame.value = 0;
    try { if (audioEl) audioEl.currentTime = 0; } catch {}
    // Update preview immediately
    const beat0 = evalBeatForFrame(0);
    const wordIndex0 = evalWordIndexForFrame(0);
    const mix0 = computeActiveScenesForFrame(0);
    const wordOverride0 = evalWordOverrideForFrame(0);
    workerRef.value?.postMessage({ type: 'frame', frame: 0, dt: 0, beat: beat0, wordIndex: wordIndex0, alphaA: mix0.alphaA, alphaB: mix0.alphaB, wordOverride: wordOverride0 });
    requestAnimationFrame(() => drawPreview());
};

const reanalyze = async () => {
    try {
        const bytes = await (async () => {
            if (song.value?.audioSrc?.startsWith('wolk://')) {
                const r = await fetch(song.value.audioSrc);
                return await r.arrayBuffer();
            }
            const resp = await axios.get<ArrayBuffer>(song.value?.audioSrc || '', { responseType: 'arraybuffer' });
            return resp.data;
        })();
        if (!bytes) return;
        if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buf = await audioCtx.decodeAudioData(bytes.slice(0));
        analysisCache.value = await AnalysisService.analyzeBufferToCache(buf, fps.value);
        // Force a deterministic frame refresh
        const be = evalBeatForFrame(frame.value);
        const wi = evalWordIndexForFrame(frame.value);
        const mixR = computeActiveScenesForFrame(frame.value);
        const wov = evalWordOverrideForFrame(frame.value);
        workerRef.value?.postMessage({ type: 'frame', frame: frame.value, dt: 0, beat: be, wordIndex: wi, alphaA: mixR.alphaA, alphaB: mixR.alphaB, wordOverride: wov });
        requestAnimationFrame(() => drawPreview());
    } catch {}
};

const exportWithOptions = async () => {
    if (!renderCanvas.value) return;
    // Pre-export missing fonts check: warn and copy suggested fonts
    try {
        const primary = String(timeline.value?.settings.fontFamily || '');
        const fallbacks = Array.isArray(timeline.value?.settings.fontFallbacks) ? (timeline.value!.settings.fontFallbacks as string[]) : [];
        const families = [primary, ...fallbacks].filter(Boolean).map(s => s.toLowerCase());
        const fonts = await (window as any).electronAPI.fonts.list();
        const matched = (fonts || []).filter((f: any) => families.includes(String(f.familyGuess || '').toLowerCase()));
        const missingFamilies = families.filter(ff => !matched.find((m: any) => String(m.familyGuess||'').toLowerCase() === ff));
        if (missingFamilies.length) {
            const proceed = globalThis.confirm(`Some fonts may be missing: ${missingFamilies.join(', ')}. Continue anyway?`);
            if (!proceed) return;
        }
        const files = (matched || []).map((f: any) => f.filePath);
        if (files.length) {
            await (window as any).electronAPI.export.copyFontsForExport(songId.value as string, files);
        }
    } catch {}
    // Copy fonts on export (best-effort based on family names)
    try {
        const primary = String(timeline.value?.settings.fontFamily || '');
        const fallbacks = Array.isArray(timeline.value?.settings.fontFallbacks) ? (timeline.value!.settings.fontFallbacks as string[]) : [];
        const families = [primary, ...fallbacks].filter(Boolean).map(s => s.toLowerCase());
        if (families.length) {
            try {
                const fonts = await (window as any).electronAPI.fonts.list();
                const files = (fonts || []).filter((f: any) => families.includes(String(f.familyGuess || '').toLowerCase())).map((f: any) => f.filePath);
                if (files.length) {
                    await (window as any).electronAPI.export.copyFontsForExport(songId.value as string, files);
                }
            } catch {}
        }
    } catch {}

    const fpsValue = timeline.value?.settings.fps || 60;
    const stream = (renderCanvas.value as HTMLCanvasElement).captureStream(fpsValue);
    // If audio element exists, add audio track
    try {
        if (audioEl && (timeline.value?.settings.includeAudio ?? true)) {
            const audioStream = (audioEl as any).captureStream ? (audioEl as any).captureStream() : null;
            if (audioStream) {
                const audioTracks = audioStream.getAudioTracks();
                for (const t of audioTracks) stream.addTrack(t);
            }
        }
    } catch {}
    recordedChunks = [];
    const mime = 'video/webm;codecs=vp9,opus';
    const bitrate = Math.max(1, Number(timeline.value?.settings.exportBitrateMbps || 8));
    mediaRecorder = new MediaRecorder(stream as MediaStream, { mimeType: mime, videoBitsPerSecond: bitrate * 1_000_000 } as any);
    mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const buf = await blob.arrayBuffer();
        const name = `export_${Date.now()}.webm`;
        const res = await (window as any).electronAPI.export.saveWebM(songId.value as string, buf, name);
        recordedChunks = [];
        isRecording.value = false;
        try {
            const ok = await (window as any).electronAPI.export.ffmpegAvailable();
            if (ok && res?.filePath && res?.rootDir) {
                const mp4Out = res.rootDir + '/export.mp4';
                await (window as any).electronAPI.export.encodeMp4FromWebM(res.filePath, mp4Out);
            }
        } catch {}
    };
    mediaRecorder.start();
    isRecording.value = true;
    // Record for full song duration if available
    const durSec = Number.isFinite(audioEl?.duration || 0) ? (audioEl?.duration || 0) : 0;
    if (durSec > 0) {
        // Play from start
        try { if (audioEl) { audioEl.currentTime = 0; audioEl.play(); } } catch {}
        playing.value = true; lastTime = 0; requestAnimationFrame(tick);
        setTimeout(() => { try { mediaRecorder?.stop(); pause(); } catch {} }, Math.ceil(durSec * 1000) + 250);
    } else {
        // Fallback: record 5 seconds
        playing.value = true; lastTime = 0; requestAnimationFrame(tick);
        setTimeout(() => { try { mediaRecorder?.stop(); pause(); } catch {} }, 5000);
    }
};

const exportWolk = async () => {
    // Ask backend to zip the song folder and save to Downloads as {title}.wolk
    try {
        const s = song.value;
        if (!s) return;
        const safeTitle = (s.title || 'project').replace(/[^a-zA-Z0-9-_\.]+/g, '_');
        await (window as any).electronAPI.export.packageWolk(s.id, `${safeTitle}.wolk`);
    } catch {}
};

const stopExport = () => {
    try { mediaRecorder?.stop(); } catch {}
};

const initForSong = async (id: string) => {
    pause();
    disposeWorker();
    frame.value = 0;
    timeline.value = await TimelineService.createOrLoad(id);
    fps.value = timeline.value.settings.fps;
    // Load song for audio and words
    song.value = await SongService.load(id);
    audioReady.value = false;
    waveform.value = null;
    if (song.value?.audioSrc) {
        try {
            // Playback element
            audioEl = new Audio(song.value.audioSrc);
            audioEl.preload = 'auto';
            audioEl.addEventListener('canplay', () => { audioReady.value = true; });
            audioEl.addEventListener('loadedmetadata', () => {
                // ensure timeline updates duration via prop binding
            });
            audioEl.addEventListener('ended', () => { pause(); });
        } catch {}
        try {
            // Decode for waveform (handle custom wolk:// scheme via fetch)
            let audioArrayBuffer: ArrayBuffer | null = null;
            try {
                if (song.value.audioSrc?.startsWith('wolk://')) {
                    const r = await fetch(song.value.audioSrc);
                    audioArrayBuffer = await r.arrayBuffer();
                } else {
                    const resp = await axios.get<ArrayBuffer>(song.value.audioSrc, { responseType: 'arraybuffer' });
                    audioArrayBuffer = resp.data;
                }
            } catch {}
            if (!audioArrayBuffer) throw new Error('Failed to load audio bytes');
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (!sourceNode && audioEl) {
                try {
                    sourceNode = audioCtx.createMediaElementSource(audioEl);
                    // connect to destination so we can hear it
                    sourceNode.connect(audioCtx.destination);
                } catch {}
            }
            const buf = await audioCtx.decodeAudioData(audioArrayBuffer.slice(0));
            waveform.value = computeWaveform(buf, 1200);
            // Build per-frame analysis cache aligned to timeline fps
            analysisCache.value = await AnalysisService.analyzeBufferToCache(buf, fps.value);
            // Precompute spectral centroid and 3-band energies at fixed rate, then map to per-frame
            try {
                const N = 1024;
                const featureRate = 60; // Hz
                const totalSteps = Math.max(1, Math.ceil(buf.duration * featureRate));
                const ch = buf.getChannelData(0);
                const windowed = new Float32Array(N);
                const centEnv: number[] = new Array(totalSteps);
                const lowEnv: number[] = new Array(totalSteps);
                const midEnv: number[] = new Array(totalSteps);
                const highEnv: number[] = new Array(totalSteps);
                const nyquist = buf.sampleRate / 2;
                for (let i = 0; i < totalSteps; i++) {
                    const t = i / featureRate;
                    const center = Math.floor(t * buf.sampleRate);
                    const half = Math.floor(N / 2);
                    const start = Math.max(0, center - half);
                    const end = Math.min(ch.length, start + N);
                    for (let j = 0; j < N; j++) windowed[j] = 0;
                    for (let j = start, k = 0; j < end && k < N; j++, k++) {
                        const w = 0.5 * (1 - Math.cos((2 * Math.PI * k) / Math.max(1, N - 1)));
                        windowed[k] = ch[j] * w;
                    }
                    const spec: number[] = (Meyda as any).extract('amplitudeSpectrum', windowed, { bufferSize: N, sampleRate: buf.sampleRate }) || [];
                    const centroidHz: number = (Meyda as any).extract('spectralCentroid', windowed, { sampleRate: buf.sampleRate }) || 0;
                    centEnv[i] = Math.min(1, Math.max(0, centroidHz / Math.max(1, nyquist)));
                    // 3 bands integration
                    const bins = spec.length;
                    const hzPerBin = nyquist / Math.max(1, bins);
                    let l = 0, m = 0, h = 0;
                    for (let b = 0; b < bins; b++) {
                        const f = (b + 0.5) * hzPerBin;
                        const v = spec[b] || 0;
                        if (f < 200) l += v; else if (f < 2000) m += v; else h += v;
                    }
                    // log-compress and normalize per-step
                    const lz = Math.log1p(l), mz = Math.log1p(m), hzv = Math.log1p(h);
                    const maxz = Math.max(1e-6, Math.max(lz, Math.max(mz, hzv)));
                    lowEnv[i] = lz / maxz;
                    midEnv[i] = mz / maxz;
                    highEnv[i] = hzv / maxz;
                }
                // Map to per-frame arrays
                const totalFrames = Math.max(1, Math.floor(buf.duration * Math.max(1, fps.value)));
                const cpf: number[] = new Array(totalFrames);
                const lpf: number[] = new Array(totalFrames);
                const mpf: number[] = new Array(totalFrames);
                const hpf: number[] = new Array(totalFrames);
                for (let f = 0; f < totalFrames; f++) {
                    const t = f / Math.max(1, fps.value);
                    const idx = Math.min(centEnv.length - 1, Math.floor(t * featureRate));
                    cpf[f] = centEnv[idx] || 0;
                    lpf[f] = lowEnv[idx] || 0;
                    mpf[f] = midEnv[idx] || 0;
                    hpf[f] = highEnv[idx] || 0;
                }
                bandsLowPerFrame.value = lpf;
                bandsMidPerFrame.value = mpf;
                bandsHighPerFrame.value = hpf;
            } catch {}
            // Precompute beat strength per frame (pulse based on beats list, weighted by energy)
            try {
                const cache = analysisCache.value!;
                const e = cache.energyPerFrame || [];
                const totalFrames = cache.totalFrames;
                const fpsVal = Math.max(1, fps.value);
                const beats = Array.isArray(beatTimesSec.value) ? beatTimesSec.value.slice().sort((a,b)=>a-b) : [];
                const out: number[] = new Array(totalFrames).fill(0);
                let bi = 0;
                for (let f = 0; f < totalFrames; f++) {
                    const t = f / fpsVal;
                    while (bi < beats.length && beats[bi] < t - (0.5 / fpsVal)) bi++;
                    const isBeat = (bi < beats.length) && Math.abs(beats[bi] - t) <= (0.5 / fpsVal);
                    out[f] = isBeat ? (e[f] || 1) : 0;
                }
                beatStrengthPerFrame.value = out;
            } catch {}
            // Compute simple envelope ahead of time for beat pulsing
            const signal = buf.getChannelData(0);
            const hop = Math.max(1, Math.floor(buf.sampleRate / 60));
            const win = Math.max(1, Math.floor(buf.sampleRate * 0.05)); // 50ms RMS
            const env: number[] = [];
            for (let i = 0; i < signal.length; i += hop) {
                const start = Math.max(0, i - Math.floor(win / 2));
                const end = Math.min(signal.length, start + win);
                let sum = 0;
                for (let j = start; j < end; j++) sum += signal[j] * signal[j];
                const rms = Math.sqrt(sum / (end - start + 1));
                env.push(rms);
            }
            // Normalize envelope to 0..1
            const max = env.reduce((a, b) => Math.max(a, b), 1e-6);
            for (let i = 0; i < env.length; i++) env[i] = env[i] / max;
            // save for deterministic scrubbing
            beatEnv.value = env.slice();
            // naive beat times by threshold + peak picking
            const beats: number[] = [];
            const threshold = 0.6;
            for (let i = 1; i < env.length - 1; i++) {
                if (env[i] > threshold && env[i] > env[i - 1] && env[i] >= env[i + 1]) {
                    const timeSec = i * (hop / buf.sampleRate);
                    beats.push(timeSec);
                }

            }
            beatTimesSec.value = beats;

            // Meyda analyzer for better onsets (spectralFlux + rms)
            try {
                if (sourceNode && audioCtx) {
                    // Remove spectralFlux to avoid deprecation/TypeError in Meyda on some builds
                    meydaAnalyzer = Meyda.createMeydaAnalyzer({
                        audioContext: audioCtx,
                        source: sourceNode,
                        bufferSize: 1024,
                        hopSize: 512,
                        featureExtractors: ['rms'],
                        callback: (features: any) => {
                            const rms = features.rms || 0;
                            beatEnvelope.value = Math.min(1, Math.max(0, rms));
                            // Optional: simple peak detection on RMS for beatTimes
                            if (!beatTimesSec.value) beatTimesSec.value = [];
                            const t = audioEl?.currentTime || 0;
                            const last = beatTimesSec.value[beatTimesSec.value.length - 1] || -999;
                            // naive threshold on rms
                            if (rms > 0.15 && t - last > 0.25) beatTimesSec.value.push(t);
                        }
                    });
                }
            } catch {}
        } catch {}
    }
    await nextTick();
    await startWorker();
    // Configure worker with scene + word bank
    configureWorkerScene();
};

watch(songId, async (id) => {
    if (id) {
        await initForSong(id);
    }
}, { immediate: true });

onMounted(async () => {
    document.title = 'Editor - Words On Live Kanvas - Open Culture Tech';
    await checkFfmpeg();
    // Listen for worker render-complete to draw preview exactly after frame is ready
    try {
        if (workerRef.value) {
            workerRef.value.addEventListener('message', (e: MessageEvent) => {
                const data: any = e.data;
                if (data && data.type === 'rendered') {
                    drawPreview();
                }
            });
        }
    } catch {}
});

onUnmounted(() => {
    disposeWorker();
});

const configureWorkerScene = async () => {
    const seed = String(timeline.value?.settings.seed || 'seed');
    const words = Array.isArray(song.value?.wordBank) ? (song.value!.wordBank!.map(w => String(w))) : [];
    // Build font-family chain from settings
    const primary = String(timeline.value?.settings.fontFamily || 'system-ui');
    const fallbacks = Array.isArray(timeline.value?.settings.fontFallbacks) ? (timeline.value!.settings.fontFallbacks as string[]) : [];
    const names = [primary, ...fallbacks].filter(Boolean);
    const quote = (s: string) => /[^a-zA-Z0-9-]/.test(s) ? '"' + s.replace(/"/g, '\"') + '"' : s;
    const fontFamilyChain = names.map(quote).join(', ');
    const active = computeActiveScenesForFrame(frame.value);
    // Ensure docs are loaded
    if (active.a) await ensureSceneDoc(active.a.id, active.a);
    if (active.b) await ensureSceneDoc(active.b.id, active.b);
    const aParams = { ...(sceneDocs.value[active.a.id]?.params || {}), words, fontFamilyChain };
    const payload: any = { type: 'configureMix', seed, a: { sceneType: active.a.type, params: aParams }, fontFamilyChain };
    if (active.b) {
        const bParams = { ...(sceneDocs.value[active.b.id!]?.params || {}), words, fontFamilyChain };
        payload.b = { sceneType: active.b.type, params: bParams };
    }
    const pairKey = active.a.id + '|' + (active.b?.id || '');
    lastConfiguredPair = pairKey;
    workerRef.value?.postMessage(JSON.parse(JSON.stringify(payload)));
};

const addScene = async (type: 'wordcloud' | 'imageMaskFill' | 'wordSphere') => {
    if (!timeline.value) return;
    const id = (window.crypto && typeof window.crypto.randomUUID === 'function') ? window.crypto.randomUUID() : Math.random().toString(36).slice(2);
    const last = timeline.value.scenes.at(-1);
    const start = (last ? last.startFrame + last.durationFrames : 0);
    const scene = { id, type, name: `${type} ${timeline.value.scenes.length + 1}`, startFrame: start, durationFrames: 300 } as any;
    timeline.value.scenes.push(scene);
    // create minimal per-scene document
    const doc: SceneDocumentBase = { id, type, name: scene.name, seed: String(timeline.value.settings.seed || 'seed'), params: {}, tracks: [] } as any;
    try { const saved = await TimelineService.saveScene(songId.value as string, doc); sceneDocs.value[id] = saved; } catch {}
    selectedSceneId.value = id;
    await TimelineService.save(songId.value as string, timeline.value);
    await configureWorkerScene();
};

const selectScene = async (id: string) => {
    selectedSceneId.value = id;
    await ensureSceneDoc(id, (timeline.value?.scenes || []).find(s => s.id === id) || null);
    await configureWorkerScene();
};

const onTimelineUpdated = async (t: TimelineDocument) => {
    timeline.value = t;
    await TimelineService.save(songId.value as string, t);
    await configureWorkerScene();
};

const onSceneUpdated = async (s: any) => {
    if (!timeline.value) return;
    const idx = timeline.value.scenes.findIndex(x => x.id === s.id);
    if (idx >= 0) {
        timeline.value.scenes[idx] = s;
        await TimelineService.save(songId.value as string, timeline.value);
    }
};

const onScrub = async (payload: { timeSec: number; frame: number }) => {
    try { if (audioCtx?.state === 'suspended') audioCtx.resume(); } catch {}
    if (audioEl && Number.isFinite(payload.timeSec)) {
        try { audioEl.currentTime = Math.max(0, payload.timeSec); } catch {}
    }
    frame.value = Math.max(0, payload.frame | 0);
    // Immediately update preview during scrubbing (paused or playing)
    const beat = evalBeatForFrame(frame.value);
    const wordIndex = evalWordIndexForFrame(frame.value);
    const mix = computeActiveScenesForFrame(frame.value);
    const pairKey = mix.a.id + '|' + (mix.b?.id || '');
    if (pairKey !== lastConfiguredPair) {
        await configureWorkerScene();
    }
    const wordOverride = evalWordOverrideForFrame(frame.value);
    const lowB0 = (bandsLowPerFrame.value && analysisCache.value) ? (bandsLowPerFrame.value[Math.min(analysisCache.value.totalFrames - 1, Math.max(0, frame.value))] || 0) : undefined;
    const midB0 = (bandsMidPerFrame.value && analysisCache.value) ? (bandsMidPerFrame.value[Math.min(analysisCache.value.totalFrames - 1, Math.max(0, frame.value))] || 0) : undefined;
    const highB0 = (bandsHighPerFrame.value && analysisCache.value) ? (bandsHighPerFrame.value[Math.min(analysisCache.value.totalFrames - 1, Math.max(0, frame.value))] || 0) : undefined;
    workerRef.value?.postMessage({ type: 'frame', frame: frame.value, dt: 0, beat, wordIndex, alphaA: mix.alphaA, alphaB: mix.alphaB, wordOverride, lowBand: lowB0, midBand: midB0, highBand: highB0 } as any);
    // Defer preview draw to next frame so worker has time to render
    requestAnimationFrame(() => drawPreview());
};

// Deterministic beat evaluation mapping frame -> precomputed env
const evalBeatForFrame = (f: number): number => {
    const cache = analysisCache.value;
    if (!cache) return beatEnvelope.value || 0;
    const idx = Math.min(cache.totalFrames - 1, Math.max(0, f | 0));
    return Math.min(1, Math.max(0, cache.energyPerFrame[idx] || 0));
};

// Deterministic word index per frame based on precomputed beat crossings
const evalWordIndexForFrame = (f: number): number => {
    const cache = analysisCache.value;
    if (!cache) return Math.floor(f / Math.max(1, Math.floor(fps.value / 2)));
    const idx = Math.min(cache.totalFrames - 1, Math.max(0, f | 0));
    const beatIdx = derivedBeatIndexPerFrame.value;
    if (beatIdx && beatIdx.length > idx) return beatIdx[idx] || 0;
    const derivedIdx = derivedOnsetIndexPerFrame.value;
    if (derivedIdx && derivedIdx.length > idx) return derivedIdx[idx] || 0;
    return cache.onsetIndexPerFrame[idx] || 0;
};

const drawPreview = () => {
    const src = renderCanvas.value as HTMLCanvasElement | null;
    const dst = previewCanvas.value as HTMLCanvasElement | null;
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
    try { ctx.drawImage(src, 0, 0, src.width, src.height, dx, dy, dw, dh); } catch {}
};

const genId = () => (globalThis.crypto && 'randomUUID' in globalThis.crypto) ? (globalThis.crypto as any).randomUUID() : Math.random().toString(36).slice(2);

const evalWordOverrideForFrame = (f: number): string | undefined => {
    const acts = (timeline.value?.actionTracks || []) as ActionItem[];
    if (!acts || !acts.length) return undefined;
    const hit = acts.find(a => a.frame === f && a.actionType === 'wordOverride');
    return hit?.payload?.word ? String(hit.payload.word) : undefined;
};

const ease = (t: number, type: TransitionEasing | undefined): number => {
    const x = Math.min(1, Math.max(0, t));
    switch (type) {
        case 'easeIn': return x * x;
        case 'easeOut': return 1 - (1 - x) * (1 - x);
        case 'easeInOut': return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
        default: return x;
    }
};

const computeActiveScenesForFrame = (f: number): { a: SceneRef; b?: SceneRef | null; alphaA: number; alphaB: number } => {
    const scenes = (timeline.value?.scenes || []) as SceneRef[];
    if (!scenes.length) {
        const dummy: any = { id: 'none', type: 'wordcloud', name: 'None', startFrame: 0, durationFrames: 1 };
        return { a: dummy, b: null, alphaA: 1, alphaB: 0 };
    }
    let a = scenes[0];
    for (const s of scenes) {
        if (f >= s.startFrame) a = s;
        if (f < s.startFrame) break;
    }
    const endA = a.startFrame + a.durationFrames;
    const idxA = scenes.findIndex(s => s.id === a.id);
    const b = (idxA >= 0 && idxA + 1 < scenes.length) ? scenes[idxA + 1] : null;
    const tin = Math.max(0, a.transitionInFrames || 0);
    const tout = Math.max(0, a.transitionOutFrames || 0);
    const easeType = a.transitionEasing || 'linear';
    let alphaA = 1;
    if (tin > 0 && f < a.startFrame + tin) {
        alphaA = ease((f - a.startFrame) / Math.max(1, tin), easeType);
    }
    if (tout > 0 && f >= endA - tout) {
        const t = (f - (endA - tout)) / Math.max(1, tout);
        alphaA = alphaA * (1 - ease(t, easeType));
    }
    let alphaB = 0;
    if (b) {
        const tinB = Math.max(0, b.transitionInFrames || 0);
        if (tinB > 0 && f >= b.startFrame && f < b.startFrame + tinB) {
            alphaB = ease((f - b.startFrame) / Math.max(1, tinB), b.transitionEasing || easeType);
        } else if (f >= b.startFrame) {
            alphaB = 1;
        }
    }
    return { a, b, alphaA: Math.min(1, Math.max(0, alphaA)), alphaB: Math.min(1, Math.max(0, alphaB)) };
};

const ensureSceneDoc = async (id: string, ref: SceneRef | null) => {
    if (!id) return;
    if (sceneDocs.value[id]) return;
    try {
        const doc = await TimelineService.loadScene(songId.value as string, id);
        if (doc) { sceneDocs.value[id] = doc; return; }
    } catch {}
    if (ref) {
        const doc: SceneDocumentBase = { id: ref.id, type: ref.type, name: ref.name, seed: String(timeline.value?.settings.seed || 'seed'), params: {}, tracks: [] } as any;
        try { const saved = await TimelineService.saveScene(songId.value as string, doc); sceneDocs.value[id] = saved; } catch {}
    }
};

</script>

<template>
    <div class="editor">
        <div class="editor__toolbar">
            <button @click="play" :disabled="playing">Play</button>
            <button @click="pause" :disabled="!playing">Pause</button>
            <button @click="stop" :disabled="!playing && frame === 0">Stop</button>
            <button @click="reanalyze" :disabled="!audioReady">Reanalyze</button>
            <span>Frame: {{ frame }}</span>
            <button @click="exportWithOptions" style="margin-left:8px;">Export</button>
            <button @click="exportWolk" style="margin-left:8px;">Export .wolk</button>
            <button @click="stopExport" style="margin-left:8px;" :disabled="!isRecording">Stop Export</button>
            <span v-if="ffmpegAvailable === false" class="toolbar__notice">ffmpeg not found. On macOS: install with <code>brew install ffmpeg</code>. Only WebM will be produced.</span>
        </div>
        <div class="editor__sidebar">
            <SceneList :scenes="timeline?.scenes || []" :selected-id="selectedSceneId || undefined" :current-frame="frame" :fps="fps" @select="selectScene" @add="addScene" @switchHere="({ frame }) => {
                const scenes = [...(timeline?.scenes||[])];
                if (!scenes.length) return;
                // find current scene index
                const idx = scenes.findIndex(s => frame >= s.startFrame && frame < s.startFrame + s.durationFrames);
                if (idx < 0 || idx+1 >= scenes.length) return; // nothing to switch to
                const a = { ...scenes[idx] } as any;
                const b = { ...scenes[idx+1] } as any;
                // split A at frame and start B at frame
                const leftDur = Math.max(1, frame - a.startFrame);
                const rightDur = Math.max(0, (a.startFrame + a.durationFrames) - frame);
                a.durationFrames = leftDur;
                b.startFrame = frame;
                if (rightDur <= 0) {
                    // shrink A fully before B
                }
                scenes[idx] = a;
                scenes[idx+1] = b;
                onTimelineUpdated({ ...(timeline as any), scenes } as any);
            }" />
        </div>
        <div class="editor__preview" :style="{ aspectRatio }">
            <div class="preview__canvas-wrapper">
                <canvas ref="renderCanvas" class="preview__canvas"></canvas>
                <canvas ref="previewCanvas" class="preview__canvas"></canvas>
                <canvas ref="previewOverlay" class="preview__overlay"></canvas>
            </div>
        </div>
        <div class="editor__inspector">
            <Inspector :timeline="timeline" :selected-scene="selectedScene" :scene-params="sceneParamsView" :overlay-opts="overlayOpts" @update:overlayOpts="v => overlayOpts = v" @update:timeline="onTimelineUpdated" @update:scene="onSceneUpdated" @update:sceneParams="(p:any)=> applySceneParams(p)" @resetProject="handleReset" @importWolk="handleOpenImportDialog" />
        </div>
        <div class="editor__timeline timeline-host">
            <TimelineRoot
                :fps="fps"
                :current-frame="frame"
                :duration-sec="(audioEl?.duration || 0) || undefined"
                :beats="beatTimesSec || undefined"
                :waveform="waveform || []"
                :energy-per-frame="analysisCache?.energyPerFrame"
                :bands-low-per-frame="bandsLowPerFrame || undefined"
                :bands-mid-per-frame="bandsMidPerFrame || undefined"
                :bands-high-per-frame="bandsHighPerFrame || undefined"
                :beat-strength-per-frame="beatStrengthPerFrame || undefined"
                :is-onset-per-frame="derivedOnsetPerFrame || analysisCache?.isOnsetPerFrame"
                :show-energy="overlayOpts.showEnergy"
                :show-onsets="overlayOpts.showOnsets && isSingleWordScene"
                :scenes="timeline?.scenes || []"
                :selected-scene-id="selectedSceneId || undefined"
                :action-items="(timeline?.actionTracks || []) as any"
                @scrub="(p: any) => onScrub(p)"
                @sceneUpdate="(s:any) => { const list = [...(timeline?.scenes||[])]; const i = list.findIndex(x=>x.id===s.id); if(i>=0){ list[i] = s; onTimelineUpdated({ ...(timeline as any), scenes: list } as TimelineDocument); } }"
                @sceneSelect="({id}) => selectScene(id)"
                @actionToggle="({frame}) => { const acts = Array.isArray(timeline?.actionTracks)? [...(timeline as any).actionTracks] : []; const idx = acts.findIndex((a:any)=>a.frame===frame && a.actionType==='wordOverride'); if(idx>=0){ acts.splice(idx,1);} else { acts.push({ id: genId(), frame, actionType: 'wordOverride', payload: { word: 'WOLK' } }); } onTimelineUpdated({ ...(timeline as any), actionTracks: acts } as TimelineDocument); }"
            />
        </div>
    </div>
    <div v-if="showImportDialog" class="modal-backdrop">
        <div class="modal">
            <h3>Import .wolk</h3>
            <div style="margin:8px 0;">
                <input type="file" accept=".wolk,application/zip,application/gzip" @change="handlePickImportFile" />
            </div>
            <div style="margin:8px 0; display:flex; gap:12px; align-items:center;">
                <label><input type="radio" value="copy" v-model="importStrategy" /> Copy (create new project)</label>
                <label><input type="radio" value="override" v-model="importStrategy" /> Override (replace if same ID)</label>
            </div>
            <div v-if="importError" style="color:#e66;">{{ importError }}</div>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
                <button @click="handleCancelImport" :disabled="isImporting">Cancel</button>
                <button @click="handleDoImport" :disabled="isImporting || !importFile">{{ isImporting ? 'Importing…' : 'Import' }}</button>
            </div>
        </div>
    </div>
</template>
