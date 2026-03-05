<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';
import { useAutoScroll } from '@/front-end/composables/timeline/useAutoScroll';
import DragTooltip from '../DragTooltip.vue';
import type { LyricTrack, TimelineItem } from '@/types/project_types';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec: number; fps: number };
    fps: number;
    track: LyricTrack;
    playheadFrame: number;
    selectedItemId?: string | null;
    selectedItemIds?: Set<string> | null;
    /** All selected items across all tracks, for cross-track group move */
    allSelectedItems?: { id: string; startMs: number; endMs: number }[] | null;
    snapFind?: ((timeSec: number, excludeSourceId?: string) => { snapped: boolean; timeSec: number }) | null;
    snapClear?: (() => void) | null;
    setInteraction?: ((mode: string) => void) | null;
}>();

const emit = defineEmits<{
    (e: 'selectItem', itemId: string | null): void;
    (e: 'selectItems', itemIds: string[]): void;
    (e: 'toggleItem', itemId: string): void;
    (e: 'addToSelection', itemId: string): void;
    (e: 'updateItem', item: TimelineItem): void;
    (e: 'updateItems', items: TimelineItem[]): void;
    (e: 'groupMoveAll', payload: { anchorId: string; deltaMs: number; updates: { id: string; startMs: number; endMs: number }[] }): void;
    (e: 'pushUndo'): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
    (e: 'marqueeStart', payload: { trackId: string; clientX: number; clientY: number; pointerId: number }): void;
    (e: 'dblclickItem', itemId: string): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);

// Visual feedback state
const ghostBlock = ref<{ leftPct: number; widthPct: number } | null>(null);
const dragTooltip = ref<{ visible: boolean; x: number; y: number; text: string }>({ visible: false, x: 0, y: 0, text: '' });
const overlapWarning = ref(false);
let overlapTimer: ReturnType<typeof setTimeout> | null = null;

const autoScroll = useAutoScroll({
    containerRef,
    getViewport: () => props.viewport,
    panBy: (d) => emit('pan', d),
});

const msToSec = (ms: number) => ms / 1000;

const timeToX = (t: number, w: number) => {
    return ((t - props.viewport.startSec) / props.viewport.durationSec) * w;
};
const xToTime = (x: number, w: number) => {
    return props.viewport.startSec + (x / Math.max(1, w)) * props.viewport.durationSec;
};

const isItemSelected = (id: string): boolean => {
    if (props.selectedItemIds) return props.selectedItemIds.has(id);
    return id === props.selectedItemId;
};

const visibleItems = computed(() => {
    const startMs = props.viewport.startSec * 1000;
    const endMs = (props.viewport.startSec + props.viewport.durationSec) * 1000;
    return props.track.items.filter(item => item.endMs > startMs && item.startMs < endMs);
});

const MIN_BLOCK_PX = 20;

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

type DragMode = 'none' | 'move' | 'trimLeft' | 'trimRight' | 'groupMove' | 'groupTrimLeft' | 'groupTrimRight';
let dragMode: DragMode = 'none';
let dragItemId = '';
let dragStartX = 0;
let dragOriginalStartMs = 0;
let dragOriginalEndMs = 0;
let isPointerDown = false;
let undoPushedForDrag = false;
let groupDragOriginals: { id: string; startMs: number; endMs: number }[] = [];
let groupOrigBounds = { startMs: 0, endMs: 0 };

const setCursor = (c: string) => {
    const el = containerRef.value;
    if (el) el.style.cursor = c;
};

const hitTest = (localX: number): { item: TimelineItem; zone: 'left' | 'right' | 'body' } | null => {
    const el = containerRef.value;
    if (!el) return null;
    const w = el.clientWidth;
    const MIN_HIT_HALF = MIN_BLOCK_PX / 2;

    for (const item of props.track.items) {
        const x1 = timeToX(msToSec(item.startMs), w);
        const x2 = timeToX(msToSec(item.endMs), w);
        const blockW = x2 - x1;
        // Expand hit area for tiny blocks: at least MIN_BLOCK_PX centered on the block
        const midX = (x1 + x2) / 2;
        const hitLeft = blockW >= MIN_BLOCK_PX ? x1 - 2 : midX - MIN_HIT_HALF;
        const hitRight = blockW >= MIN_BLOCK_PX ? x2 + 2 : midX + MIN_HIT_HALF;

        if (localX >= hitLeft && localX <= hitRight) {
            const edgeThreshold = Math.min(6, Math.max(4, blockW * 0.25));
            if (localX - x1 < edgeThreshold && localX >= hitLeft) return { item, zone: 'left' };
            if (x2 - localX < edgeThreshold && localX <= hitRight) return { item, zone: 'right' };
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

    const metaKey = e.metaKey || e.ctrlKey;
    const shiftKey = e.shiftKey;

    if (hit) {
        dragStartX = localX;
        dragOriginalStartMs = hit.item.startMs;
        dragOriginalEndMs = hit.item.endMs;

        if (metaKey) {
            emit('toggleItem', hit.item.id);
            dragItemId = hit.item.id;
        } else if (shiftKey) {
            emit('addToSelection', hit.item.id);
            dragItemId = hit.item.id;
        } else if (!isItemSelected(hit.item.id)) {
            emit('selectItem', hit.item.id);
            dragItemId = hit.item.id;
        } else {
            dragItemId = hit.item.id;
        }

        const allSel = props.allSelectedItems;
        const multiSelected = allSel && allSel.length > 1 && isItemSelected(hit.item.id);

        if (hit.zone === 'left' || hit.zone === 'right') {
            if (multiSelected) {
                groupDragOriginals = allSel!.map(i => ({ id: i.id, startMs: i.startMs, endMs: i.endMs }));
                groupOrigBounds = {
                    startMs: Math.min(...groupDragOriginals.map(o => o.startMs)),
                    endMs: Math.max(...groupDragOriginals.map(o => o.endMs)),
                };
                dragMode = hit.zone === 'left' ? 'groupTrimLeft' : 'groupTrimRight';
            } else {
                dragMode = hit.zone === 'left' ? 'trimLeft' : 'trimRight';
            }
            setCursor('ew-resize');
            props.setInteraction?.('resize');
        } else {
            if (multiSelected) {
                dragMode = 'groupMove';
                groupDragOriginals = allSel!.map(i => ({ id: i.id, startMs: i.startMs, endMs: i.endMs }));
            } else {
                dragMode = 'move';
            }
            setCursor('grabbing');
            props.setInteraction?.('edit');
        }
        return;
    }

    // Empty space: start cross-track marquee if shift held, otherwise scrub
    if (shiftKey) {
        isPointerDown = false;
        try { el.releasePointerCapture(e.pointerId); } catch {}
        emit('marqueeStart', { trackId: props.track.id, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId });
        return;
    }

    emit('selectItem', null);
    const clampedX = Math.max(0, Math.min(el.clientWidth, localX));
    const sec = xToTime(clampedX, el.clientWidth);
    emit('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * Math.max(1, props.fps)) });
    props.setInteraction?.('scrub');
};

const onPointerMove = (e: PointerEvent) => {
    const el = containerRef.value;
    if (!el) return;
    if (isPointerDown && props.track.locked) { isPointerDown = false; dragMode = 'none'; return; }

    if (!isPointerDown) {
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        if (props.track.locked) { setCursor('not-allowed'); return; }
        const hit = hitTest(localX);
        if (hit) {
            setCursor(hit.zone === 'body' ? 'grab' : 'ew-resize');
        } else {
            setCursor('default');
        }
        return;
    }

    const isDraggingItem = dragMode !== 'none';
    let localX: number;
    if (isDraggingItem) {
        autoScroll.update(e.clientX);
        localX = autoScroll.clampedLocalX(e.clientX);
    } else {
        const rect = el.getBoundingClientRect();
        localX = e.clientX - rect.left;
    }

    if (!isDraggingItem) {
        const clampedX = Math.max(0, Math.min(el.clientWidth, localX));
        const sec = xToTime(clampedX, el.clientWidth);
        emit('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * Math.max(1, props.fps)) });
        return;
    }

    const w = el.clientWidth;
    const deltaX = localX - dragStartX;
    const deltaSec = (deltaX / Math.max(1, w)) * props.viewport.durationSec;
    const deltaMs = deltaSec * 1000;

    const snap = props.snapFind;
    const applySnap = (ms: number, excludeId?: string): number => {
        if (!snap) return ms;
        const result = snap(ms / 1000, excludeId || dragItemId);
        return result.snapped ? Math.round(result.timeSec * 1000) : ms;
    };

    if (!undoPushedForDrag) {
        emit('pushUndo');
        undoPushedForDrag = true;
    }

    if (dragMode === 'groupMove') {
        // Snap based on the anchor item, then apply uniform delta to all
        const anchorOrig = groupDragOriginals.find(o => o.id === dragItemId);
        let snappedDeltaMs = deltaMs;
        if (anchorOrig) {
            let newAnchorStart = Math.round(Math.max(0, anchorOrig.startMs + deltaMs));
            newAnchorStart = applySnap(newAnchorStart, dragItemId);
            snappedDeltaMs = newAnchorStart - anchorOrig.startMs;
        }
        // Emit pre-computed updates for all items, using captured originals
        const updates: { id: string; startMs: number; endMs: number }[] = [];
        for (const orig of groupDragOriginals) {
            const dur = orig.endMs - orig.startMs;
            const newStart = Math.max(0, Math.round(orig.startMs + snappedDeltaMs));
            updates.push({ id: orig.id, startMs: newStart, endMs: newStart + dur });
        }
        emit('groupMoveAll', { anchorId: dragItemId, deltaMs: snappedDeltaMs, updates });
        return;
    }

    if (dragMode === 'groupTrimLeft' || dragMode === 'groupTrimRight') {
        const origDur = groupOrigBounds.endMs - groupOrigBounds.startMs;
        if (origDur <= 0) return;
        const MIN_ITEM_MS = 10;

        let newGroupStart = groupOrigBounds.startMs;
        let newGroupEnd = groupOrigBounds.endMs;

        if (dragMode === 'groupTrimLeft') {
            newGroupStart = Math.round(Math.max(0, groupOrigBounds.startMs + deltaMs));
            newGroupStart = applySnap(newGroupStart, dragItemId);
            if (newGroupStart >= groupOrigBounds.endMs - MIN_ITEM_MS) {
                newGroupStart = groupOrigBounds.endMs - MIN_ITEM_MS;
            }
            newGroupEnd = groupOrigBounds.endMs;
        } else {
            newGroupEnd = Math.round(Math.max(groupOrigBounds.startMs + MIN_ITEM_MS, groupOrigBounds.endMs + deltaMs));
            newGroupEnd = applySnap(newGroupEnd, dragItemId);
            newGroupStart = groupOrigBounds.startMs;
        }

        const newDur = newGroupEnd - newGroupStart;

        const updates: { id: string; startMs: number; endMs: number }[] = [];
        for (const orig of groupDragOriginals) {
            const relStart = (orig.startMs - groupOrigBounds.startMs) / origDur;
            const relEnd = (orig.endMs - groupOrigBounds.startMs) / origDur;
            let s = Math.round(newGroupStart + relStart * newDur);
            let en = Math.round(newGroupStart + relEnd * newDur);
            if (en - s < MIN_ITEM_MS) en = s + MIN_ITEM_MS;
            updates.push({ id: orig.id, startMs: Math.max(0, s), endMs: en });
        }

        // Tooltip
        const formatTime = (ms: number) => (ms / 1000).toFixed(3) + 's';
        const label = dragMode === 'groupTrimLeft'
            ? `group in: ${formatTime(newGroupStart)}`
            : `group out: ${formatTime(newGroupEnd)}`;
        dragTooltip.value = { visible: true, x: e.clientX, y: e.clientY, text: label };

        // Ghost block showing the group bounds
        const gStartSec = msToSec(newGroupStart);
        const gEndSec = msToSec(newGroupEnd);
        ghostBlock.value = {
            leftPct: ((gStartSec - props.viewport.startSec) / props.viewport.durationSec) * 100,
            widthPct: ((gEndSec - gStartSec) / props.viewport.durationSec) * 100,
        };

        emit('groupMoveAll', { anchorId: dragItemId, deltaMs: 0, updates });
        return;
    }

    const item = props.track.items.find(i => i.id === dragItemId);
    if (!item) return;

    const sorted = [...props.track.items].sort((a, b) => a.startMs - b.startMs);
    const idx = sorted.findIndex(i => i.id === dragItemId);
    const prevItem = idx > 0 ? sorted[idx - 1] : null;
    const nextItem = idx < sorted.length - 1 ? sorted[idx + 1] : null;
    const trackMaxMs = props.viewport.totalSec * 1000;

    const updated = { ...item };

    if (dragMode === 'move') {
        const dur = dragOriginalEndMs - dragOriginalStartMs;
        let newStart = Math.round(Math.max(0, dragOriginalStartMs + deltaMs));
        newStart = applySnap(newStart);
        let newEnd = Math.round(newStart + dur);
        const snappedEnd = applySnap(newEnd);
        if (snappedEnd !== newEnd) {
            newEnd = snappedEnd;
            newStart = newEnd - Math.round(dur);
        }
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
        newStart = applySnap(newStart);
        if (prevItem && newStart < prevItem.endMs) newStart = prevItem.endMs;
        updated.startMs = newStart;
    } else if (dragMode === 'trimRight') {
        let newEnd = Math.round(Math.max(dragOriginalStartMs + 10, dragOriginalEndMs + deltaMs));
        newEnd = applySnap(newEnd);
        if (nextItem && newEnd > nextItem.startMs) newEnd = nextItem.startMs;
        if (trackMaxMs > 0) newEnd = Math.min(newEnd, Math.round(trackMaxMs));
        updated.endMs = newEnd;
    }

    if (updated.startMs === item.startMs && updated.endMs === item.endMs) return;

    // Visual feedback: ghost block at target position
    const startSec = msToSec(updated.startMs);
    const endSec = msToSec(updated.endMs);
    ghostBlock.value = {
        leftPct: ((startSec - props.viewport.startSec) / props.viewport.durationSec) * 100,
        widthPct: ((endSec - startSec) / props.viewport.durationSec) * 100,
    };

    // Drag tooltip with time info
    const formatTime = (ms: number) => (ms / 1000).toFixed(3) + 's';
    let tooltipText = '';
    if (dragMode === 'move') {
        const delta = updated.startMs - item.startMs;
        tooltipText = `${formatTime(updated.startMs)} → ${formatTime(updated.endMs)}  (${delta >= 0 ? '+' : ''}${formatTime(delta)})`;
    } else if (dragMode === 'trimLeft') {
        tooltipText = `in: ${formatTime(updated.startMs)}`;
    } else if (dragMode === 'trimRight') {
        tooltipText = `out: ${formatTime(updated.endMs)}`;
    }
    dragTooltip.value = { visible: true, x: e.clientX, y: e.clientY, text: tooltipText };

    // Overlap warning flash
    const wasConstrained = (
        (prevItem && updated.startMs === prevItem.endMs && dragOriginalStartMs + deltaMs < prevItem.endMs) ||
        (nextItem && updated.endMs === nextItem.startMs && dragOriginalEndMs + deltaMs > nextItem.startMs)
    );
    if (wasConstrained && !overlapWarning.value) {
        overlapWarning.value = true;
        if (overlapTimer) clearTimeout(overlapTimer);
        overlapTimer = setTimeout(() => { overlapWarning.value = false; }, 300);
    }

    emit('updateItem', updated);
};

const onPointerUp = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    ghostBlock.value = null;
    dragTooltip.value = { visible: false, x: 0, y: 0, text: '' };

    dragMode = 'none';
    dragItemId = '';
    undoPushedForDrag = false;
    groupDragOriginals = [];
    groupOrigBounds = { startMs: 0, endMs: 0 };
    autoScroll.stop();
    props.snapClear?.();
    props.setInteraction?.('idle');
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
    enableScrub: false,
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
                :class="{ selected: isItemSelected(item.id) }"
                :style="itemStyle(item)"
                @dblclick.stop="emit('dblclickItem', item.id)"
            >
                <span class="lyric-item__text">{{ item.text }}</span>
                <div class="lyric-item__handles">
                    <div class="h left" />
                    <div class="h right" />
                </div>
            </div>
        </div>
        <div
            v-if="ghostBlock"
            class="lyric-track-lane__ghost"
            :style="{ left: `${ghostBlock.leftPct}%`, width: `${ghostBlock.widthPct}%`, borderColor: track.color }"
        ></div>
        <div v-if="overlapWarning" class="lyric-track-lane__overlap-flash"></div>
    </div>
    <DragTooltip :visible="dragTooltip.visible" :x="dragTooltip.x" :y="dragTooltip.y" :text="dragTooltip.text" />
</template>

<style scoped>
.lyric-track-lane__ghost {
    position: absolute;
    top: 2px;
    bottom: 2px;
    border: 2px dashed;
    border-radius: 3px;
    opacity: 0.5;
    pointer-events: none;
    z-index: 5;
    background: rgba(255, 255, 255, 0.04);
}
.lyric-track-lane__overlap-flash {
    position: absolute;
    inset: 0;
    background: rgba(255, 60, 60, 0.15);
    pointer-events: none;
    z-index: 15;
    animation: overlap-flash 300ms ease-out forwards;
}
@keyframes overlap-flash {
    0% { opacity: 1; }
    100% { opacity: 0; }
}
</style>
