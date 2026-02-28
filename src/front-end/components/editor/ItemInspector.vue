<script setup lang="ts">
import { computed } from 'vue';
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

const onTextChange = (e: Event) => {
    const sel = selectedItem.value;
    if (!sel) return;
    emit('updateItem', { ...sel.item, text: (e.target as HTMLInputElement).value });
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
    if (!sel) return;
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
    if (!sel) return;
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
</script>

<template>
    <div class="item-inspector">
        <div class="item-inspector__header">
            <span class="item-inspector__title">Item Inspector</span>
        </div>

        <template v-if="selectedItem">
            <div class="inspector-field">
                <label>Text</label>
                <input
                    type="text"
                    :value="selectedItem.item.text"
                    @change="onTextChange"
                    class="inspector-input"
                />
            </div>

            <div class="inspector-field">
                <label>Track</label>
                <span class="inspector-value">{{ selectedItem.track.name }}</span>
            </div>

            <div class="inspector-row">
                <div class="inspector-field half">
                    <label>Start (ms)</label>
                    <input
                        type="number"
                        :value="selectedItem.item.startMs"
                        @change="onStartMsChange"
                        class="inspector-input"
                        min="0"
                        step="10"
                    />
                    <span class="inspector-hint">{{ formatMs(selectedItem.item.startMs) }}</span>
                </div>
                <div class="inspector-field half">
                    <label>End (ms)</label>
                    <input
                        type="number"
                        :value="selectedItem.item.endMs"
                        @change="onEndMsChange"
                        class="inspector-input"
                        min="0"
                        step="10"
                    />
                    <span class="inspector-hint">{{ formatMs(selectedItem.item.endMs) }}</span>
                </div>
            </div>

            <div class="inspector-field">
                <label>Duration</label>
                <span class="inspector-value">{{ formatMs(selectedItem.item.endMs - selectedItem.item.startMs) }}</span>
            </div>

            <div class="inspector-actions">
                <button
                    :disabled="!canSplit"
                    @click="emit('splitItem', selectedItem!.item.id, playheadMs)"
                    title="Split at playhead (S)"
                >Split</button>
                <button
                    :disabled="!canMerge"
                    @click="emit('mergeWithNext', selectedItem!.item.id)"
                    title="Merge with next item"
                >Merge</button>
                <button
                    class="danger"
                    @click="emit('deleteItem', selectedItem!.item.id)"
                    title="Delete item (Del)"
                >Delete</button>
            </div>
        </template>

        <div v-else class="inspector-empty">
            Select an item on the timeline to inspect
        </div>
    </div>
</template>
