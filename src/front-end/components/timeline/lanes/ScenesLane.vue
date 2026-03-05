<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';
import { useAutoScroll } from '@/front-end/composables/timeline/useAutoScroll';
import type { SceneRef } from '@/types/timeline_types';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec: number; fps: number };
    fps: number;
    scenes: SceneRef[];
    selectedId?: string;
    snapFind?: ((timeSec: number, excludeSourceId?: string) => { snapped: boolean; timeSec: number }) | null;
    snapClear?: (() => void) | null;
    setInteraction?: ((mode: string) => void) | null;
}>();

const emit = defineEmits<{
    (e: 'select', id: string): void;
    (e: 'updateScene', payload: SceneRef): void;
    (e: 'pushUndo'): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);

const autoScroll = useAutoScroll({
    containerRef,
    getViewport: () => props.viewport,
    panBy: (d) => emit('pan', d),
});

const timeToX = (t: number, w: number) => {
    const rel = (t - props.viewport.startSec) / props.viewport.durationSec;
    return rel * w;
};
const xToTime = (x: number, w: number) => props.viewport.startSec + (x / Math.max(1, w)) * props.viewport.durationSec;
const xToFrame = (x: number, w: number) => Math.max(0, Math.floor(xToTime(x, w) * Math.max(1, props.fps)));

const blocks = computed(() => {
    return (props.scenes || []).map(s => {
        const startSec = s.startFrame / Math.max(1, props.fps);
        const endSec = (s.startFrame + s.durationFrames) / Math.max(1, props.fps);
        return { ...s, startSec, endSec };
    });
});

type DragMode = 'none' | 'moveScene' | 'resizeLeft' | 'resizeRight' | 'adjustIn' | 'adjustOut';
let dragMode: DragMode = 'none';
let dragSceneIndex = -1;
let dragMoveOffsetFrames = 0;
let isPointerDown = false;
let isScrubbing = false;
let undoPushedForDrag = false;

const setCursor = (c: string) => { const el = containerRef.value; if (el) el.style.cursor = c; };

const onPointerDown = (e: PointerEvent) => {
    const el = containerRef.value; if (!el) return;
    el.setPointerCapture(e.pointerId);
    isPointerDown = true;
    undoPushedForDrag = false;
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    if (localY < 0 || localY > el.clientHeight) return;
    const fps = Math.max(1, props.fps);
    const fAt = xToFrame(localX, el.clientWidth);
    const scenes = props.scenes || [];
    let hitIdx = -1;
    for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        if (fAt >= s.startFrame && fAt <= s.startFrame + s.durationFrames) { hitIdx = i; break; }
    }
    if (hitIdx >= 0) {
        const s = scenes[hitIdx];
        emit('select', s.id);
        dragSceneIndex = hitIdx;
        const x1 = timeToX(s.startFrame / fps, el.clientWidth);
        const x2 = timeToX((s.startFrame + s.durationFrames) / fps, el.clientWidth);
        const nearLeft = Math.abs(localX - x1) <= 6;
        const nearRight = Math.abs(localX - x2) <= 6;
        if (nearLeft) { dragMode = e.altKey ? 'adjustIn' : 'resizeLeft'; setCursor('ew-resize'); props.setInteraction?.('resize'); return; }
        if (nearRight) { dragMode = e.altKey ? 'adjustOut' : 'resizeRight'; setCursor('ew-resize'); props.setInteraction?.('resize'); return; }
        dragMode = 'moveScene';
        dragMoveOffsetFrames = fAt - s.startFrame;
        setCursor('grabbing');
        props.setInteraction?.('edit');
        return;
    }
    isScrubbing = true;
    const clampedX = Math.max(0, Math.min(el.clientWidth, localX));
    const sec = xToTime(clampedX, el.clientWidth);
    emit('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * fps) });
    props.setInteraction?.('scrub');
    dragMode = 'none';
};

const onPointerMove = (e: PointerEvent) => {
    const el = containerRef.value; if (!el) return;

    if (!isPointerDown) {
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const fps = Math.max(1, props.fps);
        const fAt = xToFrame(localX, el.clientWidth);
        const scenes = props.scenes || [];
        let hitIdx = -1;
        for (let i = 0; i < scenes.length; i++) {
            const s = scenes[i];
            if (fAt >= s.startFrame && fAt <= s.startFrame + s.durationFrames) { hitIdx = i; break; }
        }
        if (hitIdx >= 0) {
            const s = scenes[hitIdx];
            const x1 = timeToX(s.startFrame / fps, el.clientWidth);
            const x2 = timeToX((s.startFrame + s.durationFrames) / fps, el.clientWidth);
            const nearLeft = Math.abs(localX - x1) <= 6;
            const nearRight = Math.abs(localX - x2) <= 6;
            setCursor(nearLeft || nearRight ? 'ew-resize' : 'grab');
            return;
        }
        setCursor('default');
        return;
    }

    // Use auto-scroll during block drags to clamp position and pan viewport
    const isDraggingBlock = dragMode !== 'none';
    let localX: number;
    if (isDraggingBlock) {
        autoScroll.update(e.clientX);
        localX = autoScroll.clampedLocalX(e.clientX);
    } else {
        const rect = el.getBoundingClientRect();
        localX = e.clientX - rect.left;
    }

    if (isDraggingBlock) {
        const fps = Math.max(1, props.fps);
        const frameAtX = xToFrame(localX, el.clientWidth);
        const scenes = props.scenes || [];
        if (dragSceneIndex >= 0 && dragSceneIndex < scenes.length) {
            const s = { ...scenes[dragSceneIndex] } as SceneRef;
            const snap = props.snapFind;
            const snapFrame = (f: number): number => {
                if (!snap) return f;
                const result = snap(f / fps, s.id);
                return result.snapped ? Math.round(result.timeSec * fps) : f;
            };
            if (dragMode === 'moveScene') {
                let newStart = Math.max(0, frameAtX - dragMoveOffsetFrames);
                newStart = snapFrame(newStart);
                const endSnapped = snapFrame(newStart + s.durationFrames);
                if (endSnapped !== newStart + s.durationFrames) {
                    newStart = endSnapped - s.durationFrames;
                }
                s.startFrame = Math.max(0, newStart);
            } else if (dragMode === 'resizeLeft') {
                let newStart = Math.min(frameAtX, s.startFrame + s.durationFrames - 1);
                newStart = snapFrame(newStart);
                const newDur = Math.max(1, (s.startFrame + s.durationFrames) - newStart);
                s.startFrame = Math.max(0, newStart);
                s.durationFrames = newDur;
            } else if (dragMode === 'resizeRight') {
                let endFrame = frameAtX;
                endFrame = snapFrame(endFrame);
                const newDur = Math.max(1, endFrame - s.startFrame);
                s.durationFrames = newDur;
            } else if (dragMode === 'adjustIn') {
                const maxTi = Math.max(0, s.durationFrames - Math.max(0, s.transitionOutFrames || 0));
                const newTi = Math.max(0, Math.min(maxTi, frameAtX - s.startFrame));
                s.transitionInFrames = newTi;
            } else if (dragMode === 'adjustOut') {
                const endFrame = s.startFrame + s.durationFrames;
                const maxTo = Math.max(0, s.durationFrames - Math.max(0, s.transitionInFrames || 0));
                const newTo = Math.max(0, Math.min(maxTo, endFrame - frameAtX));
                s.transitionOutFrames = newTo;
            }
            if (!undoPushedForDrag) {
                emit('pushUndo');
                undoPushedForDrag = true;
            }
            emit('updateScene', s);
        }
        return;
    }
    if (isScrubbing) {
        const fps = Math.max(1, props.fps);
        const clampedX = Math.max(0, Math.min(el.clientWidth, localX));
        const sec = xToTime(clampedX, el.clientWidth);
        emit('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * fps) });
        return;
    }
};

const onPointerUp = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    isScrubbing = false;
    undoPushedForDrag = false;
    props.setInteraction?.('idle');
    dragMode = 'none';
    dragSceneIndex = -1;
    autoScroll.stop();
    props.snapClear?.();
    const el = containerRef.value; if (el) { try { el.releasePointerCapture(e.pointerId); } catch {} setCursor('default'); }
};

useLaneInteractions(containerRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: false,
});

onMounted(() => {
    const el = containerRef.value; if (!el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
});
onUnmounted(() => {
    const el = containerRef.value; if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
});

</script>

<template>
    <div class="scenes-lane" ref="containerRef">
        <div class="blocks">
            <div v-for="s in blocks" :key="s.id" class="block"
                :class="{ selected: s.id === selectedId }"
                :style="({ left: `calc(${(s.startSec - viewport.startSec)/viewport.durationSec * 100}% )`, width: `calc(${(s.endSec - viewport.startSec)/viewport.durationSec * 100}% - ${(s.startSec - viewport.startSec)/viewport.durationSec * 100}% )` })"
                @click.stop="emit('select', s.id)">
                <div class="name">{{ s.name || s.type }}</div>
                <div class="handles">
                    <div class="h left" />
                    <div class="h right" />
                </div>
            </div>
        </div>
    </div>
</template>




