<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{ viewport: { startSec: number; durationSec: number; fps: number }, spectrum: number[] }>();

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
    const bars = Math.min(96, props.spectrum.length);
    if (!bars) return;
    const barW = Math.max(1, Math.floor(wCss / bars));
    const maxVal = props.spectrum.reduce((a, b) => Math.max(a, b), 1e-6);
    for (let i = 0; i < bars; i++) {
        const v = props.spectrum[i] / maxVal;
        const bh = Math.max(1, Math.floor(v * (hCss * 0.9)));
        const x = i * barW;
        const y = hCss - bh;
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x, y, Math.max(1, barW - 1), bh);
    }
};

const requestDraw = () => { if (raf != null) return; raf = requestAnimationFrame(() => { raf = null; draw(); }); };
const onWheel = (e: WheelEvent) => {
    const el = canvasRef.value; if (!el) return;
    const w = Math.max(1, el.clientWidth);
    const rect = el.getBoundingClientRect();
    const cursorX = (e.clientX - rect.left);
    const cursorTime = (props as any).viewport?.startSec + (cursorX / w) * (props as any).viewport?.durationSec;
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(e.deltaY * 0.0015);
        (emit as any)?.('zoomAround', { timeSec: cursorTime, factor });
        return;
    }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const secDelta = e.deltaX * (((props as any).viewport?.durationSec || 1) / w);
        (emit as any)?.('pan', secDelta);
    }
};
const onPointerDown = (e: PointerEvent) => {
    const el = canvasRef.value; if (!el) return;
    el.setPointerCapture(e.pointerId);
    isPointerDown = true;
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const sec = (props as any).viewport?.startSec + (localX / Math.max(1, el.clientWidth)) * ((props as any).viewport?.durationSec || 1);
    (emit as any)?.('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * Math.max(1, (props as any).viewport?.fps || 60)) });
};
const onPointerMove = (e: PointerEvent) => {
    if (!isPointerDown) return;
    const el = canvasRef.value; if (!el) return;
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const sec = (props as any).viewport?.startSec + (localX / Math.max(1, el.clientWidth)) * ((props as any).viewport?.durationSec || 1);
    (emit as any)?.('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * Math.max(1, (props as any).viewport?.fps || 60)) });
};
const onPointerUp = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    const el = canvasRef.value; if (el) { try { el.releasePointerCapture(e.pointerId); } catch {} }
};
useLaneInteractions(canvasRef as any, {
    getViewport: () => (props as any).viewport,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: true,
});
onMounted(() => { requestDraw(); const el = canvasRef.value; const ro = new ResizeObserver(() => requestDraw()); if (el) { ro.observe(el); } });
onUnmounted(() => { if (raf) cancelAnimationFrame(raf); });
watch(() => props.spectrum, () => requestDraw());
</script>

<template>
    <canvas ref="canvasRef" class="spectrum-lane" />
</template>


