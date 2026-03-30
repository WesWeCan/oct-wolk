<script setup lang="ts">
import { ref } from 'vue';
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import { TRACK_COLORS, type LyricTrack, type MotionTrack } from '@/types/project_types';

const props = defineProps<{
    lyricTracks: LyricTrack[];
    motionTracks: MotionTrack[];
    selectedTrackId: string | null;
    plugins: Array<{ type: string; label: string; requiresSourceTrack: boolean }>;
}>();

const emit = defineEmits<{
    (e: 'add-track', payload: { type: MotionTrack['block']['type'] }): void;
    (e: 'delete-track', trackId: string): void;
    (e: 'select-track', trackId: string): void;
    (e: 'update-track', track: MotionTrack): void;
}>();

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

const canAddPlugin = (plugin: { requiresSourceTrack: boolean }) => !plugin.requiresSourceTrack || props.lyricTracks.length > 0;

const cycleTrackColor = (track: MotionTrack) => {
    const currentIndex = TRACK_COLORS.indexOf(track.color as (typeof TRACK_COLORS)[number]);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % TRACK_COLORS.length : 0;
    emit('update-track', {
        ...track,
        color: TRACK_COLORS[nextIndex],
    });
};
</script>

<template>
    <div class="track-list-panel">
        <div class="track-list-panel__header">
            <span class="track-list-panel__title">Motion Tracks</span>
        </div>

        <p class="track-list-panel__hint">
            Add a motion block track, then adjust source, layout, and animation in the plugin inspector.
        </p>

        <div class="track-list-panel__actions track-list-panel__actions">
            <button
                v-for="plugin in plugins"
                :key="plugin.type"
                class="track-list-panel__action"
                :disabled="!canAddPlugin(plugin)"
                @click="emit('add-track', { type: plugin.type })"
            >
                <SvgIcon type="mdi" :path="mdiPlus" :size="14" />
                <span>{{ plugin.label }}</span>
            </button>
        </div>
        <p class="track-list-panel__hint">
            In-repo motion block plugins register themselves here automatically.
        </p>

        <div v-if="lyricTracks.length === 0 && plugins.some((plugin) => plugin.requiresSourceTrack)" class="track-list-empty">
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
                <button
                    class="track-row__color"
                    :style="{ '--track-color': track.color }"
                    type="button"
                    title="Cycle track color"
                    @click.stop="cycleTrackColor(track)"
                ></button>
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
                    <button class="track-btn danger" title="Delete track" @click.stop="emit('delete-track', track.id)">
                        <SvgIcon type="mdi" :path="mdiTrashCanOutline" :size="12" />
                    </button>
                </div>
            </div>
            <div v-if="motionTracks.length === 0" class="track-list-empty">
                No motion tracks yet.
            </div>
        </div>
    </div>
</template>
