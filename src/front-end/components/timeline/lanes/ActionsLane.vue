<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { ActionItem } from '@/types/timeline_types';

const props = defineProps<{
    viewport: { startSec: number; durationSec: number; totalSec: number; fps: number };
    fps: number;
    actions: ActionItem[];
}>();

const emit = defineEmits<{
    (e: 'toggle', frame: number): void;
    (e: 'pan', secDelta: number): void;
    (e: 'zoomAround', payload: { timeSec: number; factor: number }): void;
}>();

const refDiv = ref<HTMLDivElement | null>(null);

const timeToX = (t: number, w: number) => (t - props.viewport.startSec) / props.viewport.durationSec * w;

const onClick = (e: MouseEvent) => {
    const el = refDiv.value; if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const sec = props.viewport.startSec + (x / Math.max(1, el.clientWidth)) * props.viewport.durationSec;
    const frame = Math.max(0, Math.floor(sec * Math.max(1, props.fps)));
    emit('toggle', frame);
};

onMounted(() => { const el = refDiv.value; if (el) el.addEventListener('click', onClick); });
onUnmounted(() => { const el = refDiv.value; if (el) el.removeEventListener('click', onClick); });

// Axis-aware wheel + pinch zoom
import { useLaneInteractions } from '../useLaneInteractions';
useLaneInteractions(refDiv as any, {
    getViewport: () => props.viewport,
    onPan: (d) => emit('pan', d),
    onZoom: (t, f) => emit('zoomAround', { timeSec: t, factor: f }),
    enableScrub: false,
});

</script>

<template>
    <div class="actions-lane" ref="refDiv">
        <div class="markers">
            <div v-for="a in actions" :key="a.id" class="marker" :style="({ left: `calc(${(a.frame/Math.max(1,fps) - viewport.startSec)/viewport.durationSec * 100}% )` })" />
        </div>
    </div>
</template>


