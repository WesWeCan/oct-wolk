<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

// WordKeyframes lane: pure timing markers for global word pool
const props = defineProps<{ viewport: { startSec: number; durationSec: number; totalSec?: number; fps: number }; fps: number; markers?: number[]; beats?: number[]; currentFrame?: number }>();

const emit = defineEmits<{
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'dragMarker', payload: { index: number; frame: number; originalFrame: number }): void;
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
    // Pointer-based drag for markers with optional beat snapping
    let draggingIndex: number | null = null;
    let draggingOriginalFrame: number = -1;
    const onDown = (e: PointerEvent) => {
        const rect = svg.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const idx = (() => {
            let best = -1; let bestD = 1e9;
            const list = markers.value;
            for (let i = 0; i < list.length; i++) {
                const f = list[i];
                const x = (((f/Math.max(1, props.fps)) - props.viewport.startSec) / Math.max(1e-6, props.viewport.durationSec)) * width.value;
                const y = Math.max(4, Math.min(height.value - 16, (height.value - 12) * 0.5)) + 6;
                const dx = x - px; const dy = y - py; const d = Math.sqrt(dx*dx + dy*dy);
                if (d < bestD) { bestD = d; best = i; }
            }
            return bestD <= 16 ? best : -1;
        })();
        if (idx >= 0) {
            draggingIndex = idx;
            draggingOriginalFrame = markers.value[idx] || 0;
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        }
    };
    const onMove = (e: PointerEvent) => {
        if (draggingIndex === null) return;
        const rect = svg.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const rel = Math.max(0, Math.min(1, px / Math.max(1e-6, width.value)));
        let timeSec = props.viewport.startSec + rel * Math.max(1e-6, props.viewport.durationSec);
        // optional beat snapping within 120ms
        const beats = Array.isArray(props.beats) ? props.beats : [];
        if (beats.length) {
            let best = beats[0]; let bestD = Math.abs(best - timeSec);
            for (let i = 1; i < beats.length; i++) {
                const b = beats[i]; const d = Math.abs(b - timeSec);
                if (d < bestD) { best = b; bestD = d; }
            }
            if (bestD <= 0.12) timeSec = best;
        }
        const frame = Math.max(0, Math.round(timeSec * Math.max(1, props.fps)));
        emit('scrub', { timeSec, frame });
        emit('dragMarker', { index: draggingIndex, frame, originalFrame: draggingOriginalFrame });
        // Update the reference so we keep dragging the same logical marker even if ordering changes
        draggingOriginalFrame = frame;
    };
    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        draggingIndex = null;
        draggingOriginalFrame = -1;
    };
    svg.addEventListener('pointerdown', onDown);
    onUnmounted(() => { try { svg.removeEventListener('pointerdown', onDown); } catch {} });
});
onUnmounted(() => { try { ro?.disconnect(); } catch {} ro = null; });

const markers = computed(() => Array.isArray(props.markers) ? props.markers.slice().map(n => Math.max(0, n|0)) : []);

// Check if a keyframe is at the current playhead frame
const isKeyframeSelected = (frame: number): boolean => {
    return props.currentFrame !== undefined && Math.abs(frame - props.currentFrame) < 0.5;
};

watch(() => [props.viewport.startSec, props.viewport.durationSec, props.fps, ...markers.value], () => {
    updateViewBox();
}, { deep: true });

// Debug instrumentation
watch(markers, (m) => {
    console.debug('[WordKeyframesLane] markers changed:', { count: m?.length || 0, sample: (m || []).slice(0, 8) });
});
watch(() => props.viewport, (v) => {
    console.debug('[WordKeyframesLane] viewport changed:', v);
}, { deep: true });
onMounted(() => {
    console.debug('[WordKeyframesLane] mounted. Initial markers:', { count: markers.value.length, sample: markers.value.slice(0, 8) });
});
</script>

<template>
    <svg ref="svgRef" class="keyframes-lane">
        <rect x="0" y="0" :width="width" :height="height" fill="#000" opacity="0.05" />
        <template v-for="f in markers" :key="f">
            <!-- Selected keyframe outline -->
            <rect
                v-if="isKeyframeSelected(f)"
                :x="(((f/Math.max(1, props.fps)) - props.viewport.startSec) / Math.max(1e-6, props.viewport.durationSec)) * width - 6"
                :y="Math.max(2, Math.min(height - 18, (height - 12) * 0.5 - 2))"
                width="12"
                height="16"
                rx="3"
                ry="3"
                fill="none"
                stroke="#00d4ff"
                stroke-width="2"
                opacity="0.9"
            />
            <!-- Keyframe marker -->
            <rect
                :x="(((f/Math.max(1, props.fps)) - props.viewport.startSec) / Math.max(1e-6, props.viewport.durationSec)) * width - 4"
                :y="Math.max(4, Math.min(height - 16, (height - 12) * 0.5))"
                width="8"
                height="12"
                rx="2"
                ry="2"
                :fill="isKeyframeSelected(f) ? '#00d4ff' : '#fff'"
                :opacity="isKeyframeSelected(f) ? '1.0' : '0.9'"
                class="keyframe-marker"
            />
        </template>
        <text v-if="!markers || !markers.length" x="8" y="16" fill="#e66" font-size="12">No keyframe markers</text>
    </svg>
</template>

<style scoped lang="scss">
.keyframes-lane {
    cursor: default;
    
    .keyframe-marker {
        cursor: grab;
        transition: opacity 120ms, fill 120ms;
        
        &:hover {
            opacity: 1 !important;
        }
    }
}
</style>

