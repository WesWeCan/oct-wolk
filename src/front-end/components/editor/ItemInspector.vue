<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import type { TimelineItem, LyricTrack } from '@/types/project_types';

const props = defineProps<{
    tracks: LyricTrack[];
    selectedItemId: string | null;
    playheadMs: number;
}>();

const emit = defineEmits<{
    (e: 'updateItem', item: TimelineItem): void;
    (e: 'deleteItem', itemId: string): void;
    (e: 'splitItem', itemId: string, atMs: number): void;
    (e: 'mergeWithNext', itemId: string): void;
    (e: 'addItemAtLocation', payload: { trackId?: string; atMs: number }): void;
}>();

const selectedItem = computed(() => {
    if (!props.selectedItemId) return null;
    for (const track of props.tracks) {
        const item = track.items.find(i => i.id === props.selectedItemId);
        if (item) return { item, track };
    }
    return null;
});

const canSplit = computed(() => {
    const sel = selectedItem.value;
    if (!sel) return false;
    return props.playheadMs > sel.item.startMs && props.playheadMs < sel.item.endMs;
});

const canMerge = computed(() => {
    const sel = selectedItem.value;
    if (!sel) return false;
    const idx = sel.track.items.findIndex(i => i.id === sel.item.id);
    return idx >= 0 && idx < sel.track.items.length - 1;
});
const isSelectedTrackLocked = computed(() => !!selectedItem.value?.track.locked);

const editableTracks = computed(() => props.tracks.filter(t => !t.locked));
const verseTracks = computed(() => props.tracks.filter(t => t.kind === 'verse'));
const lineTracks = computed(() => props.tracks.filter(t => t.kind === 'sentence'));
const wordTracks = computed(() => props.tracks.filter(t => t.kind === 'word'));
const customTracks = computed(() => props.tracks.filter(t => t.kind === 'custom'));
const defaultAddTrack = computed(() => {
    const editable = editableTracks.value;
    if (!editable.length) return null;
    return (
        editable.find(t => t.kind === 'verse')
        || editable.find(t => t.kind === 'sentence')
        || editable.find(t => t.kind === 'word')
        || editable[0]
    );
});

const canAddAtLocation = computed(() => {
    const sel = selectedItem.value;
    if (sel) return !sel.track.locked;
    return !!defaultAddTrack.value;
});

const addAtPlayhead = () => {
    const sel = selectedItem.value;
    const fallbackTrackId = defaultAddTrack.value?.id;
    const trackId = sel?.track.id || fallbackTrackId;
    if (!trackId) return;
    emit('addItemAtLocation', { trackId, atMs: props.playheadMs });
};

const addAtPlayheadForTrack = (trackId: string) => {
    emit('addItemAtLocation', { trackId, atMs: props.playheadMs });
};

const canAddToTrack = (track: LyricTrack) => !track.locked;

const onTextChange = (e: Event) => {
    const sel = selectedItem.value;
    if (!sel || sel.track.locked) return;
    emit('updateItem', { ...sel.item, text: (e.target as HTMLTextAreaElement).value });
};

const MIN_DURATION_MS = 10;

const getNeighbors = () => {
    const sel = selectedItem.value;
    if (!sel) return { prev: null as TimelineItem | null, next: null as TimelineItem | null };
    const sorted = [...sel.track.items].sort((a, b) => a.startMs - b.startMs);
    const idx = sorted.findIndex(i => i.id === sel.item.id);
    return {
        prev: idx > 0 ? sorted[idx - 1] : null,
        next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
    };
};

const onStartMsChange = (e: Event) => {
    const sel = selectedItem.value;
    if (!sel || sel.track.locked) return;
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (isNaN(val)) return;
    const { prev } = getNeighbors();
    const minStart = prev ? prev.endMs : 0;
    const maxStart = sel.item.endMs - MIN_DURATION_MS;
    const clamped = Math.max(minStart, Math.min(maxStart, val));
    if (clamped !== sel.item.startMs) {
        emit('updateItem', { ...sel.item, startMs: clamped });
    }
};

const onEndMsChange = (e: Event) => {
    const sel = selectedItem.value;
    if (!sel || sel.track.locked) return;
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (isNaN(val)) return;
    const { next } = getNeighbors();
    const minEnd = sel.item.startMs + MIN_DURATION_MS;
    const maxEnd = next ? next.startMs : Infinity;
    const clamped = Math.max(minEnd, Math.min(maxEnd, val));
    if (clamped !== sel.item.endMs) {
        emit('updateItem', { ...sel.item, endMs: clamped });
    }
};

const formatMs = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const remainder = ms % 1000;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}.${String(remainder).padStart(3, '0')}`;
};

const trackGroups = computed(() => ([
    { title: 'Verses', kindLabel: 'Verse', tracks: verseTracks.value },
    { title: 'Lines', kindLabel: 'Line', tracks: lineTracks.value },
    { title: 'Words', kindLabel: 'Word', tracks: wordTracks.value },
    { title: 'Custom', kindLabel: 'Custom', tracks: customTracks.value },
]).filter((group) => group.tracks.length));
</script>

<template>
    <div class="item-inspector">
        <details class="inspector-section" open>
            <summary class="inspector-section__title">Lyric Items</summary>
            <div class="inspector-section__content">
                <div class="motion-tab style-v2">
                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Tracks</summary>
                        <div class="item-inspector__track-groups">
                            <div v-for="group in trackGroups" :key="group.title" class="track-group">
                                <div class="track-group__title">{{ group.title }}</div>
                                <div class="track-group__rows">
                                    <div
                                        v-for="track in group.tracks"
                                        :key="track.id"
                                        class="track-group__row"
                                        :style="{ '--track-color': track.color }"
                                    >
                                        <div class="track-group__info">
                                            <div class="track-group__copy">
                                                <span class="track-group__name">{{ track.name }}</span>
                                                <span class="track-group__meta">{{ group.kindLabel }}<span v-if="track.locked"> · Locked</span></span>
                                            </div>
                                        </div>
                                        <button class="track-group__add" :disabled="!canAddToTrack(track)" @click="addAtPlayheadForTrack(track.id)">
                                            <SvgIcon type="mdi" :path="mdiPlus" :size="14" />
                                            <span>Add at Playhead</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div v-if="!trackGroups.length" class="track-group__empty">No lyric tracks yet.</div>
                        </div>
                    </details>

                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Selected Item</summary>
                        <template v-if="selectedItem">
                            <div class="item-inspector__selected-track" :style="{ '--track-color': selectedItem.track.color }">
                                <span class="item-inspector__selected-dot"></span>
                                <div class="item-inspector__selected-copy">
                                    <span class="item-inspector__selected-name">{{ selectedItem.track.name }}</span>
                                    <span class="item-inspector__selected-meta">Track for this lyric item</span>
                                </div>
                            </div>

                            <div class="motion-tab__field">
                                <label>Text</label>
                                <textarea
                                    :value="selectedItem.item.text"
                                    @change="onTextChange"
                                    class="inspector-input"
                                    rows="3"
                                    :disabled="isSelectedTrackLocked"
                                ></textarea>
                            </div>

                            <div class="motion-tab__field">
                                <label>Start (ms)</label>
                                <input
                                    type="number"
                                    :value="selectedItem.item.startMs"
                                    @change="onStartMsChange"
                                    class="inspector-input"
                                    min="0"
                                    step="10"
                                    :disabled="isSelectedTrackLocked"
                                />
                                <span class="inspector-hint">{{ formatMs(selectedItem.item.startMs) }}</span>
                            </div>

                            <div class="motion-tab__field">
                                <label>End (ms)</label>
                                <input
                                    type="number"
                                    :value="selectedItem.item.endMs"
                                    @change="onEndMsChange"
                                    class="inspector-input"
                                    min="0"
                                    step="10"
                                    :disabled="isSelectedTrackLocked"
                                />
                                <span class="inspector-hint">{{ formatMs(selectedItem.item.endMs) }}</span>
                            </div>

                            <div class="motion-tab__field">
                                <label>Duration</label>
                                <div class="item-inspector__readout">{{ formatMs(selectedItem.item.endMs - selectedItem.item.startMs) }}</div>
                            </div>

                            <div class="item-inspector__actions">
                                <button
                                    class="item-inspector__pill"
                                    :disabled="!canSplit || isSelectedTrackLocked"
                                    @click="emit('splitItem', selectedItem!.item.id, playheadMs)"
                                    title="Split at playhead (S)"
                                >Split</button>
                                <button
                                    class="item-inspector__pill"
                                    :disabled="!canMerge || isSelectedTrackLocked"
                                    @click="emit('mergeWithNext', selectedItem!.item.id)"
                                    title="Merge with next item"
                                >Merge</button>
                                <button
                                    class="item-inspector__pill"
                                    :disabled="!canAddAtLocation || isSelectedTrackLocked"
                                    @click="addAtPlayhead"
                                    title="Add new item at playhead"
                                >
                                    <SvgIcon type="mdi" :path="mdiPlus" :size="14" />
                                    <span>Add at Playhead</span>
                                </button>
                                <button
                                    class="item-inspector__pill item-inspector__pill--danger"
                                    :disabled="isSelectedTrackLocked"
                                    @click="emit('deleteItem', selectedItem!.item.id)"
                                    title="Delete item (Del)"
                                >
                                    <SvgIcon type="mdi" :path="mdiTrashCanOutline" :size="12" />
                                </button>
                            </div>
                        </template>
                        <div v-else class="inspector-empty">
                            Select an item on the timeline to inspect.
                        </div>
                    </details>
                </div>
            </div>
        </details>
    </div>
</template>
