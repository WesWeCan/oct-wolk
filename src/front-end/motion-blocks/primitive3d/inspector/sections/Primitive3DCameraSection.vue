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
                <div class="inspector-note">
                    Camera motion is intentionally fixed. Use object position Z, scale, and word world size to control depth.
                </div>
                <AnimatableNumberField label="Camera Distance" :model-value="api.params.camera.distance" :min="1" :max="25" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.camera.distance', $event)" />
                <div class="style-v2__field">
                    <span class="style-v2__field-label">Projected Bounds</span>
                    <div class="inspector-note">
                        <template v-if="api.rendererBounds">
                            {{ Math.round(api.rendererBounds.width) }} x {{ Math.round(api.rendererBounds.height) }} px
                        </template>
                        <template v-else>
                            Bounds will appear after the first render.
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </details>
</template>
