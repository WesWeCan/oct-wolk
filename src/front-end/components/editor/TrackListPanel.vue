<script setup lang="ts">
import type { LyricTrack } from '@/types/project_types';
import {
    generateWordTrack,
    generateSentenceTrack,
    generateVerseTrack,
    createCustomTrack,
} from '@/front-end/utils/lyricTrackGenerators';

const props = defineProps<{
    tracks: LyricTrack[];
    rawLyrics: string;
    audioDurationMs: number;
}>();

const emit = defineEmits<{
    (e: 'addTrack', track: LyricTrack): void;
    (e: 'deleteTrack', trackId: string): void;
    (e: 'updateTrack', track: LyricTrack): void;
    (e: 'duplicateTrack', trackId: string): void;
    (e: 'reorderTracks', trackIds: string[]): void;
}>();

const hasLyrics = () => !!props.rawLyrics.trim();
const effectiveDuration = () => props.audioDurationMs > 0 ? props.audioDurationMs : 180_000;

const generateWords = () => {
    if (!hasLyrics()) return;
    emit('addTrack', generateWordTrack(props.rawLyrics, effectiveDuration(), props.tracks.length));
};

const generateSentences = () => {
    if (!hasLyrics()) return;
    emit('addTrack', generateSentenceTrack(props.rawLyrics, effectiveDuration(), props.tracks.length));
};

const generateVerses = () => {
    if (!hasLyrics()) return;
    emit('addTrack', generateVerseTrack(props.rawLyrics, effectiveDuration(), props.tracks.length));
};

const addCustom = () => {
    emit('addTrack', createCustomTrack(props.tracks.length));
};

const toggleMute = (track: LyricTrack) => {
    emit('updateTrack', { ...track, muted: !track.muted });
};

const toggleSolo = (track: LyricTrack) => {
    emit('updateTrack', { ...track, solo: !track.solo });
};

const toggleLock = (track: LyricTrack) => {
    emit('updateTrack', { ...track, locked: !track.locked });
};

const renamingId = defineModel<string | null>('renamingId', { default: null });
const renameValue = defineModel<string>('renameValue', { default: '' });

const startRename = (track: LyricTrack) => {
    renamingId.value = track.id;
    renameValue.value = track.name;
};

const commitRename = (track: LyricTrack) => {
    if (renamingId.value === track.id && renameValue.value.trim()) {
        emit('updateTrack', { ...track, name: renameValue.value.trim() });
    }
    renamingId.value = null;
};

const deletingId = defineModel<string | null>('deletingId', { default: null });
</script>

<template>
    <div class="track-list-panel">
        <div class="track-list-panel__header">
            <span class="track-list-panel__title">Tracks</span>
        </div>

        <div class="track-list-panel__generators">
            <button @click="generateWords" :disabled="!rawLyrics.trim()" title="Split lyrics into individual words">Words</button>
            <button @click="generateSentences" :disabled="!rawLyrics.trim()" title="Split lyrics into lines/sentences">Lines</button>
            <button @click="generateVerses" :disabled="!rawLyrics.trim()" title="Split lyrics into verses/paragraphs">Verses</button>
            <button @click="addCustom" title="Add blank custom track">+ Custom</button>
        </div>
        <p v-if="!rawLyrics.trim()" class="track-list-panel__hint">
            Paste lyrics below to enable Word / Line / Verse generation.
        </p>

        <div class="track-list-panel__list">
            <div
                v-for="track in tracks"
                :key="track.id"
                class="track-row"
                :class="{ muted: track.muted, locked: track.locked }"
            >
                <div class="track-row__color" :style="{ backgroundColor: track.color }"></div>
                <div class="track-row__name">
                    <template v-if="renamingId === track.id">
                        <input
                            v-model="renameValue"
                            class="track-rename-input"
                            @keydown.enter="commitRename(track)"
                            @blur="commitRename(track)"
                            autofocus
                        />
                    </template>
                    <template v-else>
                        <span @dblclick="startRename(track)" title="Double-click to rename">{{ track.name }}</span>
                    </template>
                </div>
                <div class="track-row__controls">
                    <button
                        class="track-btn"
                        :class="{ active: track.muted }"
                        @click="toggleMute(track)"
                        title="Mute track"
                    >Mute</button>
                    <button
                        class="track-btn"
                        :class="{ active: track.solo }"
                        @click="toggleSolo(track)"
                        title="Solo track"
                    >Solo</button>
                    <button
                        class="track-btn"
                        :class="{ active: track.locked }"
                        @click="toggleLock(track)"
                        title="Lock track (prevent edits)"
                    >Lock</button>
                    <button
                        class="track-btn"
                        @click="emit('duplicateTrack', track.id)"
                        title="Duplicate track"
                    >Dup</button>
                    <button
                        v-if="deletingId !== track.id"
                        class="track-btn danger"
                        @click="deletingId = track.id"
                        title="Delete track"
                    >&times;</button>
                    <template v-else>
                        <button class="track-btn danger" @click="emit('deleteTrack', track.id); deletingId = null;">Yes</button>
                        <button class="track-btn" @click="deletingId = null">No</button>
                    </template>
                </div>
            </div>
            <div v-if="!tracks.length" class="track-list-empty">
                No tracks yet. Paste lyrics below, then generate.
            </div>
        </div>
    </div>
</template>
