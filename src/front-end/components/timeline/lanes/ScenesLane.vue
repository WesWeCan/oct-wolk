<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useLaneInteractions } from '../useLaneInteractions';
import type { SceneRef } from '@/types/timeline_types';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec: number; fps: number };
    fps: number;
    scenes: SceneRef[];
    selectedId?: string;
}>();

const emit = defineEmits<{
    (e: 'select', id: string): void;
    (e: 'updateScene', payload: SceneRef): void;
    (e: 'scrub', payload: { timeSec: number; frame: number }): void;
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);

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

const setCursor = (c: string) => { const el = containerRef.value; if (el) el.style.cursor = c; };

const onPointerDown = (e: PointerEvent) => {
    const el = containerRef.value; if (!el) return;
    el.setPointerCapture(e.pointerId);
    isPointerDown = true;
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    // Only consider within body (below header height ~28)
    if (localY < 0 || localY > el.clientHeight) return;
    const fps = Math.max(1, props.fps);
    const fAt = xToFrame(localX, el.clientWidth);
    // Hit test
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
        if (nearLeft) { dragMode = e.altKey ? 'adjustIn' : 'resizeLeft'; setCursor('ew-resize'); return; }
        if (nearRight) { dragMode = e.altKey ? 'adjustOut' : 'resizeRight'; setCursor('ew-resize'); return; }
        dragMode = 'moveScene';
        dragMoveOffsetFrames = fAt - s.startFrame;
        setCursor('grabbing');
        return;
    }
    // empty space: start scrubbing
    isScrubbing = true;
    const sec = xToTime(localX, el.clientWidth);
    emit('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * fps) });
    dragMode = 'none';
};

const onPointerMove = (e: PointerEvent) => {
    const el = containerRef.value; if (!el) return;
    const rect = el.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    if (!isPointerDown) {
        // hover cursor
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
    if (dragMode !== 'none') {
        const fps = Math.max(1, props.fps);
        const frameAtX = xToFrame(localX, el.clientWidth);
        const scenes = props.scenes || [];
        if (dragSceneIndex >= 0 && dragSceneIndex < scenes.length) {
            const s = { ...scenes[dragSceneIndex] } as SceneRef;
            if (dragMode === 'moveScene') {
                s.startFrame = Math.max(0, frameAtX - dragMoveOffsetFrames);
            } else if (dragMode === 'resizeLeft') {
                const newStart = Math.min(frameAtX, s.startFrame + s.durationFrames - 1);
                const newDur = Math.max(1, (s.startFrame + s.durationFrames) - newStart);
                s.startFrame = Math.max(0, newStart);
                s.durationFrames = newDur;
            } else if (dragMode === 'resizeRight') {
                const newDur = Math.max(1, frameAtX - s.startFrame);
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
            emit('updateScene', s);
        }
        return;
    }
    if (isScrubbing) {
        const fps = Math.max(1, props.fps);
        const sec = xToTime(localX, el.clientWidth);
        emit('scrub', { timeSec: Math.max(0, sec), frame: Math.floor(sec * fps) });
        return;
    }
};

const onPointerUp = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    isScrubbing = false;
    dragMode = 'none';
    dragSceneIndex = -1;
    const el = containerRef.value; if (el) { try { el.releasePointerCapture(e.pointerId); } catch {} setCursor('default'); }
};

useLaneInteractions(containerRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    onScrub: (t, frame) => emit('scrub', { timeSec: t, frame }),
    enableScrub: true,
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




