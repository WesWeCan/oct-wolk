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

const route = useRoute();
const songId = computed(() => (route.params.songId as string) || '');

const timeline = ref<TimelineDocument | null>(null);
const song = ref<import('@/types/song_types').Song | null>(null);
const playing = ref(false);
const frame = ref(0);
const fps = ref(60);

const previewCanvas = ref<HTMLCanvasElement | null>(null);
const previewOverlay = ref<HTMLCanvasElement | null>(null);
const workerRef = shallowRef<Worker | null>(null);
let lastTime = 0;

const targetWidth = computed(() => timeline.value?.settings.renderWidth || 1920);
const targetHeight = computed(() => timeline.value?.settings.renderHeight || 1080);
const aspectRatio = computed(() => `${targetWidth.value} / ${targetHeight.value}`);

// Scene selection
const selectedSceneId = ref<string | null>(null);
const selectedScene = computed(() => (timeline.value?.scenes || []).find(s => s.id === selectedSceneId.value) || null);
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
    if (!previewCanvas.value) return;
    const canvas = previewCanvas.value.transferControlToOffscreen();
    const worker = new Worker(new URL('../workers/renderWorker.ts', import.meta.url), { type: 'module' });
    worker.postMessage({ type: 'init', canvas, width: targetWidth.value, height: targetHeight.value }, [canvas]);
    workerRef.value = worker;
};

const tick = (now: number) => {
    if (!playing.value) return;
    const dt = lastTime ? (now - lastTime) / 1000 : 0;
    lastTime = now;
    if (audioEl && !audioEl.paused) {
        frame.value = Math.max(0, Math.floor((audioEl.currentTime || 0) * fps.value));
    } else {
        frame.value += Math.max(1, Math.round(dt * fps.value));
    }
    // Evaluate global opacity keyframe track (0..1)
    const evalGlobalOpacity = (): number => {
        const track = timeline.value?.globalOpacityTrack?.keyframes || [];
        if (!track.length) return 1;
        const f = frame.value;
        let a = track[0];
        let b = track[track.length - 1];
        for (let i = 0; i < track.length; i++) {
            if (track[i].frame <= f) a = track[i];
            if (track[i].frame >= f) { b = track[i]; break; }
        }
        if (a.frame === b.frame) return Math.min(1, Math.max(0, Number(a.value)));
        // Respect step interpolation on segment starting at a
        const interp = (a as any).interpolation;
        if (interp === 'step') return Math.min(1, Math.max(0, Number(a.value)));
        const t = (f - a.frame) / Math.max(1, (b.frame - a.frame));
        const v = (1 - t) * Number(a.value) + t * Number(b.value);
        return Math.min(1, Math.max(0, v));
    };
    const globalAlpha = evalGlobalOpacity();
    // Send frame state
    workerRef.value?.postMessage({ type: 'frame', frame: frame.value, dt, beat: beatEnvelope.value, globalAlpha });
    requestAnimationFrame(tick);
};

const play = () => {
    if (!workerRef.value) return;
    playing.value = true;
    lastTime = 0;
    if (audioEl && audioReady.value) {
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
            // Update beatEnvelope each tick based on current frame
            const framesPerSample = Math.max(1, Math.floor(fps.value / 1)); // 1 sample per frame approx
            const updateBeat = () => {
                const idx = Math.min(env.length - 1, Math.floor(frame.value / framesPerSample));
                beatEnvelope.value = env[idx] || 0;
                if (playing.value) requestAnimationFrame(updateBeat);
            };
            requestAnimationFrame(updateBeat);

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
    // Immediately update preview when paused
    if (!playing.value) {
        workerRef.value?.postMessage({ type: 'frame', frame: frame.value, dt: 0, beat: beatEnvelope.value });
    }
};

</script>

<template>
    <div class="editor">
        <div class="editor__toolbar">
            <button @click="play">Play</button>
            <button @click="pause">Pause</button>
            <span>Frame: {{ frame }}</span>
        </div>
        <div class="editor__sidebar">
            <SceneList :scenes="timeline?.scenes || []" :selected-id="selectedSceneId || undefined" @select="selectScene" @add="addScene" />
        </div>
        <div class="editor__preview" :style="{ aspectRatio }">
            <div class="preview__canvas-wrapper">
                <canvas ref="previewCanvas" class="preview__canvas"></canvas>
                <canvas ref="previewOverlay" class="preview__overlay"></canvas>
            </div>
        </div>
        <div class="editor__inspector">
            <Inspector :timeline="timeline" :selected-scene="selectedScene" @update:timeline="onTimelineUpdated" @update:scene="onSceneUpdated" />
        </div>
        <div class="editor__timeline">
            <Timeline 
                :waveform="waveform || []" 
                :fps="fps" 
                :current-frame="frame" 
                :duration-sec="(audioEl?.duration || 0) || undefined" 
                :beats="beatTimesSec || undefined"
                :spectrum="spectrum || undefined"
                :keyframes="(timeline?.globalOpacityTrack?.keyframes || []) as any"
                :selected-kf-index="selectedKfIndex"
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