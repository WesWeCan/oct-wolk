<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    visible: boolean;
    /** Mouse X relative to the page */
    x: number;
    /** Mouse Y relative to the page */
    y: number;
    text: string;
}>();

const style = computed(() => ({
    left: `${props.x + 12}px`,
    top: `${props.y - 28}px`,
}));
</script>

<template>
    <Teleport to="body">
        <div v-if="visible" class="drag-tooltip" :style="style">
            {{ text }}
        </div>
    </Teleport>
</template>

<style scoped>
.drag-tooltip {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.85);
    color: #fff;
    font-size: 11px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    padding: 3px 7px;
    border-radius: 4px;
    white-space: nowrap;
    border: 1px solid rgba(255, 255, 255, 0.15);
}
</style>
