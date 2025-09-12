<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec?: number; fps: number };
    fps: number;
    energyPerFrame?: number[];
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
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, wCss, hCss);

    const energy = Array.isArray(props.energyPerFrame) ? props.energyPerFrame : [];
    if (!energy.length) return;

    const fps = Math.max(1, props.fps || props.viewport.fps || 60);
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    const startF = Math.max(0, Math.floor(props.viewport.startSec * fps));
    const endF = Math.max(startF + 1, Math.floor((props.viewport.startSec + props.viewport.durationSec) * fps));
    for (let f = startF; f <= endF && f < energy.length; f++) {
        const tSec = f / fps;
        const x = (tSec - props.viewport.startSec) / Math.max(1e-6, props.viewport.durationSec) * wCss;
        const e = Math.min(1, Math.max(0, energy[f] || 0));
        const y = (1 - e) * hCss;
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
};

const requestDraw = () => { if (raf != null) return; raf = requestAnimationFrame(() => { raf = null; draw(); }); };

useLaneInteractions(canvasRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: true,
});

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

onMounted(() => {
    requestDraw();
    const el = canvasRef.value;
    const ro = new ResizeObserver(() => requestDraw());
    if (el) { ro.observe(el); }
});
onUnmounted(() => { if (raf) cancelAnimationFrame(raf); });

watch(() => [props.viewport.startSec, props.viewport.durationSec, props.energyPerFrame, props.fps], () => requestDraw(), { deep: true });

</script>

<template>
    <canvas ref="canvasRef" class="energy-lane" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" />
</template>



