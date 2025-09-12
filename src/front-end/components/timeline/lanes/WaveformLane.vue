<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec: number; fps: number };
    fps: number;
    waveform: number[];
    energyPerFrame?: number[];
    isOnsetPerFrame?: boolean[];
    showEnergy?: boolean;
    showOnsets?: boolean;
}>();

const emit = defineEmits<{
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let raf: number | null = null;
let isPointerDown = false;

const draw = () => {
    const canvas = canvasRef.value; if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const wCss = canvas.clientWidth; const hCss = canvas.clientHeight;
    canvas.width = Math.floor(wCss * dpr); canvas.height = Math.floor(hCss * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, wCss, hCss);
    ctx.fillStyle = '#181818'; ctx.fillRect(0, 0, wCss, hCss);
    const data = props.waveform || [];
    if (data.length && props.viewport.totalSec > 0) {
        const totalBuckets = Math.floor(data.length / 2);
        const startBucket = Math.max(0, Math.floor((props.viewport.startSec / props.viewport.totalSec) * totalBuckets));
        const endBucket = Math.min(totalBuckets, Math.ceil(((props.viewport.startSec + props.viewport.durationSec) / props.viewport.totalSec) * totalBuckets));
        const visible = Math.max(1, endBucket - startBucket);
        const stepX = wCss / visible;
        ctx.strokeStyle = '#00e676'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < visible; i++) {
            const idx = (startBucket + i) * 2;
            const max = data[idx] ?? 0;
            const min = (data[idx + 1] ?? -max);
            const x = i * stepX;
            const yMax = hCss * (0.5 - max * 0.45);
            const yMin = hCss * (0.5 - min * 0.45);
            ctx.moveTo(x, yMax);
            ctx.lineTo(x, yMin);
        }
        ctx.stroke();
    }
    // overlays
    if (props.showEnergy && Array.isArray(props.energyPerFrame)) {
        const fps = Math.max(1, props.fps);
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); let started = false;
        const startF = Math.max(0, Math.floor(props.viewport.startSec * fps));
        const endF = Math.max(startF + 1, Math.floor((props.viewport.startSec + props.viewport.durationSec) * fps));
        for (let f = startF; f <= endF; f++) {
            const tSec = f / fps;
            const x = (tSec - props.viewport.startSec) / props.viewport.durationSec * wCss;
            const e = Math.min(1, Math.max(0, props.energyPerFrame[f] || 0));
            const y = (1 - e) * hCss;
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
    }
    if (props.showOnsets && Array.isArray(props.isOnsetPerFrame)) {
        const fps = Math.max(1, props.fps);
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.9)';
        for (let f = 0; f < (props.isOnsetPerFrame.length || 0); f++) {
            if (!props.isOnsetPerFrame[f]) continue;
            const tSec = f / fps;
            if (tSec < props.viewport.startSec || tSec > props.viewport.startSec + props.viewport.durationSec) continue;
            const x = (tSec - props.viewport.startSec) / props.viewport.durationSec * wCss;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hCss); ctx.stroke();
        }
    }
};

const requestDraw = () => { if (raf != null) return; raf = requestAnimationFrame(() => { raf = null; draw(); }); };

const onWheel = (e: WheelEvent) => {
    const el = canvasRef.value; if (!el) return;
    const w = Math.max(1, el.clientWidth);
    const rect = el.getBoundingClientRect();
    const cursorX = (e.clientX - rect.left);
    const cursorTime = props.viewport.startSec + (cursorX / w) * props.viewport.durationSec;
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(e.deltaY * 0.0015);
        (emit as any)?.('zoomAround', { timeSec: cursorTime, factor });
        return;
    }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const secDelta = e.deltaX * (props.viewport.durationSec / w);
        (emit as any)?.('pan', secDelta);
    }
};

const onPointerDown = (e: PointerEvent) => {
    const el = canvasRef.value; if (!el) return;
    el.setPointerCapture(e.pointerId);
    isPointerDown = true;
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const sec = props.viewport.startSec + (localX / Math.max(1, el.clientWidth)) * props.viewport.durationSec;
    (emit as any)?.('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * Math.max(1, props.fps)) });
};
const onPointerMove = (e: PointerEvent) => {
    if (!isPointerDown) return;
    const el = canvasRef.value; if (!el) return;
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const sec = props.viewport.startSec + (localX / Math.max(1, el.clientWidth)) * props.viewport.durationSec;
    (emit as any)?.('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * Math.max(1, props.fps)) });
};
const onPointerUp = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    const el = canvasRef.value; if (el) { try { el.releasePointerCapture(e.pointerId); } catch {} }
};

useLaneInteractions(canvasRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: true,
});

onMounted(() => {
    requestDraw();
    const el = canvasRef.value;
    const ro = new ResizeObserver(() => requestDraw());
    if (el) {
        ro.observe(el);
    }
});
onUnmounted(() => { if (raf) cancelAnimationFrame(raf); });

watch(() => [props.viewport.startSec, props.viewport.durationSec, props.waveform, props.energyPerFrame, props.isOnsetPerFrame], () => requestDraw(), { deep: true });

</script>

<template>
    <canvas ref="canvasRef" class="waveform-lane" />
</template>


