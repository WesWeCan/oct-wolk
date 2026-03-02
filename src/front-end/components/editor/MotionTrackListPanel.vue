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
    (e: 'toggle-track', payload: { trackId: string; enabled: boolean }): void;
    (e: 'select-track', trackId: string): void;
    (e: 'duplicate-track', trackId: string): void;
    (e: 'reorder-tracks', orderedIds: string[]): void;
}>();

const addType = ref<MotionTrack['block']['type']>('subtitle');

const moveTrack = (trackId: string, delta: number) => {
    const ids = props.motionTracks.map((track) => track.id);
    const index = ids.indexOf(trackId);
    if (index < 0) return;
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved);
    emit('reorder-tracks', ids);
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
                    <option value="wordReveal">Word Reveal</option>
                    <option value="paragraph">Paragraph</option>
                </select>
            </div>
        </div>

        <button class="btn-sm" :disabled="lyricTracks.length === 0" @click="emit('add-track', { type: addType })">
            + Add Motion
        </button>

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
                    <span>{{ track.name }} <small>({{ track.block.type }})</small></span>
                </div>
                <div class="track-row__controls">
                    <button class="track-btn" @click.stop="moveTrack(track.id, -1)">↑</button>
                    <button class="track-btn" @click.stop="moveTrack(track.id, 1)">↓</button>
                    <button class="track-btn" @click.stop="emit('duplicate-track', track.id)">DUP</button>
                    <button class="track-btn" :class="{ active: track.enabled }" @click.stop="emit('toggle-track', { trackId: track.id, enabled: !track.enabled })">
                        {{ track.enabled ? 'ON' : 'OFF' }}
                    </button>
                    <button class="track-btn danger" @click.stop="emit('delete-track', track.id)">DEL</button>
                </div>
            </div>
            <div v-if="motionTracks.length === 0" class="track-list-empty">
                No motion tracks yet.
            </div>
        </div>
    </div>
</template>
