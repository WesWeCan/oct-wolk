<script setup lang="ts">
import { computed } from 'vue';
import type { LyricTrack, MotionTrack, Scene3DSettings, WolkProjectFont } from '@/types/project_types';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import { getMotionBlockPlugin } from '@/front-end/motion-blocks/core/registry';

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

defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'seek-to-ms', ms: number): void;
    (e: 'update-scene3d', value: Scene3DSettings): void;
}>();

const activePlugin = computed(() => {
    if (!props.motionTrack) return null;
    return getMotionBlockPlugin(props.motionTrack.block.type);
});

const inspectorComponent = computed(() => activePlugin.value?.inspectorComponent ?? null);
</script>

<template>
    <div v-if="!motionTrack" class="inspector-empty">
        Select a motion track to edit.
    </div>
    <component
        v-else-if="inspectorComponent"
        :is="inspectorComponent"
        :motion-track="motionTrack"
        :lyric-tracks="lyricTracks"
        :playhead-ms="playheadMs"
        :fps="fps"
        :project-font="projectFont"
        :render-width="renderWidth"
        :render-height="renderHeight"
        :renderer-bounds="rendererBounds"
        :scene3d="scene3d"
        @update-track="$emit('update-track', $event)"
        @seek-to-ms="$emit('seek-to-ms', $event)"
        @update-scene3d="$emit('update-scene3d', $event)"
    />
    <div v-else class="inspector-empty">
        Unsupported motion block: <strong>{{ motionTrack.block.type }}</strong>
    </div>
</template>
