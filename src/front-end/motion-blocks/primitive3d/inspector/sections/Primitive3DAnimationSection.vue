<script setup lang="ts">
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
                Shared reveal and motion controls for word sprites. These settings apply when Words are enabled.
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
