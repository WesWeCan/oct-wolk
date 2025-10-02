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

// Always center keyframes at middle of lane (16px for 32px height)
// Use direct value instead of computed to avoid reactive lag
const yMid = computed(() => {
    const h = height.value || 48;
    return h * 0.5;
});

const pathD = computed(() => {
    const fps = Math.max(1, props.fps);
    const y = yMid.value; // All keyframes at same Y position
    const pts = keyframes.value.map(kf => {
        const x = (((kf.frame/ fps) - props.viewport.startSec) / Math.max(1e-6, props.viewport.durationSec)) * width.value;
        return [x, y] as [number, number];
    });
    if (pts.length < 2) return '';
    let d = `M${Math.round(pts[0][0])},${Math.round(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) {
        d += ` L${Math.round(pts[i][0])},${Math.round(pts[i][1])}`;
    }
    return d;
});

// Compute diamond paths as array to optimize rendering
const diamondPaths = computed(() => {
    const fps = Math.max(1, props.fps);
    const y = yMid.value;
    const w = width.value;
    const startSec = props.viewport.startSec;
    const durSec = props.viewport.durationSec;
    
    return keyframes.value.map(kf => {
        const x = (((kf.frame / fps) - startSec) / Math.max(1e-6, durSec)) * w - 5;
        return `M${x},${y} l5,-5 l5,5 l-5,5 z`;
    });
});



const onBackgroundPointerDown = (e: PointerEvent) => {
    const tgt = e.target as HTMLElement | null;
    if (tgt && tgt.getAttribute('data-idx') != null) return;
    emit('selectKeyframe', { index: -1 as any });
};

</script>

<template>
    <svg ref="svgRef" class="property-mini-lane" @dblclick="handleDblClickAdd" @pointerdown.self="onBackgroundPointerDown">
        <rect x="0" y="0" :width="width" :height="height" fill="#111" @pointerdown="onBackgroundPointerDown" />
        <path v-if="pathD" :d="pathD" stroke="rgba(0, 212, 255, 0.5)" stroke-width="1.5" fill="none" opacity="0.8" pointer-events="none" />
        <template v-for="(kf, i) in keyframes" :key="i">
            <path
                :d="diamondPaths[i]"
                :fill="(props.selectedIndex === i) ? '#00d4ff' : 'rgba(255, 255, 255, 0.9)'"
                :stroke="(props.selectedIndex === i) ? '#00d4ff' : 'rgba(0, 212, 255, 0.5)'"
                stroke-width="1.5"
                opacity="1"
                :data-idx="i"
                class="keyframe-diamond"
                @pointerdown.stop.prevent="onKfPointerDown"
            />
        </template>
        <text v-if="!keyframes.length" x="8" y="20" fill="#666" font-size="10" pointer-events="none">No keyframes</text>
    </svg>
</template>

<style scoped>
.property-mini-lane { 
    width: 100%; 
    height: 100%; 
    display: block;
    min-height: 32px;
}
.keyframe-diamond { 
    cursor: grab; 
    pointer-events: all;
    transition: all 150ms;
}
.keyframe-diamond:hover {
    filter: brightness(1.3);
}
.keyframe-diamond:active { 
    cursor: grabbing; 
}
</style>


