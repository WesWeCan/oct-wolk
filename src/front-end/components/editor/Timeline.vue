<script setup lang="ts">
import { onMounted, ref, watch, computed, onUnmounted } from 'vue';

interface ScrubEvent { timeSec: number; frame: number; }
interface Kf { frame: number; value: number; interpolation?: 'step' | 'linear'; }
interface SceneRef { id: string; type: string; name: string; startFrame: number; durationFrames: number; transitionInFrames?: number; transitionOutFrames?: number; transitionEasing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' }
interface ActionItem { id: string; frame: number; actionType: string; payload: Record<string, any>; }

const props = defineProps<{
    waveform: number[];
    fps: number;
    currentFrame: number;
    durationSec?: number;
    beats?: number[];
    spectrum?: number[];
    keyframes?: Kf[];
    kfValueMin?: number;
    kfValueMax?: number;
    selectedKfIndex?: number | null;
    // Analysis overlays (per-frame at project fps)
    energyPerFrame?: number[];
    isOnsetPerFrame?: boolean[];
    showEnergy?: boolean;
    showOnsets?: boolean;
    // Scenes and actions
    scenes?: SceneRef[];
    selectedSceneId?: string;
    actionItems?: ActionItem[];
}>();
const emit = defineEmits<{
    (e: 'scrub', payload: ScrubEvent): void;
    (e: 'kfAdd', payload: { frame: number; value: number }): void;
    (e: 'kfUpdate', payload: { index: number; frame: number; value: number }): void;
    (e: 'kfSelect', payload: { index: number | null }): void;
    (e: 'kfDelete', payload: { index: number }): void;
    // Scenes
    (e: 'sceneSelect', payload: { id: string }): void;
    (e: 'sceneUpdate', payload: SceneRef): void;
    (e: 'actionToggle', payload: { frame: number }): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const opacityCollapsed = ref(false);

const duration = computed(() => Math.max(1, props.durationSec || 60));

// Viewport state (seconds)
const viewStartSec = ref(0);
const viewDurationSec = ref<number>(Math.min(30, duration.value));
const minWindowSec = 0.5;

watch(duration, (d) => {
    viewStartSec.value = 0;
    viewDurationSec.value = Math.min(30, d);
});

const clampView = () => {
    const d = duration.value;
    const win = Math.max(minWindowSec, Math.min(d, viewDurationSec.value));
    viewDurationSec.value = win;
    const maxStart = Math.max(0, d - win);
    viewStartSec.value = Math.max(0, Math.min(viewStartSec.value, maxStart));
};

const timeToX = (t: number, w: number) => {
    const rel = (t - viewStartSec.value) / viewDurationSec.value;
    return rel * w;
};
const xToTime = (x: number, w: number) => {
    const rel = x / Math.max(1, w);
    return viewStartSec.value + rel * viewDurationSec.value;
};

let rafId: number | null = null;

const draw = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width = canvas.clientWidth;
    // content height determines scrollable area
    const headerH = 24;
    const sceneLaneH = headerH + 36;
    const kfBodyH = opacityCollapsed.value ? 0 : 56;
    const kfLaneH = headerH + kfBodyH;
    // @ts-ignore
    const audioLaneState: 'expanded' | 'compact' | 'collapsed' = (window.__audioLaneState || 'expanded');
    const audioHeaderTop = sceneLaneH + kfLaneH;
    const audioBodyH = (audioLaneState === 'collapsed') ? 0 : (audioLaneState === 'compact' ? 120 : 220);
    const wfTop = audioHeaderTop + headerH;
    const wfHeight = audioBodyH;
    const contentH = wfTop + wfHeight + 10;
    canvas.height = contentH;
    const h = contentH;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#181818';
    ctx.fillRect(0,0,w,h);

    // Minor time grid
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    const gridSeconds = niceGridSeconds(viewDurationSec.value, w);
    const startTick = Math.ceil(viewStartSec.value / gridSeconds) * gridSeconds;
    for (let t = startTick; t < viewStartSec.value + viewDurationSec.value; t += gridSeconds) {
        const gx = timeToX(t, w);
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
    }

    // Scene lane header
    ctx.fillStyle = '#202020';
    ctx.fillRect(0, 0, w, headerH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // collapse indicator triangle
    ctx.beginPath();
    ctx.moveTo(8, headerH/2 - 4);
    ctx.lineTo(14, headerH/2);
    ctx.lineTo(8, headerH/2 + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillText('Scenes', 20, headerH / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(0, headerH + 0.5); ctx.lineTo(w, headerH + 0.5); ctx.stroke();

    // Scene blocks
    const scenes = Array.isArray(props.scenes) ? props.scenes : [];
    if (scenes.length) {
        const laneTop = headerH;
        const laneH = sceneLaneH - headerH;
        for (const s of scenes) {
            const startSec = s.startFrame / Math.max(1, props.fps);
            const endSec = (s.startFrame + s.durationFrames) / Math.max(1, props.fps);
            const x1 = timeToX(startSec, w);
            const x2 = timeToX(endSec, w);
            const sel = s.id === props.selectedSceneId;
            ctx.fillStyle = sel ? 'rgba(0,150,255,0.35)' : 'rgba(255,255,255,0.15)';
            ctx.fillRect(Math.floor(x1), laneTop + 4, Math.max(2, Math.floor(x2 - x1)), laneH - 8);
            ctx.strokeStyle = sel ? 'rgba(0,150,255,0.9)' : 'rgba(255,255,255,0.4)';
            ctx.strokeRect(Math.floor(x1) + 0.5, laneTop + 4.5, Math.max(2, Math.floor(x2 - x1)) - 1, laneH - 9);
            // Name
            ctx.fillStyle = '#fff';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(s.name || s.type, Math.floor(x1) + 6, laneTop + 6);
            // Transitions as fade triangles
            const ti = Math.max(0, s.transitionInFrames || 0) / Math.max(1, props.fps);
            const to = Math.max(0, s.transitionOutFrames || 0) / Math.max(1, props.fps);
            if (ti > 0) {
                const xi2 = timeToX(startSec + ti, w);
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.beginPath();
                ctx.moveTo(x1, laneTop + 4);
                ctx.lineTo(xi2, laneTop + 4);
                ctx.lineTo(x1, laneTop + laneH - 4);
                ctx.closePath();
                ctx.fill();
            }
            if (to > 0) {
                const xo1 = timeToX(endSec - to, w);
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.beginPath();
                ctx.moveTo(x2, laneTop + 4);
                ctx.lineTo(xo1, laneTop + 4);
                ctx.lineTo(x2, laneTop + laneH - 4);
                ctx.closePath();
                ctx.fill();
            }
            // Handles (small bars)
            ctx.fillStyle = '#ffd54f';
            ctx.fillRect(Math.floor(x1) - 2, laneTop + 4, 3, laneH - 8);
            ctx.fillRect(Math.floor(x2) - 1, laneTop + 4, 3, laneH - 8);
        }
    }

    // Scene params lane header (renamed from Opacity)
    const kfHeaderTop = sceneLaneH;
    ctx.fillStyle = '#202020';
    ctx.fillRect(0, kfHeaderTop, w, headerH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // collapse triangle
    ctx.beginPath();
    ctx.moveTo(8, kfHeaderTop + headerH/2 - 4);
    ctx.lineTo(14, kfHeaderTop + headerH/2);
    ctx.lineTo(8, kfHeaderTop + headerH/2 + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillText('Scenes', 20, kfHeaderTop + headerH / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(0, kfHeaderTop + headerH + 0.5); ctx.lineTo(w, kfHeaderTop + headerH + 0.5); ctx.stroke();

    // Scene params body background (no curve yet)
    if (kfBodyH > 0) {
        ctx.fillStyle = '#202020';
        ctx.fillRect(0, kfHeaderTop + headerH, w, kfBodyH);
    }

    // Audio lane header
    ctx.fillStyle = '#202020';
    ctx.fillRect(0, audioHeaderTop, w, headerH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Audio', 8, audioHeaderTop + headerH / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(0, audioHeaderTop + headerH + 0.5); ctx.lineTo(w, audioHeaderTop + headerH + 0.5); ctx.stroke();

    // Action markers (read-only)
    const acts = Array.isArray(props.actionItems) ? props.actionItems : [];
    if (acts.length) {
        const laneTop = headerH;
        const laneH = sceneLaneH - headerH;
        ctx.fillStyle = '#ff7043';
        for (const a of acts) {
            const tSec = a.frame / Math.max(1, props.fps);
            if (tSec < viewStartSec.value || tSec > viewStartSec.value + viewDurationSec.value) continue;
            const x = timeToX(tSec, w);
            ctx.fillRect(Math.floor(x) - 1, laneTop + 4, 2, laneH - 8);
        }
    }

    // waveform (subset for current view)
    const data = props.waveform || [];
    if (data.length > 0 && duration.value > 0) {
        const numBuckets = Math.floor(data.length / 2);
        const startBucket = Math.max(0, Math.floor((viewStartSec.value / duration.value) * numBuckets));
        const endBucket = Math.min(numBuckets, Math.ceil(((viewStartSec.value + viewDurationSec.value) / duration.value) * numBuckets));
        const visibleBuckets = Math.max(1, endBucket - startBucket);
        const stepX = w / visibleBuckets;
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < visibleBuckets; i++) {
            const idx = (startBucket + i) * 2;
            const max = data[idx] ?? 0;
            const min = (data[idx + 1] ?? -max);
            const x = i * stepX;
            const yMax = wfTop + wfHeight * (0.5 - max * 0.4);
            const yMin = wfTop + wfHeight * (0.5 - min * 0.4);
            ctx.moveTo(x, yMax);
            ctx.lineTo(x, yMin);
        }
        ctx.stroke();
    }

    // spectrum overlay (bottom)
    if (wfHeight > 0 && Array.isArray(props.spectrum) && props.spectrum.length) {
        const bars = Math.min(96, props.spectrum.length);
        const barW = Math.max(1, Math.floor(w / bars));
        const maxVal = props.spectrum.reduce((a, b) => Math.max(a, b), 1e-6);
        for (let i = 0; i < bars; i++) {
            const v = props.spectrum[i] / maxVal; // 0..1
            const bh = Math.max(1, Math.floor(v * (wfHeight * 0.25)));
            const x = i * barW;
            const y = wfTop + wfHeight - bh;
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(x, y, Math.max(1, barW - 1), bh);
        }
    }

    // Energy overlay (per-frame normalized 0..1)
    if (wfHeight > 0 && props.showEnergy && Array.isArray(props.energyPerFrame)) {
        const fps = Math.max(1, props.fps);
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        const startF = Math.max(0, Math.floor(viewStartSec.value * fps));
        const endF = Math.max(startF + 1, Math.floor((viewStartSec.value + viewDurationSec.value) * fps));
        for (let f = startF; f <= endF; f++) {
            const tSec = f / fps;
            const x = timeToX(tSec, w);
            const e = Math.min(1, Math.max(0, props.energyPerFrame[f] || 0));
            const y = wfTop + (1 - e) * wfHeight;
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
    }
    // Onset markers (where SingleWord word changes)
    if (wfHeight > 0 && props.showOnsets && Array.isArray(props.isOnsetPerFrame)) {
        const fps = Math.max(1, props.fps);
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.9)';
        for (let f = 0; f < (props.isOnsetPerFrame.length || 0); f++) {
            if (!props.isOnsetPerFrame[f]) continue;
            const tSec = f / fps;
            if (tSec < viewStartSec.value || tSec > viewStartSec.value + viewDurationSec.value) continue;
            const x = timeToX(tSec, w);
            ctx.beginPath();
            ctx.moveTo(x, wfTop);
            ctx.lineTo(x, wfTop + wfHeight);
            ctx.stroke();
        }
    }

    // playhead
    ctx.strokeStyle = '#ff3b30';
    const curTime = Math.max(0, Math.min(duration.value, props.currentFrame / props.fps));
    const playheadX = timeToX(curTime, w);
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, h);
    ctx.stroke();
};

const requestDraw = () => {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
        rafId = null;
        draw();
    });
};

// Interaction
let isPointerDown = false;
let isPanning = false;
let isScrubbing = false;
let isEditingKf = false;
let draggingKfIndex: number | null = null;
let startX = 0;
let startViewStart = 0;

// Scene drag state
type DragMode = 'none' | 'moveScene' | 'resizeLeft' | 'resizeRight' | 'adjustIn' | 'adjustOut';
let dragMode: DragMode = 'none';
let dragSceneIndex: number = -1;
let dragMoveOffsetFrames: number = 0;

const setCursor = (cursor: string) => { const el = canvasRef.value; if (el) el.style.cursor = cursor; };

const onPointerDown = (e: PointerEvent) => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isPointerDown = true;
    startX = e.clientX;
    startViewStart = viewStartSec.value;
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const headerH = 24;
    const sceneLaneH = headerH + 36;
    const kfBodyH = opacityCollapsed.value ? 0 : 56;
    const kfLaneH = headerH + kfBodyH;
    const audioHeaderTop = sceneLaneH + kfLaneH;
    // Toggle collapse (by clicking left area of header)
    if (localX < 20) {
        if (localY >= 0 && localY <= headerH) { requestDraw(); return; }
        if (localY >= sceneLaneH && localY <= sceneLaneH + headerH) { opacityCollapsed.value = !opacityCollapsed.value; requestDraw(); return; }
    }
    // Scene lane interactions
    if (localY >= headerH && localY <= sceneLaneH) {
        const scenes = Array.isArray(props.scenes) ? props.scenes : [];
        const fps = Math.max(1, props.fps);
        const t = xToTime(localX, canvas.clientWidth);
        const fAt = Math.max(0, Math.floor(t * fps));
        let hitIdx = -1;
        for (let i = 0; i < scenes.length; i++) {
            const s = scenes[i];
            if (fAt >= s.startFrame && fAt <= s.startFrame + s.durationFrames) { hitIdx = i; break; }
        }
        if (hitIdx >= 0) {
            const s = scenes[hitIdx];
            emit('sceneSelect', { id: s.id });
            dragSceneIndex = hitIdx;
            const startSec = s.startFrame / fps;
            const endSec = (s.startFrame + s.durationFrames) / fps;
            const x1 = timeToX(startSec, canvas.clientWidth);
            const x2 = timeToX(endSec, canvas.clientWidth);
            const nearLeft = Math.abs(localX - x1) <= 6;
            const nearRight = Math.abs(localX - x2) <= 6;
            if (nearLeft) { dragMode = e.altKey ? 'adjustIn' : 'resizeLeft'; setCursor('ew-resize'); return; }
            if (nearRight) { dragMode = e.altKey ? 'adjustOut' : 'resizeRight'; setCursor('ew-resize'); return; }
            dragMode = 'moveScene';
            dragMoveOffsetFrames = fAt - s.startFrame;
            setCursor('grabbing');
            return;
        }
    }
    // Keyframe lane interaction disabled for now (placeholder)
    // Panning or scrubbing
    isEditingKf = false;
    isPanning = e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
    isScrubbing = !isPanning;
    if (isScrubbing) {
        const t = xToTime(localX, canvas.clientWidth);
        const clamped = Math.max(0, Math.min(duration.value, t));
        emit('scrub', { timeSec: clamped, frame: Math.floor(clamped * props.fps) });
        setCursor('ew-resize');
    }
};

const onPointerMove = (e: PointerEvent) => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const headerH = 24;
    const sceneLaneH = headerH + 36;
    if (!isPointerDown) {
        // hover cursors for scene edges
        if (localY >= headerH && localY <= sceneLaneH) {
            const scenes = Array.isArray(props.scenes) ? props.scenes : [];
            const fps = Math.max(1, props.fps);
            const t = xToTime(localX, canvas.clientWidth);
            const fAt = Math.max(0, Math.floor(t * fps));
            let hitIdx = -1;
            for (let i = 0; i < scenes.length; i++) {
                const s = scenes[i];
                if (fAt >= s.startFrame && fAt <= s.startFrame + s.durationFrames) { hitIdx = i; break; }
            }
            if (hitIdx >= 0) {
                const s = scenes[hitIdx];
                const startSec = s.startFrame / fps;
                const endSec = (s.startFrame + s.durationFrames) / fps;
                const x1 = timeToX(startSec, canvas.clientWidth);
                const x2 = timeToX(endSec, canvas.clientWidth);
                const nearLeft = Math.abs(localX - x1) <= 6;
                const nearRight = Math.abs(localX - x2) <= 6;
                setCursor(nearLeft || nearRight ? 'ew-resize' : 'grab');
                return;
            }
        }
        setCursor('default');
        return;
    }
    if (dragMode !== 'none') {
        const fps = Math.max(1, props.fps);
        const frameAtX = Math.max(0, Math.floor(xToTime(localX, canvas.clientWidth) * fps));
        const scenes = Array.isArray(props.scenes) ? props.scenes : [];
        if (dragSceneIndex >= 0 && dragSceneIndex < scenes.length) {
            const s = { ...scenes[dragSceneIndex] } as SceneRef;
            if (dragMode === 'moveScene') {
                s.startFrame = Math.max(0, frameAtX - dragMoveOffsetFrames);
            } else if (dragMode === 'resizeLeft') {
                const newStart = Math.min(frameAtX, s.startFrame + s.durationFrames - 1);
                const newDur = Math.max(1, (s.startFrame + s.durationFrames) - newStart);
                s.startFrame = Math.max(0, newStart);
                s.durationFrames = newDur;
            } else if (dragMode === 'resizeRight') {
                const newDur = Math.max(1, frameAtX - s.startFrame);
                s.durationFrames = newDur;
            } else if (dragMode === 'adjustIn') {
                const maxTi = Math.max(0, s.durationFrames - Math.max(0, s.transitionOutFrames || 0));
                const newTi = Math.max(0, Math.min(maxTi, frameAtX - s.startFrame));
                s.transitionInFrames = newTi;
            } else if (dragMode === 'adjustOut') {
                const endFrame = s.startFrame + s.durationFrames;
                const maxTo = Math.max(0, s.durationFrames - Math.max(0, s.transitionInFrames || 0));
                const newTo = Math.max(0, Math.min(maxTo, endFrame - frameAtX));
                s.transitionOutFrames = newTo;
            }
            emit('sceneUpdate', s);
        }
        requestDraw();
        return;
    }
    if (isPanning) {
        const dx = e.clientX - startX;
        const secPerPx = viewDurationSec.value / Math.max(1, canvas.clientWidth);
        viewStartSec.value = startViewStart - dx * secPerPx;
        clampView();
        requestDraw();
        setCursor('grabbing');
    } else if (isScrubbing) {
        const t = xToTime(localX, canvas.clientWidth);
        const clamped = Math.max(0, Math.min(duration.value, t));
        emit('scrub', { timeSec: clamped, frame: Math.floor(clamped * props.fps) });
        setCursor('ew-resize');
    }
};

const endPointer = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    isPanning = false;
    isScrubbing = false;
    isEditingKf = false;
    dragMode = 'none';
    dragSceneIndex = -1;
    draggingKfIndex = null;
    const canvas = canvasRef.value;
    if (canvas) {
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
        setCursor('default');
    }
};

const onWheel = (e: WheelEvent) => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    e.preventDefault();
    const w = Math.max(1, canvas.clientWidth);
    const rect = canvas.getBoundingClientRect();
    const cursorX = (e.clientX - rect.left);
    const cursorTime = xToTime(cursorX, w);
    if (e.ctrlKey || e.metaKey) {
        // Zoom around cursor
        const factor = Math.exp(e.deltaY * 0.0015);
        const newWin = Math.max(minWindowSec, Math.min(duration.value, viewDurationSec.value * factor));
        // keep cursorTime stationary
        const rel = (cursorTime - viewStartSec.value) / Math.max(1e-6, viewDurationSec.value);
        viewStartSec.value = cursorTime - rel * newWin;
        viewDurationSec.value = newWin;
        clampView();
        requestDraw();
    } else {
        // Horizontal scroll (prefer deltaX, fallback deltaY)
        const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
        const secDelta = delta * (viewDurationSec.value / w);
        viewStartSec.value += secDelta;
        clampView();
        requestDraw();
    }
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    requestDraw();
    const el = canvasRef.value;
    if (el) {
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', endPointer);
        el.addEventListener('pointercancel', endPointer);
        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.key === 'Backspace' || e.key === 'Delete') && typeof props.selectedKfIndex === 'number' && props.selectedKfIndex >= 0) {
                emit('kfDelete', { index: props.selectedKfIndex });
            }
        });
    }
    // Redraw on resize
    try {
        resizeObserver = new ResizeObserver(() => requestDraw());
        if (el) resizeObserver.observe(el);
    } catch {}
});

onUnmounted(() => {
    const el = canvasRef.value;
    if (el) {
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', endPointer);
        el.removeEventListener('pointercancel', endPointer);
        el.removeEventListener('wheel', onWheel as any);
    }
    if (resizeObserver) {
        try { resizeObserver.disconnect(); } catch {}
        resizeObserver = null;
    }
});

// Redraw on prop changes or view changes
watch(() => [props.waveform, props.currentFrame, props.fps, props.durationSec, props.beats, props.spectrum, props.keyframes, props.selectedKfIndex, props.kfValueMin, props.kfValueMax], () => requestDraw());
watch([viewStartSec, viewDurationSec], () => requestDraw());

// Auto-follow playhead when it nears the right edge (>80% of viewport)
watch(() => props.currentFrame, () => {
    const d = duration.value;
    if (!d) return;
    const curTime = Math.max(0, Math.min(d, props.currentFrame / Math.max(1, props.fps)));
    const rightEdge = viewStartSec.value + viewDurationSec.value;
    const leftEdge = viewStartSec.value;
    const threshold = viewStartSec.value + viewDurationSec.value * 0.8;
    if (curTime > threshold) {
        // Scroll so playhead sits around 60% of the window
        const desiredLeft = Math.max(0, Math.min(d - viewDurationSec.value, curTime - viewDurationSec.value * 0.6));
        if (Math.abs(desiredLeft - viewStartSec.value) > 1e-3) {
            viewStartSec.value = desiredLeft;
        }
    } else if (curTime < leftEdge) {
        // If user scrubbed behind the view, center it again
        viewStartSec.value = Math.max(0, curTime - viewDurationSec.value * 0.4);
    }
});

function niceGridSeconds(windowSec: number, widthPx: number): number {
    // target ~100px between grid lines
    const targetPx = 100;
    const secondsPerPx = windowSec / Math.max(1, widthPx);
    const raw = targetPx * secondsPerPx;
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    for (const s of steps) {
        if (s >= raw) return s;
    }
    return steps[steps.length - 1];
}

</script>

<template>
    <div style="width:100%; height:100%; overflow:auto">
        <canvas ref="canvasRef" style="width:100%; height:100%; touch-action: none" tabindex="0"></canvas>
    </div>
    
</template>


