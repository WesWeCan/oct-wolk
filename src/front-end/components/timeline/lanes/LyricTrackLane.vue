<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';
import type { LyricTrack, TimelineItem } from '@/types/project_types';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec: number; fps: number };
    fps: number;
    track: LyricTrack;
    playheadFrame: number;
    selectedItemId?: string | null;
}>();

const emit = defineEmits<{
    (e: 'selectItem', itemId: string | null): void;
    (e: 'updateItem', item: TimelineItem): void;
    (e: 'pushUndo'): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);

const msToSec = (ms: number) => ms / 1000;

const timeToX = (t: number, w: number) => {
    return ((t - props.viewport.startSec) / props.viewport.durationSec) * w;
};
const xToTime = (x: number, w: number) => {
    return props.viewport.startSec + (x / Math.max(1, w)) * props.viewport.durationSec;
};

const visibleItems = computed(() => {
    const startMs = props.viewport.startSec * 1000;
    const endMs = (props.viewport.startSec + props.viewport.durationSec) * 1000;
    return props.track.items.filter(item => item.endMs > startMs && item.startMs < endMs);
});

const itemStyle = (item: TimelineItem) => {
    const startSec = msToSec(item.startMs);
    const endSec = msToSec(item.endMs);
    const leftPct = ((startSec - props.viewport.startSec) / props.viewport.durationSec) * 100;
    const widthPct = ((endSec - startSec) / props.viewport.durationSec) * 100;
    return {
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: props.track.color + '88',
        borderColor: props.track.color,
    };
};

// Drag state
type DragMode = 'none' | 'move' | 'trimLeft' | 'trimRight';
let dragMode: DragMode = 'none';
let dragItemId = '';
let dragStartX = 0;
let dragOriginalStartMs = 0;
let dragOriginalEndMs = 0;
let isPointerDown = false;
let undoPushedForDrag = false;

const setCursor = (c: string) => {
    const el = containerRef.value;
    if (el) el.style.cursor = c;
};

const hitTest = (localX: number): { item: TimelineItem; zone: 'left' | 'right' | 'body' } | null => {
    const el = containerRef.value;
    if (!el) return null;
    const w = el.clientWidth;

    for (const item of props.track.items) {
        const x1 = timeToX(msToSec(item.startMs), w);
        const x2 = timeToX(msToSec(item.endMs), w);
        if (localX >= x1 - 2 && localX <= x2 + 2) {
            const edgeThreshold = Math.min(6, (x2 - x1) * 0.25);
            if (localX - x1 < edgeThreshold) return { item, zone: 'left' };
            if (x2 - localX < edgeThreshold) return { item, zone: 'right' };
            return { item, zone: 'body' };
        }
    }
    return null;
};

const onPointerDown = (e: PointerEvent) => {
    if (props.track.locked) return;
    const el = containerRef.value;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    isPointerDown = true;
    undoPushedForDrag = false;

    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const hit = hitTest(localX);

    if (hit) {
        emit('selectItem', hit.item.id);
        dragItemId = hit.item.id;
        dragStartX = localX;
        dragOriginalStartMs = hit.item.startMs;
        dragOriginalEndMs = hit.item.endMs;

        if (hit.zone === 'left') {
            dragMode = 'trimLeft';
            setCursor('ew-resize');
        } else if (hit.zone === 'right') {
            dragMode = 'trimRight';
            setCursor('ew-resize');
        } else {
            dragMode = 'move';
            setCursor('grabbing');
        }
        return;
    }

    emit('selectItem', null);
    const sec = xToTime(localX, el.clientWidth);
    emit('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * Math.max(1, props.fps)) });
};

const onPointerMove = (e: PointerEvent) => {
    const el = containerRef.value;
    if (!el) return;
    if (isPointerDown && props.track.locked) { isPointerDown = false; dragMode = 'none'; return; }
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;

    if (!isPointerDown) {
        if (props.track.locked) { setCursor('not-allowed'); return; }
        const hit = hitTest(localX);
        if (hit) {
            setCursor(hit.zone === 'body' ? 'grab' : 'ew-resize');
        } else {
            setCursor('default');
        }
        return;
    }

    if (dragMode === 'none') {
        const sec = xToTime(localX, el.clientWidth);
        emit('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * Math.max(1, props.fps)) });
        return;
    }

    const w = el.clientWidth;
    const deltaX = localX - dragStartX;
    const deltaSec = (deltaX / Math.max(1, w)) * props.viewport.durationSec;
    const deltaMs = deltaSec * 1000;

    const item = props.track.items.find(i => i.id === dragItemId);
    if (!item) return;

    // Find neighboring items for overlap prevention
    const sorted = [...props.track.items].sort((a, b) => a.startMs - b.startMs);
    const idx = sorted.findIndex(i => i.id === dragItemId);
    const prevItem = idx > 0 ? sorted[idx - 1] : null;
    const nextItem = idx < sorted.length - 1 ? sorted[idx + 1] : null;
    const trackMaxMs = props.viewport.totalSec * 1000;

    const updated = { ...item };

    if (dragMode === 'move') {
        const dur = dragOriginalEndMs - dragOriginalStartMs;
        let newStart = Math.round(Math.max(0, dragOriginalStartMs + deltaMs));
        let newEnd = Math.round(newStart + dur);
        if (prevItem && newStart < prevItem.endMs) {
            newStart = prevItem.endMs;
            newEnd = newStart + Math.round(dur);
        }
        if (nextItem && newEnd > nextItem.startMs) {
            newEnd = nextItem.startMs;
            newStart = newEnd - Math.round(dur);
        }
        updated.startMs = Math.max(0, newStart);
        updated.endMs = newEnd;
    } else if (dragMode === 'trimLeft') {
        let newStart = Math.round(Math.max(0, Math.min(dragOriginalStartMs + deltaMs, dragOriginalEndMs - 10)));
        if (prevItem && newStart < prevItem.endMs) newStart = prevItem.endMs;
        updated.startMs = newStart;
    } else if (dragMode === 'trimRight') {
        let newEnd = Math.round(Math.max(dragOriginalStartMs + 10, dragOriginalEndMs + deltaMs));
        if (nextItem && newEnd > nextItem.startMs) newEnd = nextItem.startMs;
        if (trackMaxMs > 0) newEnd = Math.min(newEnd, Math.round(trackMaxMs));
        updated.endMs = newEnd;
    }

    if (updated.startMs === item.startMs && updated.endMs === item.endMs) return;

    if (!undoPushedForDrag) {
        emit('pushUndo');
        undoPushedForDrag = true;
    }

    emit('updateItem', updated);
};

const onPointerUp = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    dragMode = 'none';
    dragItemId = '';
    undoPushedForDrag = false;
    const el = containerRef.value;
    if (el) {
        try { el.releasePointerCapture(e.pointerId); } catch {}
        setCursor('default');
    }
};

useLaneInteractions(containerRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: true,
});

onMounted(() => {
    const el = containerRef.value;
    if (!el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
});

onUnmounted(() => {
    const el = containerRef.value;
    if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
});
</script>

<template>
    <div
        ref="containerRef"
        class="lyric-track-lane"
        :class="{ muted: track.muted, locked: track.locked }"
    >
        <div class="lyric-track-lane__items">
            <div
                v-for="item in visibleItems"
                :key="item.id"
                class="lyric-item"
                :class="{ selected: item.id === selectedItemId }"
                :style="itemStyle(item)"
            >
                <span class="lyric-item__text">{{ item.text }}</span>
                <div class="lyric-item__handles">
                    <div class="h left" />
                    <div class="h right" />
                </div>
            </div>
        </div>
    </div>
</template>
