<script setup lang="ts">
import { ref, watch } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; fps: number };
    playhead: { frame: number };
    beats?: number[];
}>();

const emit = defineEmits<{
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
}>();

const svgRef = ref<SVGSVGElement | null>(null);
// Temporary toggle to switch labels between milliseconds and frame numbers
const showFrames = false; // set to true to display frame numbers instead of time

const niceGridSeconds = (windowSec: number, widthPx: number): number => {
    const targetPx = 100;
    const secondsPerPx = windowSec / Math.max(1, widthPx);
    const raw = targetPx * secondsPerPx;
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    for (const s of steps) if (s >= raw) return s;
    return steps[steps.length - 1];
};

const timeToX = (t: number, w: number) => {
    const rel = (t - props.viewport.startSec) / props.viewport.durationSec;
    return rel * w;
};

const formatLabel = (t: number, step: number): string => {
    const frames = Math.floor(t * Math.max(1, props.viewport.fps));
    // show mm:ss.ms and frame number together
    const total = Math.max(0, t);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const ms = Math.floor((total - Math.floor(total)) * 1000);
    const timeStr = `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    return `${timeStr} (${frames}f)`;
};

const redraw = () => {
    const svg = svgRef.value; if (!svg) return;
    const w = svg.clientWidth; const h = svg.clientHeight;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const mk = (name: string) => document.createElementNS('http://www.w3.org/2000/svg', name);
    const bg = mk('rect'); bg.setAttribute('x', '0'); bg.setAttribute('y', '0'); bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h)); bg.setAttribute('fill', 'rgba(20, 20, 25, 0.95)'); svg.appendChild(bg);
    // capture rect for full-width interactions
    const capture = mk('rect'); capture.setAttribute('x', '0'); capture.setAttribute('y', '0'); capture.setAttribute('width', String(w)); capture.setAttribute('height', String(h)); capture.setAttribute('fill', 'transparent'); capture.setAttribute('pointer-events', 'all'); svg.appendChild(capture);
    const grid = mk('g'); grid.setAttribute('stroke', 'rgba(255,255,255,0.15)'); grid.setAttribute('stroke-width', '1'); svg.appendChild(grid);
    const step = niceGridSeconds(props.viewport.durationSec, w);
    const startTick = Math.ceil(props.viewport.startSec / step) * step;
    const padding = 6; // Internal padding for spacing from edges
    for (let t = startTick; t < props.viewport.startSec + props.viewport.durationSec; t += step) {
        const x = timeToX(t, w);
        const line = mk('line'); line.setAttribute('x1', String(x)); line.setAttribute('y1', String(padding)); line.setAttribute('x2', String(x)); line.setAttribute('y2', String(h - padding)); grid.appendChild(line);
        const labelText = formatLabel(t, step);
        const label = mk('text'); label.textContent = labelText; label.setAttribute('x', String(x + 4)); label.setAttribute('y', String(h - 12)); label.setAttribute('fill', '#fff'); label.setAttribute('font-size', '11'); label.setAttribute('paint-order', 'stroke'); label.setAttribute('stroke', '#000'); label.setAttribute('stroke-width', '2'); label.setAttribute('pointer-events', 'none'); svg.appendChild(label);
    }
    // playhead
    const curTime = Math.max(0, props.playhead.frame / Math.max(1, props.viewport.fps));
    const px = timeToX(curTime, w);
    const ph = mk('line'); ph.setAttribute('x1', String(px)); ph.setAttribute('y1', String(padding)); ph.setAttribute('x2', String(px)); ph.setAttribute('y2', String(h - padding)); ph.setAttribute('stroke', 'rgba(255,0,0,0.5)'); ph.setAttribute('stroke-width', '1'); svg.appendChild(ph);
    const label = mk('text'); label.textContent = formatLabel(curTime, 0.5); label.setAttribute('x', String(px + 6)); label.setAttribute('y', String(h - 12)); label.setAttribute('fill', '#ff8080'); label.setAttribute('font-size', '11'); label.setAttribute('paint-order', 'stroke'); label.setAttribute('stroke', '#000'); label.setAttribute('stroke-width', '2'); label.setAttribute('pointer-events', 'none'); svg.appendChild(label);
};

useLaneInteractions(svgRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: true,
});

watch(() => [props.viewport.startSec, props.viewport.durationSec, props.viewport.fps, props.playhead.frame], () => redraw());
watch(svgRef, () => redraw());

</script>

<template>
    <svg ref="svgRef" class="ruler" tabindex="0"></svg>
</template>
