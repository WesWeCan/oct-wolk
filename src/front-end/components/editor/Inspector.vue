<script setup lang="ts">
import type { TimelineDocument, SceneRef } from '@/types/timeline_types';

const props = defineProps<{ timeline: TimelineDocument | null; selectedScene: SceneRef | null }>();
const emit = defineEmits<{ (e: 'update:timeline', value: TimelineDocument): void; (e: 'update:scene', value: SceneRef): void }>();

const updateSeed = (e: Event) => {
    if (!props.timeline) return;
    const v = (e.target as HTMLInputElement).value;
    const updated = { ...props.timeline, settings: { ...props.timeline.settings, seed: v } };
    emit('update:timeline', updated);
};

const updateSceneName = (e: Event) => {
    if (!props.selectedScene) return;
    const v = (e.target as HTMLInputElement).value;
    emit('update:scene', { ...props.selectedScene, name: v });
};

</script>

<template>
    <div>
        <h3>Inspector</h3>
        <div v-if="timeline">
            <div>FPS: {{ timeline.settings.fps }}</div>
            <div>Resolution: {{ timeline.settings.renderWidth }}×{{ timeline.settings.renderHeight }}</div>
            <label style="display:block; margin-top:8px;">
                Seed
                <input :value="timeline.settings.seed" @input="updateSeed" />
            </label>
        </div>
        <div v-if="selectedScene" style="margin-top:12px;">
            <label style="display:block;">
                Scene name
                <input :value="selectedScene.name" @input="updateSceneName" />
            </label>
        </div>
    </div>
</template>


