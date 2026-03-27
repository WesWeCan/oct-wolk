<script setup lang="ts">
import MotionPresetPanel from '@/front-end/components/editor/motion/MotionPresetPanel.vue';
import { primitive3dMotionPresetAdapter } from '@/front-end/motion-blocks/primitive3d/presets';
import type { Primitive3DInspectorApi } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';
import type { MotionTrack } from '@/types/project_types';

defineProps<{
    motionTrack: MotionTrack;
    api: Primitive3DInspectorApi;
}>();
</script>

<template>
    <details class="inspector-section">
        <summary class="inspector-section__title">Presets</summary>
        <div class="inspector-section__content">
            <MotionPresetPanel
                :motion-track="motionTrack"
                :preset-adapter="primitive3dMotionPresetAdapter"
                :project-font="api.projectFont"
                :disabled="api.isLocked"
                :disabled-message="api.blockPresetDisabledMessage"
                @update-track="api.applyMotionPreset"
            />
        </div>
    </details>
</template>
