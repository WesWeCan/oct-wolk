<script setup lang="ts">
import { computed, ref } from 'vue';
import type { MotionTrack } from '@/types/project_types';
import { useLaneInteractions } from '../useLaneInteractions';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec: number; fps: number };
    fps: number;
    track: MotionTrack;
    selected: boolean;
    snapFind?: ((timeSec: number, excludeSourceId?: string) => { snapped: boolean; timeSec: number }) | null;
    snapClear?: (() => void) | null;
}>();

const emit = defineEmits<{
    (e: 'select-track', trackId: string): void;
    (e: 'update-track', track: MotionTrack): void;
    (e: 'push-undo'): void;
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
}>();

type DragMode = 'none' | 'move' | 'trimLeft' | 'trimRight';
let dragMode: DragMode = 'none';
let dragStartX = 0;
let originalStartMs = 0;
let originalEndMs = 0;
let originalPropertyTracks: any[] = [];
let dragging = false;
const containerRef = ref<HTMLDivElement | null>(null);

const blockStyle = computed(() => {
    const startSec = props.track.block.startMs / 1000;
    const endSec = props.track.block.endMs / 1000;
    const leftPct = ((startSec - props.viewport.startSec) / props.viewport.durationSec) * 100;
    const widthPct = ((endSec - startSec) / props.viewport.durationSec) * 100;
    return {
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: `${props.track.color}66`,
        borderColor: props.track.color,
    };
});

const blockClass = computed(() => ({
    selected: props.selected,
    dragging,
}));

const onPointerDown = (e: PointerEvent) => {
    if (!props.track.enabled || props.track.locked) return;
    emit('select-track', props.track.id);
    // Use full lane width (not block width) for pixel->time conversion.
    const laneEl = containerRef.value;
    if (!laneEl) return;

    const target = e.target as HTMLElement;
    const zone = target.closest('[data-zone]')?.getAttribute('data-zone') as DragMode | null;
    dragMode = zone || 'move';
    dragStartX = e.clientX;
    originalStartMs = props.track.block.startMs;
    originalEndMs = props.track.block.endMs;
    originalPropertyTracks = JSON.parse(JSON.stringify(props.track.block.propertyTracks || []));
    dragging = true;
    emit('push-undo');

    const onMove = (ev: PointerEvent) => {
        const width = Math.max(1, laneEl.clientWidth);
        const deltaPx = ev.clientX - dragStartX;
        const deltaSec = (deltaPx / width) * props.viewport.durationSec;
        const deltaMsRaw = Math.round(deltaSec * 1000);
        const snapAnchorSec = dragMode === 'trimRight'
            ? (originalEndMs / 1000)
            : (originalStartMs / 1000);
        const snapped = props.snapFind?.(snapAnchorSec + deltaSec, props.track.id);
        const deltaMs = snapped
            ? Math.round((snapped.timeSec - snapAnchorSec) * 1000)
            : deltaMsRaw;

        let nextStart = originalStartMs;
        let nextEnd = originalEndMs;
        if (dragMode === 'move') {
            const duration = originalEndMs - originalStartMs;
            nextStart = Math.max(0, originalStartMs + deltaMs);
            nextEnd = nextStart + duration;
        } else if (dragMode === 'trimLeft') {
            nextStart = Math.max(0, Math.min(originalEndMs - 100, originalStartMs + deltaMs));
        } else if (dragMode === 'trimRight') {
            nextEnd = Math.max(originalStartMs + 100, originalEndMs + deltaMs);
        }

        let propertyTracks = props.track.block.propertyTracks;
        if (dragMode === 'move' && originalPropertyTracks.length > 0) {
            const frameDelta = Math.round(((nextStart - originalStartMs) / 1000) * props.fps);
            propertyTracks = originalPropertyTracks.map((pt: any) => ({
                ...pt,
                keyframes: (pt.keyframes || []).map((kf: any) => ({
                    ...kf,
                    frame: Math.max(0, kf.frame + frameDelta),
                })),
            }));
        }

        emit('update-track', {
            ...props.track,
            block: {
                ...props.track.block,
                startMs: nextStart,
                endMs: nextEnd,
                propertyTracks,
            },
        });
    };

    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        dragging = false;
        dragMode = 'none';
        props.snapClear?.();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
};

useLaneInteractions(containerRef as any, {
    getViewport: () => props.viewport as any,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    enableScrub: false,
});
</script>

<template>
    <div
        ref="containerRef"
        class="motion-track-lane"
        :class="{ disabled: !track.enabled, locked: track.locked }"
    >
        <div class="motion-track-lane__block" :class="blockClass" :style="blockStyle" @pointerdown.stop="onPointerDown">
            <span class="motion-track-lane__handle left" data-zone="trimLeft"></span>
            <span class="motion-track-lane__text">{{ track.name }}</span>
            <span class="motion-track-lane__handle right" data-zone="trimRight"></span>
        </div>
    </div>
</template>
