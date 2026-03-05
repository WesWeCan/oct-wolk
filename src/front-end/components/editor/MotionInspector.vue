<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LyricTrack, MotionTrack, MotionStyle, MotionTransform, MotionEnterExit, AnchorX, AnchorY } from '@/types/project_types';
import MotionAppearanceTab from '@/front-end/components/editor/motion/MotionAppearanceTab.vue';
import MotionPositionTab from '@/front-end/components/editor/motion/MotionPositionTab.vue';
import MotionAnimationTab from '@/front-end/components/editor/motion/MotionAnimationTab.vue';
import MotionSafeAreaTab from '@/front-end/components/editor/motion/MotionSafeAreaTab.vue';
import MotionItemsTab from '@/front-end/components/editor/motion/MotionItemsTab.vue';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import { upsertKeyframe, removeKeyframeAtIndex, evalInterpolatedAtFrame } from '@/front-end/utils/tracks';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';

const props = defineProps<{
    motionTrack: MotionTrack | null;
    lyricTracks: LyricTrack[];
    backgroundImage?: string;
    backgroundColor: string;
    backgroundImageFit?: 'cover' | 'contain' | 'stretch';
    playheadMs?: number;
    fps?: number;
    projectFontFamily?: string;
    renderWidth?: number;
    renderHeight?: number;
}>();

const clampOffsetToSafeArea = (
    offset: number,
    anchor: 'left' | 'center' | 'right' | 'top' | 'bottom',
    padding: number,
    canvasSize: number,
    safeAreaOffset: number = 0,
): number => {
    const saMin = padding + safeAreaOffset;
    const saMax = canvasSize - padding + safeAreaOffset;

    let anchorPos: number;
    if (anchor === 'left' || anchor === 'top') anchorPos = saMin;
    else if (anchor === 'right' || anchor === 'bottom') anchorPos = saMax;
    else anchorPos = (saMin + saMax) / 2;

    const minOffset = saMin - anchorPos;
    const maxOffset = saMax - anchorPos;
    return Math.max(minOffset, Math.min(maxOffset, offset));
};

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'set-background-color', color: string): void;
    (e: 'set-background-fit', fit: 'cover' | 'contain' | 'stretch'): void;
    (e: 'upload-background-image', file: File): void;
    (e: 'clear-background-image'): void;
    (e: 'seek-to-ms', ms: number): void;
}>();

const selectedItemId = ref<string | null>(null);
const selectedWordIndex = ref<number | null>(null);

const sourceMissing = computed(() => {
    if (!props.motionTrack) return false;
    return !props.lyricTracks.some((track) => track.id === props.motionTrack!.block.sourceTrackId);
});

const currentFrame = computed(() => {
    const ms = props.playheadMs ?? 0;
    return Math.round((ms / 1000) * Math.max(1, props.fps ?? 60));
});

const fpsVal = computed(() => Math.max(1, props.fps ?? 60));
const isLocked = computed(() => !!props.motionTrack?.locked);

const startFrame = computed(() => {
    if (!props.motionTrack) return 0;
    return Math.round((props.motionTrack.block.startMs / 1000) * fpsVal.value);
});

const endFrame = computed(() => {
    if (!props.motionTrack) return 0;
    return Math.round((props.motionTrack.block.endMs / 1000) * fpsVal.value);
});

const formatFrameAndMs = (frame: number, ms: number): string => {
    return `Frame ${Math.max(0, Math.round(frame))} (${Math.max(0, Math.round(ms))} ms)`;
};

const editingItemLabel = computed(() => {
    if (!selectedItemId.value || !props.motionTrack) return null;
    const src = props.lyricTracks.find((t) => t.id === props.motionTrack!.block.sourceTrackId);
    return src?.items.find((i) => i.id === selectedItemId.value)?.text ?? null;
});

const selectedItemWords = computed<string[]>(() => {
    if (!editingItemLabel.value) return [];
    return editingItemLabel.value.split(/\s+/).filter(Boolean);
});

// --- Mutators ---

const updateSourceTrack = (sourceTrackId: string) => {
    if (!props.motionTrack || isLocked.value) return;
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, sourceTrackId } });
};

const updateStartFrame = (frame: number) => {
    if (!props.motionTrack || isLocked.value) return;
    const startMs = Math.max(0, Math.round((frame / fpsVal.value) * 1000));
    const endMs = Math.max(startMs + 100, props.motionTrack.block.endMs);
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, startMs, endMs } });
};

const updateEndFrame = (frame: number) => {
    if (!props.motionTrack || isLocked.value) return;
    const endMs = Math.round((frame / fpsVal.value) * 1000);
    const minEnd = props.motionTrack.block.startMs + 100;
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, endMs: Math.max(minEnd, endMs) } });
};

const autoKeyframe = (path: string, value: any, propertyTracks: any[]): any[] => {
    const ptIdx = propertyTracks.findIndex((pt: any) => pt.propertyPath === path);
    if (ptIdx < 0) return propertyTracks;
    if (propertyTracks[ptIdx].enabled === false) return propertyTracks;
    if (!propertyTracks[ptIdx].keyframes?.length) return propertyTracks;
    const def = getPropertyDef(path);
    const interp = def?.defaultInterpolation ?? 'linear';
    const updated = [...propertyTracks];
    updated[ptIdx] = upsertKeyframe(updated[ptIdx] as any, currentFrame.value, value, interp) as any;
    return updated;
};

const updateStyle = (key: keyof MotionStyle, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    if (selectedWordIndex.value !== null && selectedItemId.value) {
        updateWordStyle(key, value);
        return;
    }
    if (selectedItemId.value) {
        updateItemStyleOverride(selectedItemId.value, key, value);
        return;
    }
    const block = { ...props.motionTrack.block };
    block.style = { ...block.style, [key]: value };
    block.propertyTracks = autoKeyframe(`style.${key}`, value, [...(block.propertyTracks || [])]);
    emit('update-track', { ...props.motionTrack, block });
};

const updateTransform = (key: keyof MotionTransform, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    if (selectedItemId.value) {
        updateItemTransformOverride(selectedItemId.value, key, value);
        return;
    }
    const block = { ...props.motionTrack.block };

    if ((key === 'offsetX' || key === 'offsetY') && (block.style.boundsMode ?? 'safeArea') === 'safeArea') {
        const padding = block.style.safeAreaPadding ?? 40;
        const saOx = block.style.safeAreaOffsetX ?? 0;
        const saOy = block.style.safeAreaOffsetY ?? 0;
        if (key === 'offsetX' && props.renderWidth) {
            value = clampOffsetToSafeArea(value, block.transform.anchorX, padding, props.renderWidth, saOx);
        } else if (key === 'offsetY' && props.renderHeight) {
            value = clampOffsetToSafeArea(value, block.transform.anchorY, padding, props.renderHeight, saOy);
        }
    }

    block.transform = { ...block.transform, [key]: value };
    block.propertyTracks = autoKeyframe(`transform.${key}`, value, [...(block.propertyTracks || [])]);
    emit('update-track', { ...props.motionTrack, block });
};

const updateAnchor = (x: AnchorX, y: AnchorY) => {
    if (!props.motionTrack || isLocked.value) return;
    emit('update-track', {
        ...props.motionTrack,
        block: { ...props.motionTrack.block, transform: { ...props.motionTrack.block.transform, anchorX: x, anchorY: y } },
    });
};

const updateEnterExit = (which: 'enter' | 'exit', key: keyof MotionEnterExit, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    if (selectedItemId.value) {
        updateItemEnterExitOverride(selectedItemId.value, which, key, value);
        return;
    }
    emit('update-track', {
        ...props.motionTrack,
        block: { ...props.motionTrack.block, [which]: { ...props.motionTrack.block[which], [key]: value } },
    });
};

const updateStyleGlobalOpacity = (value: number) => updateStyle('globalOpacity' as any, value);

// --- Reset / default keyframe ---

const resetToDefaults = () => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    block.transform = {
        ...block.transform,
        offsetX: 0, offsetY: 0, scale: 1, rotation: 0,
    };
    emit('update-track', { ...props.motionTrack, block });
};

const setDefaultKeyframe = () => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    let propertyTracks = [...(block.propertyTracks || [])];
    const defaults: Record<string, number> = {
        'transform.offsetX': 0, 'transform.offsetY': 0,
        'transform.scale': 1, 'transform.rotation': 0,
    };
    for (const [path, value] of Object.entries(defaults)) {
        propertyTracks = autoKeyframe(path, value, propertyTracks);
    }
    block.transform = {
        ...block.transform,
        offsetX: 0, offsetY: 0, scale: 1, rotation: 0,
    };
    block.propertyTracks = propertyTracks;
    emit('update-track', { ...props.motionTrack, block });
};

// --- Keyframe toggling ---

const toggleKeyframe = (path: string, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    const propertyTracks = [...(block.propertyTracks || [])];
    const frame = currentFrame.value;
    let ptIdx = propertyTracks.findIndex((pt) => pt.propertyPath === path);

    // Diamond-first: if property track doesn't exist yet, auto-create it with
    // the first keyframe at current frame (implicit enable on first diamond click)
    if (ptIdx < 0) {
        const def = getPropertyDef(path);
        const interp = def?.defaultInterpolation ?? 'linear';
        propertyTracks.push({
            propertyPath: path,
            keyframes: [{ frame, value, interpolation: interp }],
            enabled: true,
        });
        emit('update-track', { ...props.motionTrack, block: { ...block, propertyTracks } });
        return;
    }

    const pt = { ...propertyTracks[ptIdx] };

    // If track exists but is disabled, re-enable and add keyframe
    if (pt.enabled === false) {
        pt.enabled = true;
        const def = getPropertyDef(path);
        const interp = def?.defaultInterpolation ?? 'linear';
        propertyTracks[ptIdx] = upsertKeyframe(pt as any, frame, value, interp) as any;
        emit('update-track', { ...props.motionTrack, block: { ...block, propertyTracks } });
        return;
    }

    const sorted = [...(pt.keyframes || [])].sort((a, b) => a.frame - b.frame);
    const existingIdx = sorted.findIndex((kf) => kf.frame === frame);
    const def = getPropertyDef(path);
    const interp = def?.defaultInterpolation ?? 'linear';

    if (existingIdx >= 0) {
        propertyTracks[ptIdx] = removeKeyframeAtIndex(pt as any, existingIdx) as any;
    } else {
        propertyTracks[ptIdx] = upsertKeyframe(pt as any, frame, value, interp) as any;
    }
    emit('update-track', { ...props.motionTrack, block: { ...block, propertyTracks } });
};

const togglePropertyKeyframing = (path: string) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    const propertyTracks = [...(block.propertyTracks || [])];
    const ptIdx = propertyTracks.findIndex((pt) => pt.propertyPath === path);

    if (ptIdx >= 0) {
        const pt = propertyTracks[ptIdx];
        const animVal = evalInterpolatedAtFrame(pt as any, currentFrame.value, undefined);
        if (animVal !== undefined) {
            const parts = path.split('.');
            const section = parts[0];
            const key = parts[1];
            if (section === 'style') {
                block.style = { ...block.style, [key]: animVal };
            } else if (section === 'transform') {
                block.transform = { ...block.transform, [key]: animVal };
            }
        }
        propertyTracks.splice(ptIdx, 1);
    } else {
        const def = getPropertyDef(path);
        const value = def?.getValue(props.motionTrack.block);
        const frame = currentFrame.value;
        const interp = def?.defaultInterpolation ?? 'linear';
        propertyTracks.push({
            propertyPath: path,
            keyframes: [{ frame, value, interpolation: interp }],
            enabled: true,
        });
    }
    emit('update-track', { ...props.motionTrack, block: { ...block, propertyTracks } });
};

// --- Item override helpers ---

const getOrCreateOverride = (itemId: string) => {
    if (!props.motionTrack || isLocked.value) return { overrides: [], idx: -1, override: null as any };
    const overrides = [...props.motionTrack.block.overrides];
    let idx = overrides.findIndex((o) => o.sourceItemId === itemId);
    if (idx < 0) {
        overrides.push({ sourceItemId: itemId, hidden: false });
        idx = overrides.length - 1;
    }
    return { overrides, idx, override: overrides[idx] };
};

const updateItemStyleOverride = (itemId: string, key: keyof MotionStyle, value: any) => {
    if (!props.motionTrack) return;
    const { overrides, idx } = getOrCreateOverride(itemId);
    overrides[idx] = { ...overrides[idx], styleOverride: { ...(overrides[idx].styleOverride || {}), [key]: value } };
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const updateItemTransformOverride = (itemId: string, key: keyof MotionTransform, value: any) => {
    if (!props.motionTrack) return;
    const { overrides, idx } = getOrCreateOverride(itemId);
    overrides[idx] = { ...overrides[idx], transformOverride: { ...(overrides[idx].transformOverride || {}), [key]: value } };
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const updateItemEnterExitOverride = (itemId: string, which: 'enter' | 'exit', key: keyof MotionEnterExit, value: any) => {
    if (!props.motionTrack) return;
    const overrideKey = which === 'enter' ? 'enterOverride' : 'exitOverride';
    const { overrides, idx } = getOrCreateOverride(itemId);
    overrides[idx] = { ...overrides[idx], [overrideKey]: { ...((overrides[idx] as any)[overrideKey] || {}), [key]: value } };
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const clearItemSelection = () => {
    selectedItemId.value = null;
    selectedWordIndex.value = null;
};

const onSelectItem = (itemId: string | null) => {
    selectedItemId.value = itemId;
    selectedWordIndex.value = null;
};

const onSelectWord = (idx: number) => {
    selectedWordIndex.value = selectedWordIndex.value === idx ? null : idx;
};

const updateWordStyle = (key: keyof MotionStyle, value: any) => {
    if (!props.motionTrack || isLocked.value || !selectedItemId.value || selectedWordIndex.value === null) return;
    const overrides = [...props.motionTrack.block.overrides];
    let idx = overrides.findIndex((o) => o.sourceItemId === selectedItemId.value);
    if (idx < 0) {
        overrides.push({ sourceItemId: selectedItemId.value, hidden: false });
        idx = overrides.length - 1;
    }
    const existing = overrides[idx].wordStyleMap || {};
    const wordEntry = { ...(existing[selectedWordIndex.value!] || {}), [key]: value };
    overrides[idx] = { ...overrides[idx], wordStyleMap: { ...existing, [selectedWordIndex.value!]: wordEntry } };
    emit('update-track', { ...props.motionTrack, block: { ...props.motionTrack.block, overrides } });
};

const hasWordOverride = (wordIdx: number): boolean => {
    if (!selectedItemId.value || !props.motionTrack) return false;
    const o = props.motionTrack.block.overrides.find((x) => x.sourceItemId === selectedItemId.value);
    return !!(o?.wordStyleMap && o.wordStyleMap[wordIdx]);
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
    <div class="project-inspector motion-inspector">
        <div v-if="!motionTrack" class="inspector-empty">
            Select a motion track to edit.
        </div>

        <template v-else>
            <!-- Item editing banner -->
            <div v-if="selectedItemId && editingItemLabel" class="motion-inspector__item-banner">
                <span class="motion-inspector__item-label">
                    Editing: <strong>{{ selectedWordIndex !== null ? selectedItemWords[selectedWordIndex] : editingItemLabel }}</strong>
                    <template v-if="selectedWordIndex !== null"> <span style="color:#666;">(word)</span></template>
                </span>
                <button class="btn-sm" @click="selectedWordIndex !== null ? (selectedWordIndex = null) : clearItemSelection()">
                    {{ selectedWordIndex !== null ? 'Back to item' : 'Back to block' }}
                </button>
            </div>
            <!-- Per-word chips -->
            <div v-if="selectedItemId && selectedItemWords.length > 1" class="motion-inspector__word-chips">
                <button
                    v-for="(word, wi) in selectedItemWords"
                    :key="wi"
                    class="word-chip"
                    :class="{ active: selectedWordIndex === wi, 'has-override': hasWordOverride(wi) }"
                    @click="onSelectWord(wi)"
                >{{ word }}</button>
            </div>

            <!-- Source + timing -->
            <details class="inspector-section" open>
                <summary class="inspector-section__title">Source &amp; Timing</summary>
                <div class="inspector-section__content">
                    <div class="inspector-field">
                        <label>Source Track</label>
                        <select class="inspector-input" :value="motionTrack.block.sourceTrackId" @change="updateSourceTrack(($event.target as HTMLSelectElement).value)">
                            <option v-for="track in lyricTracks" :key="track.id" :value="track.id">{{ track.name }}</option>
                        </select>
                        <span v-if="sourceMissing" class="inspector-hint" style="color:#e57373;">Source track missing.</span>
                    </div>
                    <AnimatableNumberField
                        class="motion-inspector__timing-field"
                        label="Start Frame"
                        :model-value="startFrame"
                        :min="0"
                        :step="1"
                        :fallback-value="0"
                        :hint="formatFrameAndMs(startFrame, motionTrack.block.startMs)"
                        :scrub-per-px="0.2"
                        @update:model-value="updateStartFrame"
                    />
                    <AnimatableNumberField
                        class="motion-inspector__timing-field"
                        label="End Frame"
                        :model-value="endFrame"
                        :min="0"
                        :step="1"
                        :fallback-value="0"
                        :hint="formatFrameAndMs(endFrame, motionTrack.block.endMs)"
                        :scrub-per-px="0.2"
                        @update:model-value="updateEndFrame"
                    />
                </div>
            </details>

            <!-- Style -->
            <details class="inspector-section" open>
                <summary class="inspector-section__title">Style</summary>
                <div class="inspector-section__content">
                    <MotionAppearanceTab
                        :track="motionTrack"
                        :current-frame="currentFrame"
                        :project-font-family="projectFontFamily"
                        @update-style="updateStyle"
                        @toggle-keyframe="toggleKeyframe"
                        @toggle-property-keyframing="togglePropertyKeyframing"
                    />
                </div>
            </details>

            <!-- Position -->
            <details class="inspector-section" open>
                <summary class="inspector-section__title">Position</summary>
                <div class="inspector-section__content">
                    <MotionPositionTab
                        :track="motionTrack"
                        :current-frame="currentFrame"
                        :render-width="props.renderWidth"
                        :render-height="props.renderHeight"
                        @update-transform="updateTransform"
                        @update-anchor="updateAnchor"
                        @toggle-keyframe="toggleKeyframe"
                        @toggle-property-keyframing="togglePropertyKeyframing"
                        @reset-to-defaults="resetToDefaults"
                        @set-default-keyframe="setDefaultKeyframe"
                    />
                </div>
            </details>

            <!-- Safe Area -->
            <details class="inspector-section" open>
                <summary class="inspector-section__title">Safe Area</summary>
                <div class="inspector-section__content">
                    <MotionSafeAreaTab
                        :track="motionTrack"
                        :current-frame="currentFrame"
                        @update-style="updateStyle"
                        @toggle-keyframe="toggleKeyframe"
                        @toggle-property-keyframing="togglePropertyKeyframing"
                    />
                </div>
            </details>

            <!-- Animation -->
            <details class="inspector-section" open>
                <summary class="inspector-section__title">Animation</summary>
                <div class="inspector-section__content">
                    <MotionAnimationTab
                        :track="motionTrack"
                        @update-enter-exit="updateEnterExit"
                    />
                </div>
            </details>

            <!-- Items -->
            <details class="inspector-section" open>
                <summary class="inspector-section__title">Items</summary>
                <div class="inspector-section__content">
                    <MotionItemsTab
                        :track="motionTrack"
                        :lyric-tracks="lyricTracks"
                        :playhead-ms="playheadMs ?? 0"
                        :fps="fps ?? 60"
                        @update-track="$emit('update-track', $event)"
                        @seek-to-ms="$emit('seek-to-ms', $event)"
                        @select-item="onSelectItem"
                    />
                </div>
            </details>

            <!-- Background -->
            <details class="inspector-section">
                <summary class="inspector-section__title">Background</summary>
                <div class="inspector-section__content">
                    <div class="motion-tab__row">
                        <div class="inspector-field" style="flex:1;">
                            <label>Color</label>
                            <input type="color" class="inspector-input" :value="backgroundColor === 'transparent' ? '#000000' : backgroundColor" @input="emit('set-background-color', ($event.target as HTMLInputElement).value)" />
                        </div>
                        <div class="inspector-field" style="flex:1;">
                            <label>Transparent</label>
                            <label class="overlay-toggle" style="padding-top:4px;">
                                <input type="checkbox" :checked="backgroundColor === 'transparent'" @change="emit('set-background-color', ($event.target as HTMLInputElement).checked ? 'transparent' : '#000000')" /> Alpha
                            </label>
                        </div>
                    </div>
                    <div class="inspector-field">
                        <label>Image Fit</label>
                        <select class="inspector-input" :value="backgroundFitValue" @change="emit('set-background-fit', ($event.target as HTMLSelectElement).value as any)">
                            <option value="cover">Cover</option>
                            <option value="contain">Contain</option>
                            <option value="stretch">Stretch</option>
                        </select>
                    </div>
                    <div class="inspector-field">
                        <label>Image</label>
                        <input type="file" accept="image/*" class="inspector-input" @change="onUploadBackgroundImage" />
                        <span v-if="backgroundImage" class="inspector-hint">{{ backgroundImage }}</span>
                        <button v-if="backgroundImage" class="btn-sm danger" style="margin-top:4px;" @click="emit('clear-background-image')">Remove</button>
                    </div>
                </div>
            </details>
        </template>
    </div>
</template>
