<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec?: number; fps: number };
    fps: number;
    propertyPath: string;
    track: { propertyPath: string; keyframes: { frame: number; value: any; interpolation?: any }[] } | null;
    meta?: { min?: number; max?: number; type?: string } | null;
    currentFrame?: number;
    selectedIndex?: number | null;
}>();

const emit = defineEmits<{
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'addKeyframe', payload: { frame: number; value: any }): void;
    (e: 'moveKeyframe', payload: { index: number; frame: number }): void;
    (e: 'deleteKeyframe', payload: { index: number }): void;
    (e: 'selectKeyframe', payload: { index: number }): void;
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const width = ref(0);
const height = ref(0);

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
    const ro = new ResizeObserver(() => updateViewBox());
    ro.observe(svg);
    onUnmounted(() => { try { ro.disconnect(); } catch {} });
});
// Handlers (no inline functions in template)
const handleDblClickAdd = () => {
    const fps = Math.max(1, props.fps);
    const midSec = props.viewport.startSec + props.viewport.durationSec * 0.5;
    const frame = Math.max(0, Math.round(midSec * fps));
    emit('addKeyframe', { frame, value: 0, propertyPath: props.propertyPath });
};

const isDragging = ref(false);

const beginDrag = (i: number, e: PointerEvent) => {
    console.log('[PropertyMiniLane] Begin drag for keyframe', i);
    const el = svgRef.value; if (!el) return;
    const target = e.target as SVGElement;
    
    isDragging.value = true;
    document.body.style.cursor = 'grabbing';
    
    try { target?.setPointerCapture?.(e.pointerId); } catch {}
    
    const move = (ev: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const rel = Math.max(0, Math.min(1, px / Math.max(1e-6, width.value)));
        const sec = props.viewport.startSec + rel * Math.max(1e-6, props.viewport.durationSec);
        const frame = Math.max(0, Math.round(sec * Math.max(1, props.fps)));
        console.log('[PropertyMiniLane] Moving keyframe to frame', frame);
        emit('moveKeyframe', { index: i, frame });
        emit('scrub', { timeSec: sec, frame });
    };
    const up = (ev: PointerEvent) => {
        console.log('[PropertyMiniLane] Drag ended');
        isDragging.value = false;
        document.body.style.cursor = '';
        try { target?.releasePointerCapture?.(ev.pointerId); } catch {}
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
};

const onKfPointerDown = (e: PointerEvent) => {
    console.log('[PropertyMiniLane] Keyframe pointerdown:', e.target);
    e.preventDefault();
    e.stopPropagation(); // Stop event from reaching useLaneInteractions
    
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const idxAttr = target.getAttribute('data-idx');
    const i = idxAttr != null ? Number(idxAttr) : NaN;
    console.log('[PropertyMiniLane] Keyframe index:', i);
    if (!Number.isFinite(i)) return;
    emit('selectKeyframe', { index: i as number });
    beginDrag(i as number, e);
};

const keyframes = computed(() => Array.isArray(props.track?.keyframes) ? props.track!.keyframes.slice().sort((a, b) => (a.frame|0) - (b.frame|0)) : []);

const yMid = computed(() => Math.max(6, Math.min(height.value - 6, height.value * 0.5)));

const yForValue = (v: any) => {
    if (!Number.isFinite(Number(v))) return yMid.value;
    const min = Number.isFinite(Number(props.meta?.min)) ? Number(props.meta?.min) : 0;
    const max = Number.isFinite(Number(props.meta?.max)) ? Number(props.meta?.max) : 1;
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const t = (Number(v) - lo) / Math.max(1e-6, (hi - lo));
    const pad = 4;
    const top = pad;
    const bot = Math.max(pad, height.value - pad);
    return bot - (bot - top) * Math.min(1, Math.max(0, t));
};

const pathD = computed(() => {
    const fps = Math.max(1, props.fps);
    const pts = keyframes.value.map(kf => {
        const x = (((kf.frame/ fps) - props.viewport.startSec) / Math.max(1e-6, props.viewport.durationSec)) * width.value;
        const y = (props.meta?.type === 'number' || props.meta?.type == null) ? yForValue((kf as any).value) : yMid.value;
        return [x, y] as [number, number];
    });
    if (pts.length < 2) return '';
    let d = `M${Math.round(pts[0][0])},${Math.round(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) {
        d += ` L${Math.round(pts[i][0])},${Math.round(pts[i][1])}`;
    }
    return d;
});



const onBackgroundPointerDown = (e: PointerEvent) => {
    const tgt = e.target as HTMLElement | null;
    if (tgt && tgt.getAttribute('data-idx') != null) return;
    emit('selectKeyframe', { index: -1 as any });
};

</script>

<template>
    <svg ref="svgRef" class="property-mini-lane" @dblclick="handleDblClickAdd" @pointerdown.self="onBackgroundPointerDown">
        <rect x="0" y="0" :width="width" :height="height" fill="#000" opacity="0.03" @pointerdown="onBackgroundPointerDown" />
        <path v-if="pathD" :d="pathD" stroke="#66a" stroke-width="1" fill="none" opacity="0.5" pointer-events="none" />
        <template v-for="(kf, i) in keyframes" :key="i">
            <path
                :d="`M${(((kf.frame/Math.max(1, fps)) - props.viewport.startSec) / Math.max(1e-6, props.viewport.durationSec)) * width - 6},${(props.meta?.type === 'number' || props.meta?.type == null) ? yForValue((kf as any).value) : yMid} l6,-6 l6,6 l-6,6 z`"
                :fill="(props.selectedIndex === i) ? '#ffd' : '#fff'"
                :stroke="(props.selectedIndex === i) ? '#c60' : '#333'"
                stroke-width="1"
                opacity="0.95"
                :data-idx="i"
                class="keyframe-diamond"
                @pointerdown.stop.prevent="onKfPointerDown"
            />
        </template>
        <text v-if="!keyframes.length" x="8" y="14" fill="#999" font-size="11" pointer-events="none">{{ propertyPath }}</text>
    </svg>
</template>

<style scoped>
.property-mini-lane { width: 100%; height: 100%; display: block; }
.keyframe-diamond { 
    cursor: grab; 
    pointer-events: all;
}
.keyframe-diamond:active { 
    cursor: grabbing; 
}
</style>


