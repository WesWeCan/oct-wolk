<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LyricTrack, MotionTrack, TimelineItem, ItemOverride } from '@/types/project_types';

const props = defineProps<{
    track: MotionTrack;
    lyricTracks: LyricTrack[];
    playheadMs: number;
    fps: number;
}>();

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'seek-to-ms', ms: number): void;
    (e: 'select-item', itemId: string | null): void;
}>();

const search = ref('');
const expandedItemId = ref<string | null>(null);

const rangeItems = computed<TimelineItem[]>(() => {
    const source = props.lyricTracks.find((t) => t.id === props.track.block.sourceTrackId);
    if (!source) return [];
    return source.items.filter((item) =>
        item.endMs > props.track.block.startMs && item.startMs < props.track.block.endMs,
    );
});

const filteredItems = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return rangeItems.value;
    return rangeItems.value.filter((item) => item.text.toLowerCase().includes(q));
});

const overrideMap = computed(() => {
    const m = new Map<string, ItemOverride>();
    for (const o of props.track.block.overrides) m.set(o.sourceItemId, o);
    return m;
});

const isAtPlayhead = (item: TimelineItem): boolean =>
    props.playheadMs >= item.startMs && props.playheadMs < item.endMs;

const hasOverride = (itemId: string): boolean => {
    const o = overrideMap.value.get(itemId);
    return !!(o && (o.hidden || o.textOverride || o.styleOverride || o.transformOverride || o.enterOverride || o.exitOverride || o.wordStyleMap));
};

const isHidden = (itemId: string): boolean => !!overrideMap.value.get(itemId)?.hidden;

const frameAt = (ms: number) => Math.round((ms / 1000) * Math.max(1, props.fps));

const getTextOverride = (itemId: string): string => {
    const o = overrideMap.value.get(itemId);
    return o?.textOverride ?? '';
};

const toggleExpand = (itemId: string) => {
    if (expandedItemId.value === itemId) {
        expandedItemId.value = null;
        emit('select-item', null);
    } else {
        expandedItemId.value = itemId;
        emit('select-item', itemId);
    }
};

const emitOverrides = (overrides: ItemOverride[]) => {
    if (props.track.locked) return;
    emit('update-track', { ...props.track, block: { ...props.track.block, overrides } });
};

const toggleHidden = (itemId: string) => {
    if (props.track.locked) return;
    const overrides = [...props.track.block.overrides];
    const idx = overrides.findIndex((o) => o.sourceItemId === itemId);
    const current = idx >= 0 ? overrides[idx] : null;
    const hidden = !(current?.hidden);

    if (idx >= 0) {
        overrides[idx] = { ...overrides[idx], hidden };
    } else {
        overrides.push({ sourceItemId: itemId, hidden });
    }

    if (!hidden) {
        const o = overrides.find((x) => x.sourceItemId === itemId);
        if (o && !o.textOverride && !o.styleOverride && !o.transformOverride && !o.enterOverride && !o.exitOverride && !o.wordStyleMap) {
            const i = overrides.findIndex((x) => x.sourceItemId === itemId);
            if (i >= 0) overrides.splice(i, 1);
        }
    }
    emitOverrides(overrides);
};

const updateTextOverride = (itemId: string, text: string) => {
    if (props.track.locked) return;
    const overrides = [...props.track.block.overrides];
    let idx = overrides.findIndex((o) => o.sourceItemId === itemId);
    if (idx < 0) {
        overrides.push({ sourceItemId: itemId, hidden: false });
        idx = overrides.length - 1;
    }
    overrides[idx] = { ...overrides[idx], textOverride: text || undefined };
    if (!text && !overrides[idx].hidden && !overrides[idx].styleOverride && !overrides[idx].transformOverride && !overrides[idx].enterOverride && !overrides[idx].exitOverride && !overrides[idx].wordStyleMap) {
        overrides.splice(idx, 1);
    }
    emitOverrides(overrides);
};

const clearOverride = (itemId: string) => {
    if (props.track.locked) return;
    const overrides = props.track.block.overrides.filter((o) => o.sourceItemId !== itemId);
    emitOverrides(overrides);
    expandedItemId.value = null;
    emit('select-item', null);
};
</script>

<template>
    <div class="motion-tab">
        <div class="motion-tab__field">
            <input v-model="search" class="inspector-input" placeholder="Search items..." />
        </div>

        <div v-if="filteredItems.length === 0" class="inspector-empty">
            No source items in range.
        </div>

        <div class="item-list">
            <div v-for="item in filteredItems" :key="item.id">
                <div
                    class="item-row"
                    :class="{ 'at-playhead': isAtPlayhead(item), hidden: isHidden(item.id), expanded: expandedItemId === item.id }"
                    @click="toggleExpand(item.id)"
                >
                    <button class="item-row__eye" :class="{ off: isHidden(item.id) }" title="Toggle visibility" @click.stop="toggleHidden(item.id)">
                        {{ isHidden(item.id) ? '&#8212;' : '&#9673;' }}
                    </button>
                    <span class="item-row__text" @click.stop="emit('seek-to-ms', item.startMs)">{{ item.text }}</span>
                    <span class="item-row__time">f{{ frameAt(item.startMs) }}</span>
                    <span v-if="hasOverride(item.id)" class="item-row__dot"></span>
                </div>

                <!-- Expanded inline editor -->
                <div v-if="expandedItemId === item.id" class="item-expand">
                    <div class="motion-tab__field">
                        <label>Text Override</label>
                        <input
                            type="text"
                            class="inspector-input"
                            :value="getTextOverride(item.id)"
                            :placeholder="item.text"
                            @change="updateTextOverride(item.id, ($event.target as HTMLInputElement).value)"
                        />
                        <span class="inspector-hint">Empty = use source text</span>
                    </div>
                    <div class="item-expand__actions">
                        <button class="btn-sm" @click.stop="emit('select-item', item.id)">Edit Style Override</button>
                        <button v-if="hasOverride(item.id)" class="btn-sm danger" @click.stop="clearOverride(item.id)">Clear All</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
