<script setup lang="ts">
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import type { Primitive3DInspectorApi } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';
import type { MotionTrack } from '@/types/project_types';

defineProps<{
    motionTrack: MotionTrack;
    api: Primitive3DInspectorApi;
}>();
</script>

<template>
    <details class="inspector-section">
        <summary class="inspector-section__title">Source &amp; Timing</summary>
        <div class="inspector-section__content">
            <div class="motion-tab style-v2">
                <div class="inspector-note">
                    Configure the word source in the Words section below. Timing stays editable here like the other motion inspectors.
                </div>
                <AnimatableNumberField
                    label="Start Frame"
                    :model-value="api.startFrame"
                    :min="0"
                    :step="1"
                    :fallback-value="0"
                    :hint="api.formatFrameAndMs(api.startFrame, motionTrack.block.startMs)"
                    :scrub-per-px="0.2"
                    :disabled="api.isLocked"
                    @update:model-value="api.updateStartFrame"
                />
                <AnimatableNumberField
                    label="End Frame"
                    :model-value="api.endFrame"
                    :min="0"
                    :step="1"
                    :fallback-value="0"
                    :hint="api.formatFrameAndMs(api.endFrame, motionTrack.block.endMs)"
                    :scrub-per-px="0.2"
                    :disabled="api.isLocked"
                    @update:model-value="api.updateEndFrame"
                />
            </div>
        </div>
    </details>
</template>
