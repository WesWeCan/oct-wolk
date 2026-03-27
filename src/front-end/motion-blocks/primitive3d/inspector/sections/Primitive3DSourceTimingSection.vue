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
                <div class="style-v2__field">
                    <span class="style-v2__field-label">Enable Word Sprites</span>
                    <div class="segmented-control">
                        <button type="button" aria-label="Enable word sprites off" :class="{ active: !api.params.words.enabled }" :disabled="api.isLocked" @click="api.updatePathValue('params.words.enabled', false)">Off</button>
                        <button type="button" aria-label="Enable word sprites on" :class="{ active: api.params.words.enabled }" :disabled="api.isLocked" @click="api.updatePathValue('params.words.enabled', true)">On</button>
                    </div>
                </div>
                <div class="style-v2__field">
                    <span class="style-v2__field-label">Word Track</span>
                    <select aria-label="Word track" class="inspector-input" :disabled="api.isLocked" :value="motionTrack.block.sourceTrackId" @change="api.updateSourceTrackId(($event.target as HTMLSelectElement).value)">
                        <option value="">No source track</option>
                        <option v-for="track in api.wordTracks" :key="track.id" :value="track.id">
                            {{ track.name }}
                        </option>
                    </select>
                </div>
                <div class="inspector-note">
                    <template v-if="api.selectedWordTrack">
                        Using `{{ api.selectedWordTrack.name }}` with {{ api.anchorCapacity }} geometry-driven slots.
                    </template>
                    <template v-else-if="api.wordTracks.length > 0">
                        Select a `word` lyric track to render billboarded word sprites on the primitive.
                    </template>
                    <template v-else>
                        No `word` lyric tracks found yet. Create one first so the sprites have timing data.
                    </template>
                </div>
                <div class="inspector-note">
                    Start and end frames control the full primitive block on the timeline. Word sprite timing still comes from the selected word track.
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
