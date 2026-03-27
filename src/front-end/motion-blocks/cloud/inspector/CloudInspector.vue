<script setup lang="ts">
import { computed } from 'vue';
import type { LyricTrack, MotionEnterExit, MotionStyle, MotionTrack, WolkProjectFont } from '@/types/project_types';
import MotionAppearanceTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionAppearanceTab.vue';
import CloudSafeAreaTab from '@/front-end/motion-blocks/cloud/inspector/tabs/CloudSafeAreaTab.vue';
import MotionEnterExitEditor from '@/front-end/components/editor/motion/MotionEnterExitEditor.vue';
import MotionTextRevealEditor from '@/front-end/components/editor/motion/MotionTextRevealEditor.vue';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import { applyFontSelectionToMotionStyle } from '@/front-end/utils/fonts/fontUtils';
import type { MotionFontSelection } from '@/front-end/utils/fonts/fontUtils';
import { upsertKeyframe, removeKeyframeAtIndex, evalInterpolatedAtFrame } from '@/front-end/utils/tracks';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';
import {
    isCloudSupportedSourceTrack,
    listCloudSupportedSourceTracks,
} from '@/front-end/motion-blocks/cloud/source-tracks';
import { createDefaultCloudEnter, createDefaultCloudExit } from '@/front-end/motion-blocks/cloud/defaults';
import { resolveCloudLayoutParams } from '@/front-end/motion-blocks/cloud/params';
import type { CloudExitMode } from '@/front-end/motion-blocks/cloud/params';
import type { TextRevealParams } from '@/front-end/utils/motion/textReveal';
import {
    cloneMotionEnterExit,
    createMotionVisualOffEnterExit,
    motionEnterExitEquals,
} from '@/front-end/utils/motion/motionEnterExitPresets';

const props = defineProps<{
    motionTrack: MotionTrack | null;
    lyricTracks: LyricTrack[];
    playheadMs?: number;
    fps?: number;
    projectFont?: WolkProjectFont;
    renderWidth?: number;
    renderHeight?: number;
}>();

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'seek-to-ms', ms: number): void;
}>();

const currentFrame = computed(() => {
    const ms = props.playheadMs ?? 0;
    return Math.round((ms / 1000) * Math.max(1, props.fps ?? 60));
});

const fpsVal = computed(() => Math.max(1, props.fps ?? 60));
const isLocked = computed(() => !!props.motionTrack?.locked);
const supportedTracks = computed(() => listCloudSupportedSourceTracks(props.lyricTracks));

const sourceMissing = computed(() => {
    if (!props.motionTrack) return false;
    return !props.lyricTracks.some((track) => track.id === props.motionTrack!.block.sourceTrackId);
});

const sourceTrack = computed(() => {
    if (!props.motionTrack) return null;
    return props.lyricTracks.find((track) => track.id === props.motionTrack!.block.sourceTrackId) ?? null;
});

const hasSupportedSource = computed(() => isCloudSupportedSourceTrack(sourceTrack.value));
const hasAnySupportedTracks = computed(() => supportedTracks.value.length > 0);
const sourceWarning = computed(() => {
    if (sourceMissing.value) return 'Source track missing.';
    if (!hasAnySupportedTracks.value) return 'Cloud can only use word tracks. Create or switch to a word track first.';
    if (!hasSupportedSource.value) return 'Cloud can only use word tracks. Select a word track to render this block.';
    return null;
});

const layoutParams = computed(() => {
    if (!props.motionTrack) return resolveCloudLayoutParams(null);
    return resolveCloudLayoutParams(props.motionTrack.block.params);
});

const inRangeItems = computed(() => {
    if (!props.motionTrack || !hasSupportedSource.value || !sourceTrack.value) return [];
    return sourceTrack.value.items.filter((item) => item.endMs > props.motionTrack!.block.startMs && item.startMs < props.motionTrack!.block.endMs);
});

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

const autoKeyframe = (path: string, value: any, propertyTracks: any[]): any[] => {
    const ptIdx = propertyTracks.findIndex((propertyTrack: any) => propertyTrack.propertyPath === path);
    if (ptIdx < 0) return propertyTracks;
    if (propertyTracks[ptIdx].enabled === false) return propertyTracks;
    if (!propertyTracks[ptIdx].keyframes?.length) return propertyTracks;
    const def = getPropertyDef(path);
    const interp = def?.defaultInterpolation ?? 'linear';
    const updated = [...propertyTracks];
    updated[ptIdx] = upsertKeyframe(updated[ptIdx] as any, currentFrame.value, value, interp) as any;
    return updated;
};

const updateParam = (key: string, value: number | string) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    block.params = { ...(block.params || {}), [key]: value };
    emit('update-track', { ...props.motionTrack, block });
};

const updateExitMode = (mode: CloudExitMode) => updateParam('exitMode', mode);
const blockMotionStillAtDefaults = (): boolean => {
    if (!props.motionTrack) return false;
    return motionEnterExitEquals(props.motionTrack.block.enter, createDefaultCloudEnter())
        && motionEnterExitEquals(props.motionTrack.block.exit, createDefaultCloudExit());
};

const updateTextReveal = (value: TextRevealParams) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    const shouldAutoApplyMotionOff = layoutParams.value.textRevealMode !== 'typewriter'
        && value.textRevealMode === 'typewriter'
        && blockMotionStillAtDefaults();
    block.enter = shouldAutoApplyMotionOff
        ? createMotionVisualOffEnterExit(block.enter)
        : block.enter;
    block.exit = shouldAutoApplyMotionOff
        ? createMotionVisualOffEnterExit(block.exit)
        : block.exit;
    block.params = { ...(block.params || {}), ...value };
    emit('update-track', { ...props.motionTrack, block });
};

const updateEnterExit = (which: 'enter' | 'exit', value: MotionEnterExit) => {
    if (!props.motionTrack || isLocked.value) return;
    emit('update-track', {
        ...props.motionTrack,
        block: { ...props.motionTrack.block, [which]: cloneMotionEnterExit(value) },
    });
};

const updateSourceTrack = (sourceTrackId: string) => {
    if (!props.motionTrack || isLocked.value) return;
    if (!supportedTracks.value.some((track) => track.id === sourceTrackId)) return;
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

const updateStyle = (key: keyof MotionStyle, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    block.style = { ...block.style, [key]: value };
    block.propertyTracks = autoKeyframe(`style.${key}`, value, [...(block.propertyTracks || [])]);
    emit('update-track', { ...props.motionTrack, block });
};

const updateFontSelection = (selection: MotionFontSelection) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    block.style = applyFontSelectionToMotionStyle(block.style, selection);
    block.propertyTracks = autoKeyframe('style.fontFamily', selection.family, [...(block.propertyTracks || [])]);
    emit('update-track', { ...props.motionTrack, block });
};

const toggleKeyframe = (path: string, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    const propertyTracks = [...(block.propertyTracks || [])];
    const frame = currentFrame.value;
    const ptIdx = propertyTracks.findIndex((propertyTrack) => propertyTrack.propertyPath === path);

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
    if (pt.enabled === false) {
        pt.enabled = true;
        const def = getPropertyDef(path);
        const interp = def?.defaultInterpolation ?? 'linear';
        propertyTracks[ptIdx] = upsertKeyframe(pt as any, frame, value, interp) as any;
        emit('update-track', { ...props.motionTrack, block: { ...block, propertyTracks } });
        return;
    }

    const sorted = [...(pt.keyframes || [])].sort((a, b) => a.frame - b.frame);
    const existingIdx = sorted.findIndex((keyframe) => keyframe.frame === frame);
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
    const ptIdx = propertyTracks.findIndex((propertyTrack) => propertyTrack.propertyPath === path);

    if (ptIdx >= 0) {
        const pt = propertyTracks[ptIdx];
        const animatedValue = evalInterpolatedAtFrame(pt as any, currentFrame.value, undefined);
        if (animatedValue !== undefined) {
            const [section, key] = path.split('.');
            if (section === 'style') block.style = { ...block.style, [key]: animatedValue };
            if (section === 'transform') block.transform = { ...block.transform, [key]: animatedValue };
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
</script>

<template>
    <div class="motion-inspector">
        <div v-if="!motionTrack" class="inspector-empty">
            Select a motion track to edit.
        </div>

        <template v-else>
            <details class="inspector-section" open>
                <summary class="inspector-section__title">Source &amp; Timing</summary>
                <div class="inspector-section__content">
                    <div class="inspector-field">
                        <label>Source Track</label>
                        <select
                            class="inspector-input"
                            :value="hasSupportedSource ? motionTrack.block.sourceTrackId : ''"
                            :disabled="!hasAnySupportedTracks"
                            @change="updateSourceTrack(($event.target as HTMLSelectElement).value)"
                        >
                            <option v-if="!hasSupportedSource" value="" disabled>
                                Only word tracks supported
                            </option>
                            <option v-for="track in supportedTracks" :key="track.id" :value="track.id">{{ track.name }}</option>
                        </select>
                        <span v-if="sourceWarning" class="inspector-hint" style="color:#e57373;">{{ sourceWarning }}</span>
                        <span v-else class="inspector-hint">{{ inRangeItems.length }} lyric items currently contribute to this cloud.</span>
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

            <details class="inspector-section" open>
                <summary class="inspector-section__title">Layout</summary>
                <div class="inspector-section__content">
                    <AnimatableNumberField
                        label="Gap"
                        :model-value="layoutParams.gap"
                        :min="0"
                        :max="100"
                        :step="1"
                        :fallback-value="12"
                        hint="Spacing between words in pixels. For tighter packing, lower Style -> Background Padding too."
                        @update:model-value="(v: number) => updateParam('gap', v)"
                    />
                    <AnimatableNumberField
                        label="Scatter"
                        :model-value="layoutParams.scatter"
                        :min="0"
                        :max="1"
                        :step="0.01"
                        :fallback-value="0.7"
                        hint="How spread out words are placed (0 = clustered center, 1 = fill region)."
                        @update:model-value="(v: number) => updateParam('scatter', v)"
                    />
                    <AnimatableNumberField
                        label="Size Variation"
                        :model-value="layoutParams.sizeVariation"
                        :min="0"
                        :max="0.7"
                        :step="0.01"
                        :fallback-value="0.3"
                        hint="Random per-word size variation (0 = all same size)."
                        @update:model-value="(v: number) => updateParam('sizeVariation', v)"
                    />
                </div>
            </details>

            <details class="inspector-section">
                <summary class="inspector-section__title">Style</summary>
                <div class="inspector-section__content">
                    <MotionAppearanceTab
                        :track="motionTrack"
                        :current-frame="currentFrame"
                        :project-font="projectFont"
                        @update-style="updateStyle"
                        @update-font="updateFontSelection"
                        @toggle-keyframe="toggleKeyframe"
                        @toggle-property-keyframing="togglePropertyKeyframing"
                    />
                </div>
            </details>

            <details class="inspector-section">
                <summary class="inspector-section__title">Constraint Region</summary>
                <div class="inspector-section__content">
                    <CloudSafeAreaTab
                        :track="motionTrack"
                        :current-frame="currentFrame"
                        @update-style="updateStyle"
                        @toggle-keyframe="toggleKeyframe"
                        @toggle-property-keyframing="togglePropertyKeyframing"
                    />
                </div>
            </details>

            <details class="inspector-section">
                <summary class="inspector-section__title">Animation</summary>
                <div class="inspector-section__content">
                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Text Reveal</summary>
                        <MotionTextRevealEditor
                            :value="layoutParams"
                            :disabled="isLocked"
                            @update-text-reveal="updateTextReveal"
                        />
                    </details>

                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Lifecycle</summary>
                        <div class="inspector-field">
                            <span class="inspector-hint">Controls when each word starts exiting inside the cloud.</span>
                        </div>

                        <div class="inspector-field">
                            <label>Exit Behavior</label>
                            <div class="segmented-control">
                                <button
                                    :class="{ active: layoutParams.exitMode === 'stay' }"
                                    @click="updateExitMode('stay')"
                                >Stay Until Block Exit</button>
                                <button
                                    :class="{ active: layoutParams.exitMode === 'perItem' }"
                                    @click="updateExitMode('perItem')"
                                >Exit Per Word</button>
                            </div>
                        </div>

                        <AnimatableNumberField
                            v-if="layoutParams.exitMode === 'perItem'"
                            label="Exit Delay (ms)"
                            :model-value="layoutParams.exitDelayMs"
                            :min="0"
                            :max="60000"
                            :step="50"
                            :fallback-value="0"
                            hint="Delay in milliseconds after a word ends before its exit animation begins."
                            @update:model-value="(v: number) => updateParam('exitDelayMs', Math.max(0, v))"
                        />
                    </details>

                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Motion</summary>
                        <MotionEnterExitEditor
                            :enter-value="motionTrack.block.enter"
                            :exit-value="motionTrack.block.exit"
                            @update-enter-exit="updateEnterExit"
                        />
                    </details>
                </div>
            </details>
        </template>
    </div>
</template>
