<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LyricTrack, MotionTrack } from '@/types/project_types';
import MotionItemOverrideEditor from '@/front-end/components/editor/MotionItemOverrideEditor.vue';

const props = defineProps<{
    motionTrack: MotionTrack | null;
    lyricTracks: LyricTrack[];
    backgroundImage?: string;
    backgroundColor: string;
    backgroundImageFit?: 'cover' | 'contain' | 'stretch';
}>();

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'set-background-color', color: string): void;
    (e: 'set-background-fit', fit: 'cover' | 'contain' | 'stretch'): void;
    (e: 'upload-background-image', file: File): void;
    (e: 'clear-background-image'): void;
}>();

const sourceMissing = computed(() => {
    if (!props.motionTrack) return false;
    return !props.lyricTracks.some((track) => track.id === props.motionTrack!.block.sourceTrackId);
});

const updateSourceTrack = (sourceTrackId: string) => {
    if (!props.motionTrack) return;
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            sourceTrackId,
        },
    });
};

const updateStartMs = (value: number) => {
    if (!props.motionTrack) return;
    const startMs = Math.max(0, Math.round(value));
    const endMs = Math.max(startMs + 100, props.motionTrack.block.endMs);
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            startMs,
            endMs,
        },
    });
};

const updateEndMs = (value: number) => {
    if (!props.motionTrack) return;
    const startMs = props.motionTrack.block.startMs;
    const endMs = Math.max(startMs + 100, Math.round(value));
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            endMs,
        },
    });
};

const updateStyle = <K extends keyof MotionTrack['block']['style']>(key: K, value: MotionTrack['block']['style'][K]) => {
    if (!props.motionTrack) return;
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            style: {
                ...props.motionTrack.block.style,
                [key]: value,
            },
        },
    });
};

const updateTransform = <K extends keyof MotionTrack['block']['transform']>(key: K, value: MotionTrack['block']['transform'][K]) => {
    if (!props.motionTrack) return;
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            transform: {
                ...props.motionTrack.block.transform,
                [key]: value,
            },
        },
    });
};

const updateEnterExit = (
    which: 'enter' | 'exit',
    key: keyof MotionTrack['block']['enter'],
    value: MotionTrack['block']['enter'][keyof MotionTrack['block']['enter']],
) => {
    if (!props.motionTrack) return;
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            [which]: {
                ...props.motionTrack.block[which],
                [key]: value,
            },
        },
    });
};

const toggleOverrideHidden = (itemId: string, hidden: boolean) => {
    if (!props.motionTrack) return;
    const overrides = [...props.motionTrack.block.overrides];
    const idx = overrides.findIndex((item) => item.sourceItemId === itemId);
    if (idx >= 0) {
        overrides[idx] = { ...overrides[idx], hidden };
    } else if (hidden) {
        overrides.push({ sourceItemId: itemId, hidden });
    }
    const clean = overrides.filter((item) => item.hidden || (item.textOverride && item.textOverride.trim().length > 0));
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            overrides: clean,
        },
    });
};

const updateOverrideText = (itemId: string, textOverride: string) => {
    if (!props.motionTrack) return;
    const overrides = [...props.motionTrack.block.overrides];
    const idx = overrides.findIndex((item) => item.sourceItemId === itemId);
    const normalizedText = textOverride ?? '';
    if (idx >= 0) {
        const next = { ...overrides[idx], textOverride: normalizedText };
        if (!next.hidden && (!next.textOverride || next.textOverride.trim().length === 0)) {
            overrides.splice(idx, 1);
        } else {
            overrides[idx] = next;
        }
    } else if (normalizedText.trim().length > 0) {
        overrides.push({ sourceItemId: itemId, hidden: false, textOverride: normalizedText });
    }
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            overrides,
        },
    });
};

const updateParam = (key: string, value: any) => {
    if (!props.motionTrack) return;
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            params: {
                ...(props.motionTrack.block.params || {}),
                [key]: value,
            },
        },
    });
};

const rangeItems = computed(() => {
    if (!props.motionTrack) return [];
    const source = props.lyricTracks.find((track) => track.id === props.motionTrack!.block.sourceTrackId);
    if (!source) return [];
    return source.items.filter((item) => item.endMs > props.motionTrack!.block.startMs && item.startMs < props.motionTrack!.block.endMs);
});

const overrideFor = (itemId: string) => props.motionTrack?.block.overrides.find((item) => item.sourceItemId === itemId) || null;
const editingOverrideItemId = ref<string | null>(null);
const hasRichOverride = (itemId: string): boolean => {
    const text = overrideFor(itemId)?.textOverride;
    if (!text) return false;
    try {
        const parsed = JSON.parse(text);
        return !!parsed && typeof parsed === 'object';
    } catch {
        return false;
    }
};
const backgroundFitValue = computed(() => props.backgroundImageFit || 'cover');
const onUploadBackgroundImage = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    emit('upload-background-image', file);
    input.value = '';
};
</script>

<template>
    <div class="item-inspector">
        <div class="item-inspector__header">
            <span class="item-inspector__title">Motion Inspector</span>
        </div>

        <div v-if="!motionTrack" class="inspector-empty">
            Select a motion track to edit source and timing.
        </div>

        <template v-else>
            <div class="inspector-field">
                <label>Type</label>
                <div class="inspector-value">{{ motionTrack.block.type }}</div>
                <span class="inspector-hint">Type is locked after creation. Delete and add a new track to change it.</span>
            </div>

            <div class="inspector-field">
                <label>Source Track</label>
                <select
                    class="inspector-input"
                    :value="motionTrack.block.sourceTrackId"
                    @change="updateSourceTrack(($event.target as HTMLSelectElement).value)"
                >
                    <option v-for="track in lyricTracks" :key="track.id" :value="track.id">
                        {{ track.name }}
                    </option>
                </select>
                <span v-if="sourceMissing" class="inspector-hint" style="color:#e57373;">
                    Source track missing. Reassign to render.
                </span>
            </div>

            <div class="inspector-row">
                <div class="inspector-field half">
                    <label>Start (ms)</label>
                    <input
                        type="number"
                        class="inspector-input"
                        :value="motionTrack.block.startMs"
                        @input="updateStartMs(Number(($event.target as HTMLInputElement).value || 0))"
                    />
                </div>
                <div class="inspector-field half">
                    <label>End (ms)</label>
                    <input
                        type="number"
                        class="inspector-input"
                        :value="motionTrack.block.endMs"
                        @input="updateEndMs(Number(($event.target as HTMLInputElement).value || 0))"
                    />
                </div>
            </div>

            <details class="inspector-section" open>
                <summary class="inspector-section__title">Style</summary>
                <div class="inspector-section__content">
                    <div class="inspector-row">
                        <div class="inspector-field half">
                            <label>Font Size</label>
                            <input type="number" class="inspector-input" :value="motionTrack.block.style.fontSize" @input="updateStyle('fontSize', Number(($event.target as HTMLInputElement).value || 8))" />
                        </div>
                        <div class="inspector-field half">
                            <label>Weight</label>
                            <input type="number" class="inspector-input" :value="motionTrack.block.style.fontWeight" @input="updateStyle('fontWeight', Number(($event.target as HTMLInputElement).value || 400))" />
                        </div>
                    </div>
                    <div class="inspector-row">
                        <div class="inspector-field half">
                            <label>Text Case</label>
                            <select class="inspector-input" :value="motionTrack.block.style.textCase" @change="updateStyle('textCase', ($event.target as HTMLSelectElement).value as any)">
                                <option value="none">None</option>
                                <option value="uppercase">UPPERCASE</option>
                                <option value="lowercase">lowercase</option>
                                <option value="capitalize">Capitalize</option>
                            </select>
                        </div>
                        <div class="inspector-field half">
                            <label>Opacity</label>
                            <input type="number" min="0" max="1" step="0.05" class="inspector-input" :value="motionTrack.block.style.opacity" @input="updateStyle('opacity', Number(($event.target as HTMLInputElement).value || 1))" />
                        </div>
                    </div>
                    <div class="inspector-row">
                        <div class="inspector-field half">
                            <label>Color</label>
                            <input type="color" class="inspector-input" :value="motionTrack.block.style.color" @input="updateStyle('color', ($event.target as HTMLInputElement).value)" />
                        </div>
                        <div class="inspector-field half">
                            <label>Background</label>
                            <input type="color" class="inspector-input" :value="motionTrack.block.style.backgroundColor || '#000000'" @input="updateStyle('backgroundColor', ($event.target as HTMLInputElement).value)" />
                        </div>
                    </div>
                </div>
            </details>

            <details class="inspector-section" open>
                <summary class="inspector-section__title">Transform</summary>
                <div class="inspector-section__content">
                    <div class="inspector-row">
                        <div class="inspector-field half">
                            <label>Anchor X</label>
                            <select class="inspector-input" :value="motionTrack.block.transform.anchorX" @change="updateTransform('anchorX', ($event.target as HTMLSelectElement).value as any)">
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                        <div class="inspector-field half">
                            <label>Anchor Y</label>
                            <select class="inspector-input" :value="motionTrack.block.transform.anchorY" @change="updateTransform('anchorY', ($event.target as HTMLSelectElement).value as any)">
                                <option value="top">Top</option>
                                <option value="center">Center</option>
                                <option value="bottom">Bottom</option>
                            </select>
                        </div>
                    </div>
                    <div class="inspector-row">
                        <div class="inspector-field half">
                            <label>Offset X</label>
                            <input type="number" class="inspector-input" :value="motionTrack.block.transform.offsetX" @input="updateTransform('offsetX', Number(($event.target as HTMLInputElement).value || 0))" />
                        </div>
                        <div class="inspector-field half">
                            <label>Offset Y</label>
                            <input type="number" class="inspector-input" :value="motionTrack.block.transform.offsetY" @input="updateTransform('offsetY', Number(($event.target as HTMLInputElement).value || 0))" />
                        </div>
                    </div>
                </div>
            </details>

            <details class="inspector-section" open>
                <summary class="inspector-section__title">Enter / Exit</summary>
                <div class="inspector-section__content">
                    <div class="inspector-row">
                        <div class="inspector-field half">
                            <label>Enter Style</label>
                            <select class="inspector-input" :value="motionTrack.block.enter.style" @change="updateEnterExit('enter', 'style', ($event.target as HTMLSelectElement).value as any)">
                                <option value="fade">Fade</option>
                                <option value="slideUp">Slide Up</option>
                                <option value="slideDown">Slide Down</option>
                                <option value="slideLeft">Slide Left</option>
                                <option value="slideRight">Slide Right</option>
                                <option value="scale">Scale</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                        <div class="inspector-field half">
                            <label>Exit Style</label>
                            <select class="inspector-input" :value="motionTrack.block.exit.style" @change="updateEnterExit('exit', 'style', ($event.target as HTMLSelectElement).value as any)">
                                <option value="fade">Fade</option>
                                <option value="slideUp">Slide Up</option>
                                <option value="slideDown">Slide Down</option>
                                <option value="slideLeft">Slide Left</option>
                                <option value="slideRight">Slide Right</option>
                                <option value="scale">Scale</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                    </div>
                    <div class="inspector-row">
                        <div class="inspector-field half">
                            <label>Enter Fraction</label>
                            <input type="number" class="inspector-input" min="0" max="1" step="0.05" :value="motionTrack.block.enter.fraction" @input="updateEnterExit('enter', 'fraction', Number(($event.target as HTMLInputElement).value || 0))" />
                        </div>
                        <div class="inspector-field half">
                            <label>Exit Fraction</label>
                            <input type="number" class="inspector-input" min="0" max="1" step="0.05" :value="motionTrack.block.exit.fraction" @input="updateEnterExit('exit', 'fraction', Number(($event.target as HTMLInputElement).value || 0))" />
                        </div>
                    </div>
                </div>
            </details>

            <details class="inspector-section" v-if="motionTrack.block.type === 'wordReveal'" open>
                <summary class="inspector-section__title">Type Parameters</summary>
                <div class="inspector-section__content">
                    <label class="overlay-toggle">
                        <input
                            type="checkbox"
                            :checked="!!motionTrack.block.params?.accumulate"
                            @change="updateParam('accumulate', ($event.target as HTMLInputElement).checked)"
                        />
                        Accumulate Words
                    </label>
                </div>
            </details>

            <details class="inspector-section">
                <summary class="inspector-section__title">Item Overrides</summary>
                <div class="inspector-section__content">
                    <div v-if="rangeItems.length === 0" class="inspector-empty">No source items in this block range.</div>
                    <div v-for="item in rangeItems" :key="item.id" class="track-row" style="display:block; padding:6px 0;">
                        <div style="display:flex; justify-content:space-between; gap:8px;">
                            <span class="track-row__name">{{ item.text }}</span>
                            <label class="overlay-toggle" style="padding:0;">
                                <input
                                    type="checkbox"
                                    :checked="!!overrideFor(item.id)?.hidden"
                                    @change="toggleOverrideHidden(item.id, ($event.target as HTMLInputElement).checked)"
                                />
                                Hidden
                            </label>
                        </div>
                        <div class="inspector-actions" style="margin-top:6px;">
                            <button @click="editingOverrideItemId = editingOverrideItemId === item.id ? null : item.id">
                                {{ editingOverrideItemId === item.id ? 'Close Rich Override' : 'Edit Rich Override' }}
                            </button>
                            <button @click="updateOverrideText(item.id, '')">
                                Reset to Default
                            </button>
                        </div>
                        <div class="inspector-hint" style="margin-top:4px;">
                            {{ hasRichOverride(item.id) ? 'Rich override applied' : (overrideFor(item.id)?.textOverride ? 'Plain override applied' : 'No text override') }}
                        </div>
                        <MotionItemOverrideEditor
                            v-if="editingOverrideItemId === item.id"
                            :model-value="overrideFor(item.id)?.textOverride || ''"
                            :source-text="item.text"
                            @update:model-value="updateOverrideText(item.id, $event)"
                            @reset="updateOverrideText(item.id, '')"
                            @cancel="editingOverrideItemId = null"
                        />
                    </div>
                </div>
            </details>

            <details class="inspector-section" open>
                <summary class="inspector-section__title">Background</summary>
                <div class="inspector-section__content">
                    <div class="inspector-row">
                        <div class="inspector-field half">
                            <label>Background Color</label>
                            <input
                                type="color"
                                class="inspector-input"
                                :value="backgroundColor === 'transparent' ? '#000000' : backgroundColor"
                                @input="emit('set-background-color', ($event.target as HTMLInputElement).value)"
                            />
                        </div>
                        <div class="inspector-field half">
                            <label>Transparent</label>
                            <label class="overlay-toggle" style="padding-top: 7px;">
                                <input
                                    type="checkbox"
                                    :checked="backgroundColor === 'transparent'"
                                    @change="emit('set-background-color', ($event.target as HTMLInputElement).checked ? 'transparent' : '#000000')"
                                />
                                Alpha
                            </label>
                        </div>
                    </div>
                    <div class="inspector-field">
                        <label>Background Image Fit</label>
                        <select
                            class="inspector-input"
                            :value="backgroundFitValue"
                            @change="emit('set-background-fit', ($event.target as HTMLSelectElement).value as any)"
                        >
                            <option value="cover">Cover</option>
                            <option value="contain">Contain</option>
                            <option value="stretch">Stretch</option>
                        </select>
                    </div>
                    <div class="inspector-field">
                        <label>Background Image</label>
                        <input type="file" accept="image/*" class="inspector-input" @change="onUploadBackgroundImage" />
                        <div class="inspector-hint" v-if="backgroundImage">{{ backgroundImage }}</div>
                        <button v-if="backgroundImage" class="btn-sm danger" style="margin-top:6px;" @click="emit('clear-background-image')">
                            Remove Background Image
                        </button>
                    </div>
                </div>
            </details>
        </template>
    </div>
</template>
