<script setup lang="ts">
import { onMounted, ref, watch, computed, onUnmounted } from 'vue';

interface ScrubEvent { timeSec: number; frame: number; }
interface Kf { frame: number; value: number; interpolation?: 'step' | 'linear'; }

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
}>();
const emit = defineEmits<{ (e: 'scrub', payload: ScrubEvent): void; (e: 'kfAdd', payload: { frame: number; value: number }): void; (e: 'kfUpdate', payload: { index: number; frame: number; value: number }): void; (e: 'kfSelect', payload: { index: number | null }): void; (e: 'kfDelete', payload: { index: number }): void }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

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
    const h = canvas.height = canvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#181818';
    ctx.fillRect(0,0,w,h);

    // Keyframe lane layout (top)
    const kfLaneH = 80;
    const wfTop = kfLaneH;
    const wfHeight = Math.max(1, h - kfLaneH);

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

    // Keyframe grid and points
    {
        // Lane background
        ctx.fillStyle = '#202020';
        ctx.fillRect(0, 0, w, kfLaneH);
        // Draw keyframes
        const kfMin = Number.isFinite(props.kfValueMin) ? Number(props.kfValueMin) : 0;
        const kfMax = Number.isFinite(props.kfValueMax) ? Number(props.kfValueMax) : 1;
        const norm01 = (v: number) => Math.min(1, Math.max(0, (v - kfMin) / Math.max(1e-9, (kfMax - kfMin))));
        const keyframes = Array.isArray(props.keyframes) ? props.keyframes : [];
        const toXY = (kf: Kf) => {
            const tSec = kf.frame / Math.max(1, props.fps);
            const x = timeToX(tSec, w);
            const y = Math.round((1 - norm01(kf.value)) * (kfLaneH - 10)) + 5;
            return { x, y };
        };
        if (keyframes.length) {
            ctx.strokeStyle = 'rgba(0, 230, 118, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < keyframes.length; i++) {
                const p = toXY(keyframes[i]);
                if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
            for (let i = 0; i < keyframes.length; i++) {
                const p = toXY(keyframes[i]);
                const selected = (i === (props.selectedKfIndex ?? -1));
                ctx.fillStyle = selected ? '#ff3b30' : '#00e676';
                ctx.beginPath();
                ctx.arc(p.x, p.y, selected ? 5 : 4, 0, Math.PI * 2);
                ctx.fill();
            }
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
    if (Array.isArray(props.spectrum) && props.spectrum.length) {
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

    // beat markers (in-view)
    const beats = props.beats || [];
    if (beats.length) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        for (const t of beats) {
            if (t < viewStartSec.value || t > viewStartSec.value + viewDurationSec.value) continue;
            const x = timeToX(t, w);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
    }

    // playhead
    ctx.strokeStyle = '#ff3b30';
    const totalFrames = Math.max(1, Math.floor(duration.value * props.fps));
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
    const kfLaneH = 80;
    if (localY <= kfLaneH && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        isEditingKf = true;
        isPanning = false;
        isScrubbing = false;
        const kfMin = Number.isFinite(props.kfValueMin) ? Number(props.kfValueMin) : 0;
        const kfMax = Number.isFinite(props.kfValueMax) ? Number(props.kfValueMax) : 1;
        const keyframes = Array.isArray(props.keyframes) ? props.keyframes : [];
        const fps = Math.max(1, props.fps);
        const frameAtX = Math.floor(xToTime(localX, canvas.clientWidth) * fps);
        const radius = 8;
        let hit: number | null = null;
        for (let i = 0; i < keyframes.length; i++) {
            const k = keyframes[i];
            const x = timeToX(k.frame / fps, canvas.clientWidth);
            const vNorm = Math.min(1, Math.max(0, (k.value - kfMin) / Math.max(1e-9, (kfMax - kfMin))));
            const y = Math.round((1 - vNorm) * (kfLaneH - 10)) + 5;
            const dx = Math.abs(x - localX);
            const dy = Math.abs(y - localY);
            if (dx * dx + dy * dy <= radius * radius) { hit = i; break; }
        }
        if (hit != null) {
            draggingKfIndex = hit;
            emit('kfSelect', { index: hit });
        } else {
            const vNorm = 1 - Math.min(1, Math.max(0, (localY - 5) / (kfLaneH - 10)));
            const value = kfMin + vNorm * (kfMax - kfMin);
            emit('kfAdd', { frame: Math.max(0, frameAtX), value });
        }
        return;
    }
    // Hold Space/Ctrl/Meta or non-left button to pan; otherwise scrub
    isEditingKf = false;
    isPanning = e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
    isScrubbing = !isPanning;
    if (isScrubbing) {
        const t = xToTime(localX, canvas.clientWidth);
        const clamped = Math.max(0, Math.min(duration.value, t));
        emit('scrub', { timeSec: clamped, frame: Math.floor(clamped * props.fps) });
    }
};

const onPointerMove = (e: PointerEvent) => {
    if (!isPointerDown) return;
    const canvas = canvasRef.value;
    if (!canvas) return;
    if (isEditingKf) {
        const rect = canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const kfLaneH = 80;
        const fps = Math.max(1, props.fps);
        const frameAtX = Math.max(0, Math.floor(xToTime(localX, canvas.clientWidth) * fps));
        const kfMin = Number.isFinite(props.kfValueMin) ? Number(props.kfValueMin) : 0;
        const kfMax = Number.isFinite(props.kfValueMax) ? Number(props.kfValueMax) : 1;
        const vNorm = 1 - Math.min(1, Math.max(0, (localY - 5) / (kfLaneH - 10)));
        const value = kfMin + vNorm * (kfMax - kfMin);
        if (draggingKfIndex != null) {
            emit('kfUpdate', { index: draggingKfIndex, frame: frameAtX, value });
        }
        requestDraw();
    } else if (isPanning) {
        const dx = e.clientX - startX;
        const secPerPx = viewDurationSec.value / Math.max(1, canvas.clientWidth);
        viewStartSec.value = startViewStart - dx * secPerPx;
        clampView();
        requestDraw();
    } else if (isScrubbing) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const t = xToTime(x, canvas.clientWidth);
        const clamped = Math.max(0, Math.min(duration.value, t));
        emit('scrub', { timeSec: clamped, frame: Math.floor(clamped * props.fps) });
    }
};

const endPointer = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    isPanning = false;
    isScrubbing = false;
    isEditingKf = false;
    draggingKfIndex = null;
    const canvas = canvasRef.value;
    if (canvas) {
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
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
    <div style="width:100%; height:100%">
        <canvas ref="canvasRef" style="width:100%; height:100%; touch-action: none" tabindex="0"></canvas>
    </div>
    
</template>


