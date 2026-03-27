<script setup lang="ts">
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import MotionEnterExitEditor from '@/front-end/components/editor/motion/MotionEnterExitEditor.vue';
import MotionTextRevealEditor from '@/front-end/components/editor/motion/MotionTextRevealEditor.vue';
import type { Primitive3DInspectorApi } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';
import type { MotionTrack } from '@/types/project_types';

defineProps<{
    motionTrack: MotionTrack;
    api: Primitive3DInspectorApi;
}>();
</script>

<template>
    <details class="inspector-section">
        <summary class="inspector-section__title">Animation</summary>
        <div class="inspector-section__content">
            <div class="inspector-note">
                These controls animate the word sprite layer only. Use Object, Camera, and Material above to shape the base 3D primitive.
            </div>

            <details class="style-sub-section" open>
                <summary class="style-sub-section__header">Text Reveal</summary>
                <MotionTextRevealEditor
                    :value="api.params.textReveal"
                    :disabled="api.isLocked"
                    @update-text-reveal="api.updateTextReveal"
                />
            </details>

            <details class="style-sub-section" open>
                <summary class="style-sub-section__header">Lifecycle</summary>
                <div class="inspector-field">
                    <span class="inspector-hint">Controls how long each word sprite stays on the primitive before it exits or gets replaced.</span>
                </div>

                <div class="inspector-field">
                    <label>Exit Behavior</label>
                    <div class="segmented-control">
                        <button
                            type="button"
                            :class="{ active: api.params.lifecycle.exitMode === 'stay' }"
                            :disabled="api.isLocked"
                            @click="api.updateLifecycleExitMode('stay')"
                        >Stay Until Replaced</button>
                        <button
                            type="button"
                            :class="{ active: api.params.lifecycle.exitMode === 'perItem' }"
                            :disabled="api.isLocked"
                            @click="api.updateLifecycleExitMode('perItem')"
                        >Exit Per Word</button>
                    </div>
                </div>

                <AnimatableNumberField
                    v-if="api.params.lifecycle.exitMode === 'perItem'"
                    label="Exit Delay (ms)"
                    :model-value="api.params.lifecycle.exitDelayMs"
                    :min="0"
                    :max="60000"
                    :step="50"
                    :fallback-value="0"
                    hint="Extra hold time after a word ends before its exit animation begins. Typewriter timing still follows the original word duration."
                    :disabled="api.isLocked"
                    @update:model-value="api.updateLifecycleExitDelayMs"
                />
            </details>

            <details class="style-sub-section" open>
                <summary class="style-sub-section__header">Motion</summary>
                <MotionEnterExitEditor
                    :enter-value="motionTrack.block.enter"
                    :exit-value="motionTrack.block.exit"
                    @update-enter-exit="api.updateEnterExit"
                />
            </details>
        </div>
    </details>
</template>
