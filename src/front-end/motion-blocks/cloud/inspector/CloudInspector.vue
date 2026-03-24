<script setup lang="ts">
import { computed } from 'vue';
import type { AnchorX, AnchorY, LyricTrack, MotionStyle, MotionTrack, MotionTransform, WolkProjectFont } from '@/types/project_types';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import MotionAppearanceTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionAppearanceTab.vue';
import MotionPositionTab from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionPositionTab.vue';
import CloudSafeAreaTab from '@/front-end/motion-blocks/cloud/inspector/tabs/CloudSafeAreaTab.vue';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import { applyFontSelectionToMotionStyle } from '@/front-end/utils/fonts/fontUtils';
import type { MotionFontSelection } from '@/front-end/utils/fonts/fontUtils';
import { upsertKeyframe, removeKeyframeAtIndex, evalInterpolatedAtFrame } from '@/front-end/utils/tracks';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';
import {
    clampOffsetToConstraintRegion,
    resolveReferencePointInRegion,
    resolveSafeAreaRegion,
} from '@/front-end/motion-blocks/core/safeArea';
import {
    isCloudSupportedSourceTrack,
    listCloudSupportedSourceTracks,
} from '@/front-end/motion-blocks/cloud/source-tracks';

const props = defineProps<{
    motionTrack: MotionTrack | null;
    lyricTracks: LyricTrack[];
    playheadMs?: number;
    fps?: number;
    projectFont?: WolkProjectFont;
    renderWidth?: number;
    renderHeight?: number;
    rendererBounds?: RendererBounds | null;
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

const updateTransform = (key: keyof MotionTransform, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    if ((key === 'offsetX' || key === 'offsetY') && (block.style.boundsMode ?? 'safeArea') === 'safeArea') {
        const padding = block.style.safeAreaPadding ?? 40;
        const regionOffsetX = block.style.safeAreaOffsetX ?? 0;
        const regionOffsetY = block.style.safeAreaOffsetY ?? 0;
        if (key === 'offsetX' && props.renderWidth) {
            value = clampOffsetToConstraintRegion(value, block.transform.anchorX, padding, props.renderWidth, regionOffsetX);
        }
        if (key === 'offsetY' && props.renderHeight) {
            value = clampOffsetToConstraintRegion(value, block.transform.anchorY, padding, props.renderHeight, regionOffsetY);
        }
    }
    block.transform = { ...block.transform, [key]: value };
    block.propertyTracks = autoKeyframe(`transform.${key}`, value, [...(block.propertyTracks || [])]);
    emit('update-track', { ...props.motionTrack, block });
};

const rotateScalePoint = (x: number, y: number, rotationDeg: number, scale: number) => {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: (x * cos - y * sin) * scale,
        y: (x * sin + y * cos) * scale,
    };
};

const updateAnchor = (x: AnchorX, y: AnchorY) => {
    if (!props.motionTrack || isLocked.value) return;
    const nextTransform = { ...props.motionTrack.block.transform, anchorX: x, anchorY: y };

    if (props.rendererBounds && props.renderWidth && props.renderHeight) {
        const bounds = props.rendererBounds;
        const targetLocalX = x === 'left'
            ? bounds.localBoxX
            : x === 'right'
                ? bounds.localBoxX + bounds.localBoxWidth
                : bounds.localBoxX + (bounds.localBoxWidth / 2);
        const targetLocalY = y === 'top'
            ? bounds.localBoxY
            : y === 'bottom'
                ? bounds.localBoxY + bounds.localBoxHeight
                : bounds.localBoxY + (bounds.localBoxHeight / 2);
        const targetDelta = rotateScalePoint(targetLocalX, targetLocalY, bounds.rotation, bounds.scale);
        const desiredReferenceX = bounds.referenceX + targetDelta.x;
        const desiredReferenceY = bounds.referenceY + targetDelta.y;
        const region = resolveSafeAreaRegion(props.motionTrack.block.style, props.renderWidth, props.renderHeight);
        const basePoint = resolveReferencePointInRegion(x, y, region);

        nextTransform.offsetX = Math.round(desiredReferenceX - basePoint.x);
        nextTransform.offsetY = Math.round(desiredReferenceY - basePoint.y);

        if ((props.motionTrack.block.style.boundsMode ?? 'safeArea') === 'safeArea') {
            const padding = props.motionTrack.block.style.safeAreaPadding ?? 40;
            const regionOffsetX = props.motionTrack.block.style.safeAreaOffsetX ?? 0;
            const regionOffsetY = props.motionTrack.block.style.safeAreaOffsetY ?? 0;
            nextTransform.offsetX = clampOffsetToConstraintRegion(nextTransform.offsetX, x, padding, props.renderWidth, regionOffsetX);
            nextTransform.offsetY = clampOffsetToConstraintRegion(nextTransform.offsetY, y, padding, props.renderHeight, regionOffsetY);
        }
    }

    emit('update-track', {
        ...props.motionTrack,
        block: { ...props.motionTrack.block, transform: nextTransform },
    });
};

const resetToDefaults = () => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    block.transform = {
        ...block.transform,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
    };
    emit('update-track', { ...props.motionTrack, block });
};

const setDefaultKeyframe = () => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block };
    let propertyTracks = [...(block.propertyTracks || [])];
    const defaults: Record<string, number> = {
        'transform.offsetX': 0,
        'transform.offsetY': 0,
        'transform.scale': 1,
        'transform.rotation': 0,
    };
    for (const [path, value] of Object.entries(defaults)) {
        propertyTracks = autoKeyframe(path, value, propertyTracks);
    }
    block.transform = {
        ...block.transform,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
    };
    block.propertyTracks = propertyTracks;
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
                <summary class="inspector-section__title">Position</summary>
                <div class="inspector-section__content">
                    <MotionPositionTab
                        :track="motionTrack"
                        :current-frame="currentFrame"
                        :render-width="renderWidth"
                        :render-height="renderHeight"
                        @update-transform="updateTransform"
                        @update-anchor="updateAnchor"
                        @toggle-keyframe="toggleKeyframe"
                        @toggle-property-keyframing="togglePropertyKeyframing"
                        @reset-to-defaults="resetToDefaults"
                        @set-default-keyframe="setDefaultKeyframe"
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
        </template>
    </div>
</template>
