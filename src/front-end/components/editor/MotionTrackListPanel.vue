<script setup lang="ts">
import { ref } from 'vue';
import type { LyricTrack, MotionTrack } from '@/types/project_types';

const props = defineProps<{
    lyricTracks: LyricTrack[];
    motionTracks: MotionTrack[];
    selectedTrackId: string | null;
}>();

const emit = defineEmits<{
    (e: 'add-track', payload: { type: MotionTrack['block']['type'] }): void;
    (e: 'delete-track', trackId: string): void;
    (e: 'select-track', trackId: string): void;
    (e: 'update-track', track: MotionTrack): void;
}>();

const addType = ref<MotionTrack['block']['type']>('subtitle');

const renamingId = ref<string | null>(null);
const renameValue = ref('');

const startRename = (track: MotionTrack) => {
    renamingId.value = track.id;
    renameValue.value = track.name;
};

const commitRename = (track: MotionTrack) => {
    if (renamingId.value !== track.id) return;
    const nextName = renameValue.value.trim();
    renamingId.value = null;
    if (!nextName || nextName === track.name) return;
    emit('update-track', { ...track, name: nextName });
};
</script>

<template>
    <div class="track-list-panel">
        <div class="track-list-panel__header">
            <span class="track-list-panel__title">Motion Tracks</span>
        </div>

        <p class="track-list-panel__hint">
            Add a subtitle motion track, then adjust source/timing in inspector.
        </p>

        <div class="inspector-row">
            <div class="inspector-field half">
                <label>Block Type</label>
                <select v-model="addType" class="inspector-input" :disabled="lyricTracks.length === 0">
                    <option value="subtitle">Subtitle</option>
                </select>
            </div>
        </div>

        <button class="btn-sm" :disabled="lyricTracks.length === 0" @click="emit('add-track', { type: addType })">
            + Add Motion
        </button>
        <p class="track-list-panel__hint">
            New authoring is subtitle-first. Legacy `wordReveal` / `paragraph` tracks still render for backwards compatibility.
        </p>

        <div v-if="lyricTracks.length === 0" class="track-list-empty">
            No lyric tracks available. Create one in Lyric mode first.
        </div>

        <div class="track-list-panel__list" style="margin-top: 8px;">
            <div
                v-for="track in motionTracks"
                :key="track.id"
                class="track-row"
                :class="{ active: selectedTrackId === track.id }"
                @click="emit('select-track', track.id)"
            >
                <span class="track-row__color" :style="{ backgroundColor: track.color }"></span>
                <div class="track-row__name">
                    <template v-if="renamingId === track.id">
                        <input
                            v-model="renameValue"
                            class="track-rename-input"
                            @keydown.enter="commitRename(track)"
                            @blur="commitRename(track)"
                            @click.stop
                            autofocus
                        />
                    </template>
                    <template v-else>
                        <span @dblclick.stop="startRename(track)" title="Double-click to rename">
                            {{ track.name }} <small>({{ track.block.type }})</small>
                        </span>
                    </template>
                </div>
                <div class="track-row__controls">
                    <button class="track-btn danger" @click.stop="emit('delete-track', track.id)">DEL</button>
                </div>
            </div>
            <div v-if="motionTracks.length === 0" class="track-list-empty">
                No motion tracks yet.
            </div>
        </div>
    </div>
</template>
