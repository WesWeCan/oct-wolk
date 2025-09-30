<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{ viewport: { startSec: number; durationSec: number; fps: number }, fps: number, beatStrengthPerFrame?: number[] }>();

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
    ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, wCss, hCss);
    const arr = Array.isArray(props.beatStrengthPerFrame) ? props.beatStrengthPerFrame : [];
    const fps = Math.max(1, props.fps);
    const startF = Math.max(0, Math.floor(props.viewport.startSec * fps));
    const endF = Math.max(startF + 1, Math.floor((props.viewport.startSec + props.viewport.durationSec) * fps));
    ctx.fillStyle = 'rgba(0, 200, 255, 0.6)';
    const startSec = props.viewport.startSec;
    const durSec = Math.max(1e-6, props.viewport.durationSec);
    for (let f = startF; f <= endF && f < arr.length; f++) {
        const v = Math.min(1, Math.max(0, arr[f] || 0));
        const barH = v * hCss;
        const t0 = f / fps;
        const t1 = (f + 1) / fps;
        const x1 = (t0 - startSec) / durSec * wCss;
        const x2 = (t1 - startSec) / durSec * wCss;
        const w = Math.max(0.5, x2 - x1);
        const y = hCss - barH;
        // Clip to canvas bounds defensively
        const clampedX = Math.max(-wCss, Math.min(wCss * 2, x1));
        ctx.fillRect(clampedX, y, w, barH);
    }
};

const requestDraw = () => { if (raf != null) return; raf = requestAnimationFrame(() => { raf = null; draw(); }); };

useLaneInteractions(canvasRef as any, {
    getViewport: () => (props as any).viewport,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: true,
});

onMounted(() => { requestDraw(); const el = canvasRef.value; const ro = new ResizeObserver(() => requestDraw()); if (el) ro.observe(el); });
onUnmounted(() => { if (raf) cancelAnimationFrame(raf); });
watch(() => [props.viewport.startSec, props.viewport.durationSec, props.beatStrengthPerFrame, props.fps], () => requestDraw(), { deep: true });
</script>

<template>
    <canvas ref="canvasRef" class="beatstrength-lane" />
</template>


