<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{ viewport: { startSec: number; durationSec: number; totalSec?: number; fps: number } }>();

const emit = defineEmits<{
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
}>();

const svgRef = ref<SVGSVGElement | null>(null);

useLaneInteractions(svgRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: true,
});

onMounted(() => {
    const svg = svgRef.value; if (!svg) return;
    // Simple background to ensure full-width capture
    const w = svg.clientWidth; const h = svg.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
});
</script>

<template>
    <svg ref="svgRef" class="keyframes-lane" />
</template>


