<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec: number; fps: number };
    fps: number;
    waveform: number[];
    analyzedDurationSec?: number;
}>();

const emit = defineEmits<{
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let raf: number | null = null;

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
        // Use analyzed duration for correct bucket mapping
        const actualDuration = props.analyzedDurationSec || props.viewport.totalSec;
        const startBucket = Math.max(0, Math.floor((props.viewport.startSec / actualDuration) * totalBuckets));
        const endBucket = Math.min(totalBuckets, Math.ceil(((props.viewport.startSec + props.viewport.durationSec) / actualDuration) * totalBuckets));
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
    // overlays removed: energy line and onset bars handled in separate lanes
};

const requestDraw = () => { if (raf != null) return; raf = requestAnimationFrame(() => { raf = null; draw(); }); };

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

watch(() => [
    props.viewport.startSec,
    props.viewport.durationSec,
    props.waveform,
    props.fps,
], () => requestDraw(), { deep: true });

</script>

<template>
    <canvas ref="canvasRef" class="waveform-lane" />
</template>


