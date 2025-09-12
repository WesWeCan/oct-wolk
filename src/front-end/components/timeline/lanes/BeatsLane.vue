<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec?: number; fps: number };
    fps: number;
    beats?: number[]; // times in seconds
}>();

const emit = defineEmits<{
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const width = ref(0);
const height = ref(0);
let ro: ResizeObserver | null = null;

useLaneInteractions(svgRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: true,
});

const updateViewBox = () => {
    const svg = svgRef.value; if (!svg) return;
    width.value = svg.clientWidth; height.value = svg.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${width.value} ${height.value}`);
};

onMounted(() => {
    updateViewBox();
    const svg = svgRef.value; if (!svg) return;
    ro = new ResizeObserver(() => updateViewBox());
    try { ro.observe(svg); } catch {}
});
onUnmounted(() => { try { ro?.disconnect(); } catch {} ro = null; });

const visibleBeats = computed(() => {
    const beats = Array.isArray(props.beats) ? props.beats : [];
    const start = props.viewport.startSec;
    const end = props.viewport.startSec + props.viewport.durationSec;
    return beats.filter((t) => t >= start && t <= end);
});

const xForTime = (t: number) => {
    return (t - props.viewport.startSec) / Math.max(1e-6, props.viewport.durationSec) * width.value;
};

watch(() => [props.viewport.startSec, props.viewport.durationSec, props.beats, props.fps], () => {
    updateViewBox();
}, { deep: true });

</script>

<template>
    <svg ref="svgRef" class="beats-lane">
        <g v-if="visibleBeats.length">
            <g v-for="(t, i) in visibleBeats" :key="i">
                <line :x1="xForTime(t)" :x2="xForTime(t)" y1="0" :y2="height" stroke="#7c4dff" stroke-width="2" />
                <circle :cx="xForTime(t)" :cy="height - 6" r="3" fill="#7c4dff" />
            </g>
        </g>
    </svg>
</template>



