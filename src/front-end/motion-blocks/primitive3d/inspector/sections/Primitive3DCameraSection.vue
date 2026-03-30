<script setup lang="ts">
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import type { Primitive3DInspectorApi } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';

defineProps<{
    api: Primitive3DInspectorApi;
}>();
</script>

<template>
    <details class="inspector-section">
        <summary class="inspector-section__title">Camera</summary>
        <div class="inspector-section__content">
            <div class="motion-tab style-v2">
                <AnimatableNumberField label="Camera Distance" :model-value="api.params.camera.distance" :min="1" :max="25" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.camera.distance', $event)" />
                <span class="inspector-hint">Camera motion stays fixed here. Use object depth, object scale, and word world size to control the look.</span>
                <div class="style-v2__field">
                    <span class="style-v2__field-label">Projected Bounds</span>
                    <input
                        class="inspector-input"
                        type="text"
                        :value="api.rendererBounds ? `${Math.round(api.rendererBounds.width)} x ${Math.round(api.rendererBounds.height)} px` : 'Bounds appear after the first render.'"
                        disabled
                    >
                    <span class="inspector-hint">This is the current on-canvas footprint of the rendered primitive.</span>
                </div>
            </div>
        </div>
    </details>
</template>
