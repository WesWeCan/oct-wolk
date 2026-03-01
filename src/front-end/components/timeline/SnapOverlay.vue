<script setup lang="ts">
import { computed } from 'vue';
import type { SnapLine } from '@/front-end/composables/timeline/useSnapEngine';

const props = defineProps<{
    snapLines: SnapLine[];
    viewport: { startSec: number; durationSec: number };
}>();

const lines = computed(() =>
    props.snapLines
        .map(line => {
            const pct = ((line.timeSec - props.viewport.startSec) / props.viewport.durationSec) * 100;
            if (pct < -1 || pct > 101) return null;
            return { pct, label: line.label };
        })
        .filter(Boolean) as { pct: number; label?: string }[]
);
</script>

<template>
    <div class="snap-overlay" v-if="lines.length">
        <div
            v-for="(line, i) in lines"
            :key="i"
            class="snap-line"
            :style="{ left: `${line.pct}%` }"
        >
            <span v-if="line.label" class="snap-label">{{ line.label }}</span>
        </div>
    </div>
</template>

<style scoped>
.snap-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 50;
    overflow: hidden;
}
.snap-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 1px dashed rgba(0, 212, 255, 0.7);
}
.snap-label {
    position: absolute;
    top: 2px;
    left: 4px;
    font-size: 9px;
    color: rgba(0, 212, 255, 0.9);
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.6);
    padding: 1px 3px;
    border-radius: 2px;
}
</style>
