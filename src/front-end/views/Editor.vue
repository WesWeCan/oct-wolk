<script setup lang="ts">
import { onMounted, ref, shallowRef, computed, nextTick, watch, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { TimelineService } from '@/front-end/services/TimelineService';
import { SongService } from '@/front-end/services/SongService';
import type { TimelineDocument } from '@/types/timeline_types';
import SceneList from '@/front-end/components/editor/SceneList.vue';
import Inspector from '@/front-end/components/editor/Inspector.vue';
import Timeline from '@/front-end/components/editor/Timeline.vue';
import axios from 'axios';
import Meyda from 'meyda';
import { AnalysisService } from '@/front-end/services/AnalysisService';
import type { AnalysisCache } from '@/types/analysis_types';

const route = useRoute();
const songId = computed(() => (route.params.songId as string) || '');

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
const spectrum = ref<number[] | null>(null);
const analysisCache = ref<AnalysisCache | null>(null);
const overlayOpts = ref<{ showEnergy: boolean; showOnsets: boolean; showBeats?: boolean }>({ showEnergy: true, showOnsets: true, showBeats: false });
// Precomputed beat envelope samples (~60Hz) for deterministic scrubbing
const beatEnv = ref<number[] | null>(null);

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
    const globalAlpha = evalGlobalOpacityForFrame(frame.value);
    const beat = evalBeatForFrame(frame.value);
    const wordIndex = evalWordIndexForFrame(frame.value);
    // Send frame state
    workerRef.value?.postMessage({ type: 'frame', frame: frame.value, dt, beat, globalAlpha, wordIndex });
    drawPreview();
    requestAnimationFrame(tick);
};

// Evaluate global opacity keyframe track (0..1) for a specific frame
const evalGlobalOpacityForFrame = (f: number): number => {
    const track = timeline.value?.globalOpacityTrack?.keyframes || [];
    if (!track.length) return 1;
    let a = track[0];
    let b = track[track.length - 1];
    for (let i = 0; i < track.length; i++) {
        if (track[i].frame <= f) a = track[i];
        if (track[i].frame >= f) { b = track[i]; break; }
    }
    if ((a as any).frame === (b as any).frame) return Math.min(1, Math.max(0, Number((a as any).value)));
    const interp = (a as any).interpolation;
    if (interp === 'step') return Math.min(1, Math.max(0, Number((a as any).value)));
    const t = (f - (a as any).frame) / Math.max(1, ((b as any).frame - (a as any).frame));
    const v = (1 - t) * Number((a as any).value) + t * Number((b as any).value);
    return Math.min(1, Math.max(0, v));
};

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
    const globalAlpha0 = evalGlobalOpacityForFrame(0);
    const beat0 = evalBeatForFrame(0);
    const wordIndex0 = evalWordIndexForFrame(0);
    workerRef.value?.postMessage({ type: 'frame', frame: 0, dt: 0, beat: beat0, globalAlpha: globalAlpha0, wordIndex: wordIndex0 });
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
        const ga = evalGlobalOpacityForFrame(frame.value);
        const be = evalBeatForFrame(frame.value);
        const wi = evalWordIndexForFrame(frame.value);
        workerRef.value?.postMessage({ type: 'frame', frame: frame.value, dt: 0, beat: be, globalAlpha: ga, wordIndex: wi });
        requestAnimationFrame(() => drawPreview());
    } catch {}
};

const exportWebM = async () => {
    if (!renderCanvas.value) return;
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
        if (audioEl) {
            const audioStream = (audioEl as any).captureStream ? (audioEl as any).captureStream() : null;
            if (audioStream) {
                const audioTracks = audioStream.getAudioTracks();
                for (const t of audioTracks) stream.addTrack(t);
            }
        }
    } catch {}
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream as MediaStream, { mimeType: 'video/webm;codecs=vp9,opus' });
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
                        featureExtractors: ['rms', 'amplitudeSpectrum'],
                        callback: (features: any) => {
                            const rms = features.rms || 0;
                            const amp: number[] = Array.isArray(features.amplitudeSpectrum) ? features.amplitudeSpectrum : [];
                            beatEnvelope.value = Math.min(1, Math.max(0, rms));
                            // Optional: simple peak detection on RMS for beatTimes
                            if (!beatTimesSec.value) beatTimesSec.value = [];
                            const t = audioEl?.currentTime || 0;
                            const last = beatTimesSec.value[beatTimesSec.value.length - 1] || -999;
                            // naive threshold on rms
                            if (rms > 0.15 && t - last > 0.25) beatTimesSec.value.push(t);
                            if (amp && amp.length) {
                                // Downsample spectrum to ~96 bars for UI
                                const bars = 96;
                                const binSize = Math.max(1, Math.floor(amp.length / bars));
                                const ds: number[] = [];
                                for (let i = 0; i < bars; i++) {
                                    let sum = 0;
                                    let count = 0;
                                    for (let j = 0; j < binSize; j++) {
                                        const idx = i * binSize + j;
                                        if (idx < amp.length) { sum += amp[idx]; count++; }
                                    }
                                    ds.push(count ? sum / count : 0);
                                }
                                spectrum.value = ds;
                            }
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

const configureWorkerScene = () => {
    const seed = String(timeline.value?.settings.seed || 'seed');
    const words = Array.isArray(song.value?.wordBank) ? (song.value!.wordBank!.map(w => String(w))) : [];
    const sceneType = (selectedScene.value?.type || 'wordcloud') as any;
    // Build font-family chain from settings
    const primary = String(timeline.value?.settings.fontFamily || 'system-ui');
    const fallbacks = Array.isArray(timeline.value?.settings.fontFallbacks) ? (timeline.value!.settings.fontFallbacks as string[]) : [];
    const names = [primary, ...fallbacks].filter(Boolean);
    const quote = (s: string) => /[^a-zA-Z0-9-]/.test(s) ? '"' + s.replace(/"/g, '\\"') + '"' : s;
    const fontFamilyChain = names.map(quote).join(', ');
    const payload = { type: 'configure', seed, words, sceneType, fontFamilyChain } as any;
    // Deep-clone to strip Vue proxies before structured clone
    const cloned = JSON.parse(JSON.stringify(payload));
    workerRef.value?.postMessage(cloned);
};

const addScene = async (type: 'wordcloud' | 'imageMaskFill' | 'wordSphere') => {
    if (!timeline.value) return;
    const id = (window.crypto && typeof window.crypto.randomUUID === 'function') ? window.crypto.randomUUID() : Math.random().toString(36).slice(2);
    const last = timeline.value.scenes.at(-1);
    const start = (last ? last.startFrame + last.durationFrames : 0);
    const scene = { id, type, name: `${type} ${timeline.value.scenes.length + 1}`, startFrame: start, durationFrames: 300 } as any;
    timeline.value.scenes.push(scene);
    selectedSceneId.value = id;
    await TimelineService.save(songId.value as string, timeline.value);
    configureWorkerScene();
};

const selectScene = (id: string) => {
    selectedSceneId.value = id;
    configureWorkerScene();
};

const onTimelineUpdated = async (t: TimelineDocument) => {
    timeline.value = t;
    await TimelineService.save(songId.value as string, t);
    configureWorkerScene();
};

const onSceneUpdated = async (s: any) => {
    if (!timeline.value) return;
    const idx = timeline.value.scenes.findIndex(x => x.id === s.id);
    if (idx >= 0) {
        timeline.value.scenes[idx] = s;
        await TimelineService.save(songId.value as string, timeline.value);
    }
};

const onScrub = (payload: { timeSec: number; frame: number }) => {
    try { if (audioCtx?.state === 'suspended') audioCtx.resume(); } catch {}
    if (audioEl && Number.isFinite(payload.timeSec)) {
        try { audioEl.currentTime = Math.max(0, payload.timeSec); } catch {}
    }
    frame.value = Math.max(0, payload.frame | 0);
    // Immediately update preview during scrubbing (paused or playing)
    const globalAlpha = evalGlobalOpacityForFrame(frame.value);
    const beat = evalBeatForFrame(frame.value);
    const wordIndex = evalWordIndexForFrame(frame.value);
    workerRef.value?.postMessage({ type: 'frame', frame: frame.value, dt: 0, beat, globalAlpha, wordIndex });
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

</script>

<template>
    <div class="editor">
        <div class="editor__toolbar">
            <button @click="play" :disabled="playing">Play</button>
            <button @click="pause" :disabled="!playing">Pause</button>
            <button @click="stop" :disabled="!playing && frame === 0">Stop</button>
            <button @click="reanalyze" :disabled="!audioReady">Reanalyze</button>
            <span>Frame: {{ frame }}</span>
            <button @click="exportWebM" style="margin-left:8px;">Export WebM</button>
            <button @click="exportWolk" style="margin-left:8px;">Export .wolk</button>
            <button @click="stopExport" style="margin-left:8px;" :disabled="!isRecording">Stop Export</button>
            <span v-if="ffmpegAvailable === false" class="toolbar__notice">ffmpeg not found. On macOS: install with <code>brew install ffmpeg</code>. Only WebM will be produced.</span>
        </div>
        <div class="editor__sidebar">
            <SceneList :scenes="timeline?.scenes || []" :selected-id="selectedSceneId || undefined" @select="selectScene" @add="addScene" />
        </div>
        <div class="editor__preview" :style="{ aspectRatio }">
            <div class="preview__canvas-wrapper">
                <canvas ref="renderCanvas" class="preview__canvas"></canvas>
                <canvas ref="previewCanvas" class="preview__canvas"></canvas>
                <canvas ref="previewOverlay" class="preview__overlay"></canvas>
            </div>
        </div>
        <div class="editor__inspector">
            <Inspector :timeline="timeline" :selected-scene="selectedScene" :overlay-opts="overlayOpts" @update:overlayOpts="v => overlayOpts = v" @update:timeline="onTimelineUpdated" @update:scene="onSceneUpdated" />
        </div>
        <div class="editor__timeline">
            <Timeline 
                :waveform="waveform || []" 
                :fps="fps" 
                :current-frame="frame" 
                :duration-sec="(audioEl?.duration || 0) || undefined" 
                :beats="undefined"
                :spectrum="spectrum || undefined"
                :keyframes="(timeline?.globalOpacityTrack?.keyframes || []) as any"
                :selected-kf-index="selectedKfIndex"
                :energy-per-frame="analysisCache?.energyPerFrame"
                :is-onset-per-frame="analysisCache?.isOnsetPerFrame"
                :show-energy="overlayOpts.showEnergy"
                :show-onsets="overlayOpts.showOnsets && isSingleWordScene"
                @scrub="(p: any) => onScrub(p)"
                @kfAdd="({ frame, value }) => {
                    const t = timeline?.globalOpacityTrack?.keyframes ? [...timeline!.globalOpacityTrack!.keyframes] : [];
                    t.push({ frame, value, interpolation: 'linear' } as any);
                    t.sort((a:any,b:any) => a.frame - b.frame);
                    const updated = { ...(timeline as any), globalOpacityTrack: { propertyPath: 'global.opacity', keyframes: t } } as TimelineDocument;
                    onTimelineUpdated(updated);
                    selectedKfIndex = t.findIndex((k:any) => k.frame === frame && k.value === value);
                }"
                @kfUpdate="({ index, frame, value }) => {
                    const t = timeline?.globalOpacityTrack?.keyframes ? [...timeline!.globalOpacityTrack!.keyframes] : [];
                    if (index >= 0 && index < t.length) { t[index] = { ...t[index], frame, value } as any; t.sort((a:any,b:any) => a.frame - b.frame); }
                    const updated = { ...(timeline as any), globalOpacityTrack: { propertyPath: 'global.opacity', keyframes: t } } as TimelineDocument;
                    onTimelineUpdated(updated);
                    selectedKfIndex = Math.min(index, t.length - 1);
                }"
                @kfSelect="({ index }) => { selectedKfIndex = (index ?? null); }"
                @kfDelete="({ index }) => {
                    const t = timeline?.globalOpacityTrack?.keyframes ? [...timeline!.globalOpacityTrack!.keyframes] : [];
                    if (index >= 0 && index < t.length) { t.splice(index, 1); }
                    const updated = { ...(timeline as any), globalOpacityTrack: { propertyPath: 'global.opacity', keyframes: t } } as TimelineDocument;
                    onTimelineUpdated(updated);
                    selectedKfIndex = null;
                }"
            />
        </div>
    </div>
    
</template>