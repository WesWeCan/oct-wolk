<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{ viewport: { startSec: number; durationSec: number; fps: number }, fps: number, low?: number[], mid?: number[], high?: number[] }>();

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
    ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, wCss, hCss);
    const fps = Math.max(1, props.fps);
    const startF = Math.max(0, Math.floor(props.viewport.startSec * fps));
    const endF = Math.max(startF + 1, Math.floor((props.viewport.startSec + props.viewport.durationSec) * fps));
    const drawLine = (arr: number[] | undefined, color: string, offset: number) => {
        const a = Array.isArray(arr) ? arr : [];
        ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath(); let started = false;
        for (let f = startF; f <= endF && f < a.length; f++) {
            const tSec = f / fps;
            const x = (tSec - props.viewport.startSec) / Math.max(1e-6, props.viewport.durationSec) * wCss;
            const v = Math.min(1, Math.max(0, a[f] || 0));
            const y = (1 - v) * (hCss - 2) - offset;
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
    };
    drawLine(props.low, 'rgba(0, 200, 100, 0.9)', 0);
    drawLine(props.mid, 'rgba(255, 200, 0, 0.9)', 0);
    drawLine(props.high, 'rgba(255, 80, 120, 0.9)', 0);
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
watch(() => [props.viewport.startSec, props.viewport.durationSec, props.low, props.mid, props.high, props.fps], () => requestDraw(), { deep: true });
</script>

<template>
    <canvas ref="canvasRef" class="bands-lane" />
</template>


