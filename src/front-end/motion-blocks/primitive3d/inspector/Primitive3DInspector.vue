<script setup lang="ts">
import Primitive3DCameraSection from '@/front-end/motion-blocks/primitive3d/inspector/sections/Primitive3DCameraSection.vue';
import Primitive3DLightingSection from '@/front-end/motion-blocks/primitive3d/inspector/sections/Primitive3DLightingSection.vue';
import Primitive3DMaterialSection from '@/front-end/motion-blocks/primitive3d/inspector/sections/Primitive3DMaterialSection.vue';
import Primitive3DObjectSection from '@/front-end/motion-blocks/primitive3d/inspector/sections/Primitive3DObjectSection.vue';
import Primitive3DSourceTimingSection from '@/front-end/motion-blocks/primitive3d/inspector/sections/Primitive3DSourceTimingSection.vue';
import Primitive3DWordsSection from '@/front-end/motion-blocks/primitive3d/inspector/sections/Primitive3DWordsSection.vue';
import { usePrimitive3DInspector } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import type { LyricTrack, MotionTrack, Scene3DSettings, WolkProjectFont } from '@/types/project_types';

const props = defineProps<{
    motionTrack: MotionTrack | null;
    lyricTracks: LyricTrack[];
    playheadMs?: number;
    fps?: number;
    projectFont?: WolkProjectFont;
    renderWidth?: number;
    renderHeight?: number;
    rendererBounds?: RendererBounds | null;
    scene3d?: Scene3DSettings;
}>();

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'seek-to-ms', ms: number): void;
    (e: 'update-scene3d', value: Scene3DSettings): void;
}>();

const api = usePrimitive3DInspector(props, emit);
</script>

<template>
    <div class="motion-inspector motion-inspector--primitive3d">
        <div v-if="!motionTrack" class="inspector-empty">
            Select a motion track to edit.
        </div>

        <template v-else>
            <Primitive3DSourceTimingSection :motion-track="motionTrack" :api="api" />
            <Primitive3DObjectSection :api="api" />
            <Primitive3DCameraSection :api="api" />
            <Primitive3DMaterialSection :api="api" />
            <Primitive3DWordsSection :motion-track="motionTrack" :api="api" />
            <Primitive3DLightingSection :api="api" />
        </template>
    </div>
</template>
