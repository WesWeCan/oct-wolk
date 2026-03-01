<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';
import { useAutoScroll } from '@/front-end/composables/timeline/useAutoScroll';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec?: number; fps: number };
    fps: number;
    propertyPath: string;
    track: { propertyPath: string; keyframes: { frame: number; value: any; interpolation?: any }[] } | null;
    meta?: { min?: number; max?: number; type?: string } | null;
    currentFrame?: number;
    selectedIndex?: number | null; // legacy single-selection support
    selectedIndices?: number[] | null; // preferred multi-selection
}>();

const emit = defineEmits<{
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'addKeyframe', payload: { frame: number; value: any }): void;
    (e: 'moveKeyframe', payload: { index: number; frame: number }): void;
    (e: 'deleteKeyframe', payload: { index: number }): void;
    (e: 'selectKeyframe', payload: { index: number }): void;
    (e: 'selectKeyframes', payload: { indices: number[] }): void;
    (e: 'moveKeyframesBatch', payload: { indices: number[]; deltaFrames: number }): void;
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const width = ref(0);
const height = ref(0);

const autoScroll = useAutoScroll({
    containerRef: svgRef as any,
    getViewport: () => props.viewport as any,
    panBy: (d) => emit('pan', d),
});

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
    emit('addKeyframe', { frame, value: 0 });
};

const isDragging = ref(false);

// Marquee selection state
const marquee = ref<{ active: boolean; startX: number; currentX: number } | null>(null);

// Helper: compute X position (center) for each keyframe
const keyframeXs = computed(() => {
    const fps = Math.max(1, props.fps);
    const w = width.value;
    const startSec = props.viewport.startSec;
    const durSec = Math.max(1e-6, props.viewport.durationSec);
    return keyframes.value.map(kf => {
        const x = (((kf.frame / fps) - startSec) / durSec) * w;
        return x;
    });
});

const beginDrag = (i: number, e: PointerEvent) => {
    const el = svgRef.value; if (!el) return;
    const target = e.target as SVGElement;

    isDragging.value = true;
    document.body.style.cursor = 'grabbing';

    try { target?.setPointerCapture?.(e.pointerId); } catch {}

    const move = (ev: PointerEvent) => {
        autoScroll.update(ev.clientX);
        const px = autoScroll.clampedLocalX(ev.clientX);
        const rel = Math.max(0, Math.min(1, px / Math.max(1e-6, width.value)));
        const sec = props.viewport.startSec + rel * Math.max(1e-6, props.viewport.durationSec);
        const frame = Math.max(0, Math.round(sec * Math.max(1, props.fps)));

        emit('moveKeyframe', { index: i, frame });
    };
    const up = (ev: PointerEvent) => {
        isDragging.value = false;
        autoScroll.stop();
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
    e.preventDefault();
    e.stopPropagation(); // Stop event from reaching useLaneInteractions

    const target = e.target as HTMLElement | null;
    if (!target) return;
    const idxAttr = target.getAttribute('data-idx');
    const i = idxAttr != null ? Number(idxAttr) : NaN;
    if (!Number.isFinite(i)) return;

    const metaToggle = e.metaKey || e.ctrlKey;
    const shift = e.shiftKey;
    const currentSel = Array.isArray(props.selectedIndices)
        ? [...props.selectedIndices!]
        : (props.selectedIndex != null && props.selectedIndex >= 0 ? [props.selectedIndex] : []);

    if (metaToggle || shift) {
        // Apply selection modifiers on click
        const set = new Set<number>(currentSel);
        if (metaToggle) {
            if (set.has(i)) set.delete(i); else set.add(i);
        } else if (shift) {
            set.add(i);
        }
        const next = Array.from(set).sort((a, b) => a - b);
        emit('selectKeyframes', { indices: next });
        // If the clicked index is part of selection, allow group drag
        if (next.includes(i)) {
            beginGroupDrag(i, next, e);
        } else {
            // No drag if removed from selection
        }
        return;
    }

    // Plain click: single select and drag that keyframe
    emit('selectKeyframe', { index: i as number });
    emit('selectKeyframes', { indices: [i as number] });
    beginDrag(i as number, e);
};

// Group drag: move all selected indices by delta frames
const beginGroupDrag = (anchorIndex: number, indices: number[], e: PointerEvent) => {
    const el = svgRef.value; if (!el) return;
    const target = e.target as SVGElement;
    isDragging.value = true;
    document.body.style.cursor = 'grabbing';
    try { target?.setPointerCapture?.(e.pointerId); } catch {}

    const fps = Math.max(1, props.fps);
    const startRect = el.getBoundingClientRect();
    const startPx = e.clientX - startRect.left;

    const move = (ev: PointerEvent) => {
        autoScroll.update(ev.clientX);
        const px = autoScroll.clampedLocalX(ev.clientX);
        const dx = px - startPx;
        const secDelta = (dx / Math.max(1e-6, width.value)) * Math.max(1e-6, props.viewport.durationSec);
        const deltaFrames = Math.round(secDelta * fps);
        if (deltaFrames !== 0) {
            emit('moveKeyframesBatch', { indices, deltaFrames });
        }
    };
    const up = (ev: PointerEvent) => {
        isDragging.value = false;
        autoScroll.stop();
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

// Selection helpers
const selectedSet = computed(() => new Set<number>(Array.isArray(props.selectedIndices)
    ? props.selectedIndices!
    : (props.selectedIndex != null && props.selectedIndex >= 0 ? [props.selectedIndex] : [])));
const isSelected = (i: number) => selectedSet.value.has(i);

// Marquee rectangle geometry
const marqueeRect = computed(() => {
    if (!marquee.value) return null as any;
    const x = Math.min(marquee.value.startX, marquee.value.currentX);
    const w = Math.abs(marquee.value.currentX - marquee.value.startX);
    return { x, y: 0, w, h: height.value } as { x: number; y: number; w: number; h: number };
});



const onBackgroundPointerDown = (e: PointerEvent) => {
    const tgt = e.target as HTMLElement | null;
    if (tgt && tgt.getAttribute('data-idx') != null) return;

    // Shift+drag starts marquee selection and suppresses scrubbing
    if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const svg = svgRef.value; if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const startX = Math.max(0, Math.min(width.value, e.clientX - rect.left));
        marquee.value = { active: true, startX, currentX: startX };

        // Base set from current selection
        const baseSet = new Set<number>(Array.isArray(props.selectedIndices) ? props.selectedIndices! : (props.selectedIndex != null && props.selectedIndex >= 0 ? [props.selectedIndex] : []));
        const toggleMode = e.metaKey || e.ctrlKey; // Shift+Cmd/Ctrl toggles membership

        const onMove = (ev: PointerEvent) => {
            if (!marquee.value) return;
            const r = svg.getBoundingClientRect();
            marquee.value = { ...marquee.value, currentX: Math.max(0, Math.min(width.value, ev.clientX - r.left)) } as any;
            const minX = Math.min(marquee.value.startX, marquee.value.currentX);
            const maxX = Math.max(marquee.value.startX, marquee.value.currentX);
            const inside = keyframeXs.value.map((x, i) => (x >= minX && x <= maxX) ? i : -1).filter(i => i >= 0);
            let next: number[];
            if (toggleMode) {
                const s = new Set<number>(baseSet);
                for (const idx of inside) { if (s.has(idx)) s.delete(idx); else s.add(idx); }
                next = Array.from(s).sort((a, b) => a - b);
            } else {
                next = Array.from(new Set<number>([...Array.from(baseSet), ...inside])).sort((a, b) => a - b);
            }
            emit('selectKeyframes', { indices: next });
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            marquee.value = null;
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return;
    }

    // Plain background click clears selection
    emit('selectKeyframe', { index: -1 as any });
    emit('selectKeyframes', { indices: [] });
};

</script>

<template>
    <svg ref="svgRef" class="property-mini-lane" @dblclick="handleDblClickAdd" @pointerdown.self="onBackgroundPointerDown">
        <rect x="0" y="0" :width="width" :height="height" fill="#111" @pointerdown="onBackgroundPointerDown" />
        <path v-if="pathD" :d="pathD" stroke="rgba(0, 212, 255, 0.5)" stroke-width="1.5" fill="none" opacity="0.8" pointer-events="none" />
        <template v-for="(kf, i) in keyframes" :key="i">
            <path
                :d="diamondPaths[i]"
                :fill="isSelected(i) ? '#00d4ff' : 'rgba(255, 255, 255, 0.9)'"
                :stroke="isSelected(i) ? '#00d4ff' : 'rgba(0, 212, 255, 0.5)'"
                stroke-width="1.5"
                opacity="1"
                :data-idx="i"
                class="keyframe-diamond"
                @pointerdown.stop.prevent="onKfPointerDown"
            />
        </template>
        <rect v-if="marqueeRect" :x="marqueeRect.x" :y="marqueeRect.y" :width="marqueeRect.w" :height="marqueeRect.h" fill="rgba(0,212,255,0.15)" stroke="#00d4ff" stroke-width="2" pointer-events="none" />
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


