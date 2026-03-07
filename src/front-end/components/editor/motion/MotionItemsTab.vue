<script setup lang="ts">
import { computed, ref } from 'vue';
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiCrosshairs, mdiEye, mdiEyeOff, mdiPencilOutline } from '@mdi/js';
import type { LyricTrack, MotionTrack, TimelineItem, ItemOverride } from '@/types/project_types';

const props = defineProps<{
    track: MotionTrack;
    lyricTracks: LyricTrack[];
    playheadMs: number;
    fps: number;
    selectedItemId?: string | null;
}>();

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'seek-to-ms', ms: number): void;
    (e: 'select-item', itemId: string | null): void;
}>();

const search = ref('');

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

const toggleEditItem = (itemId: string) => emit('select-item', props.selectedItemId === itemId ? null : itemId);

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

</script>

<template>
    <div class="motion-tab">
        <div class="motion-tab__field">
            <input v-model="search" class="inspector-input" placeholder="Search items..." />
            <span class="inspector-hint">Text seeks. Pencil edits. Eye toggles visibility.</span>
        </div>

        <div v-if="filteredItems.length === 0" class="inspector-empty">
            No source items in range.
        </div>

        <div class="item-list">
            <div v-for="item in filteredItems" :key="item.id">
                <div
                    class="item-row"
                    :class="{
                        'at-playhead': isAtPlayhead(item),
                        hidden: isHidden(item.id),
                        selected: selectedItemId === item.id,
                    }"
                >
                    
                    <button
                        class="item-row__action item-row__edit"
                        :class="{ active: selectedItemId === item.id, altered: hasOverride(item.id) }"
                        data-tooltip="Edit overrides"
                        aria-label="Edit overrides"
                        @click.stop="toggleEditItem(item.id)"
                    >
                        <SvgIcon type="mdi" :path="mdiPencilOutline" :size="14" />
                    </button>
                    <button
                        class="item-row__action item-row__eye"
                        :class="{ off: isHidden(item.id) }"
                        :data-tooltip="isHidden(item.id) ? 'Show item' : 'Hide item'"
                        :aria-label="isHidden(item.id) ? 'Show item' : 'Hide item'"
                        @click.stop="toggleHidden(item.id)"
                    >
                        <SvgIcon type="mdi" :path="isHidden(item.id) ? mdiEyeOff : mdiEye" :size="14" />
                    </button>
                    <button
                        class="item-row__action item-row__seek"
                        data-tooltip="Seek to item start"
                        aria-label="Seek to item start"
                        @click.stop="emit('seek-to-ms', item.startMs)"
                    >
                        <SvgIcon type="mdi" :path="mdiCrosshairs" :size="14" />
                    </button>
                    <span class="item-row__text">{{ item.text }}</span>
                    <span class="item-row__time">f{{ frameAt(item.startMs) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
