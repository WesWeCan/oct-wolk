<script setup lang="ts">
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiClose } from '@mdi/js';
import type { LyricTrack } from '@/types/project_types';
import {
    generateVerseTrack,
    createCustomTrack,
} from '@/front-end/utils/lyricTrackGenerators';

const props = defineProps<{
    tracks: LyricTrack[];
    rawLyrics: string;
    audioDurationMs: number;
    selectedVerseTrackId?: string | null;
    selectedLineTrackId?: string | null;
}>();

const emit = defineEmits<{
    (e: 'addTrack', track: LyricTrack): void;
    (e: 'generateLines'): void;
    (e: 'generateWords'): void;
    (e: 'deleteTrack', trackId: string): void;
}>();

const hasLyrics = () => !!props.rawLyrics.trim();
const effectiveDuration = () => props.audioDurationMs > 0 ? props.audioDurationMs : 180_000;

const generateVerses = () => {
    if (!hasLyrics()) return;
    emit('addTrack', generateVerseTrack(props.rawLyrics, effectiveDuration(), props.tracks.length));
};

const generateLines = () => {
    if (!hasLyrics() || !props.selectedVerseTrackId) return;
    emit('generateLines');
};

const generateWords = () => {
    if (!hasLyrics() || !props.selectedLineTrackId) return;
    emit('generateWords');
};

const addCustom = () => {
    emit('addTrack', createCustomTrack(props.tracks.length));
};

const deletingId = defineModel<string | null>('deletingId', { default: null });
</script>

<template>
    <div class="track-list-panel">
        <div class="track-list-panel__header">
            <span class="track-list-panel__title">Tracks</span>
        </div>

        <div class="track-list-panel__generators">
            <button @click="generateVerses" :disabled="!rawLyrics.trim()" title="Split lyrics into verses (separated by blank lines)">Verses</button>
            <button
                @click="generateLines"
                :disabled="!rawLyrics.trim() || !selectedVerseTrackId"
                title="Generate lines from the selected verse track and raw lyric lines"
            >Lines</button>
            <button
                @click="generateWords"
                :disabled="!rawLyrics.trim() || !selectedLineTrackId"
                title="Generate words from the selected line track and raw lyric lines"
            >Words</button>
            <button @click="addCustom" title="Add blank custom track">+ Custom</button>
        </div>
        <p v-if="!rawLyrics.trim()" class="track-list-panel__hint">
            Paste lyrics below to generate verse tracks.
        </p>
        <p v-else-if="!selectedVerseTrackId" class="track-list-panel__hint">
            Select a verse item first, then generate lines.
        </p>
        <p v-else-if="!selectedLineTrackId" class="track-list-panel__hint">
            Select a line item first, then generate words.
        </p>
        <p v-else class="track-list-panel__hint">
            Lines/words will be generated inside the timing windows of the selected source track.
        </p>

        <div class="track-list-panel__list">
            <div
                v-for="track in tracks"
                :key="track.id"
                class="track-row"
            >
                <div class="track-row__color" :style="{ backgroundColor: track.color }"></div>
                <div class="track-row__name">
                    <span>{{ track.name }}</span>
                </div>
                <div class="track-row__controls">
                    <button
                        v-if="deletingId !== track.id"
                        class="track-btn danger"
                        @click="deletingId = track.id"
                        title="Delete track"
                    >
                        <SvgIcon type="mdi" :path="mdiClose" :size="12" />
                    </button>
                    <template v-else>
                        <button class="track-btn danger" @click="emit('deleteTrack', track.id); deletingId = null;">Yes</button>
                        <button class="track-btn" @click="deletingId = null">No</button>
                    </template>
                </div>
            </div>
            <div v-if="!tracks.length" class="track-list-empty">
                No tracks yet. Paste lyrics and generate verses to start.
            </div>
        </div>
    </div>
</template>
