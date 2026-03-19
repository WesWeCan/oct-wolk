<script setup lang="ts">
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiDiamond } from '@mdi/js';
import type { MotionTrack, MotionStyle, BoundsMode, WrapMode, OverflowBehavior } from '@/types/project_types';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';

const props = defineProps<{
    track: MotionTrack;
    currentFrame: number;
}>();

const emit = defineEmits<{
    (e: 'update-style', key: keyof MotionStyle, value: any): void;
    (e: 'toggle-keyframe', path: string, value: any): void;
    (e: 'toggle-property-keyframing', path: string): void;
}>();

const style = () => props.track.block.style;

const isKeyframingEnabled = (path: string): boolean => {
    const pt = props.track.block.propertyTracks.find(p => p.propertyPath === path);
    return !!(pt && pt.enabled !== false);
};

const hasKeyframeAtFrame = (path: string): boolean => {
    const pt = props.track.block.propertyTracks.find(p => p.propertyPath === path);
    if (!pt || !pt.keyframes?.length) return false;
    return pt.keyframes.some(kf => kf.frame === props.currentFrame);
};

const hasAnyKeyframe = (path: string): boolean => {
    const pt = props.track.block.propertyTracks.find(p => p.propertyPath === path);
    return !!(pt && pt.keyframes?.length);
};

type DiamondState = 'empty' | 'half' | 'filled';
const diamondState = (path: string): DiamondState => {
    if (!isKeyframingEnabled(path)) return 'empty';
    if (hasKeyframeAtFrame(path)) return 'filled';
    if (hasAnyKeyframe(path)) return 'half';
    return 'empty';
};

const diamondClick = (path: string, value: any) => {
    if (!isKeyframingEnabled(path)) {
        emit('toggle-property-keyframing', path);
        return;
    }
    emit('toggle-keyframe', path, value);
};

const resolveStyle = <K extends keyof MotionStyle>(key: K, fallback: MotionStyle[K]): MotionStyle[K] => {
    const v = style()[key];
    return v !== undefined && v !== null ? v : fallback;
};
</script>

<template>
    <div class="motion-tab style-v2">
        <!-- Bounds Mode -->
        <div class="style-v2__field">
            <span class="style-v2__field-label">Bounds</span>
            <div class="segmented-control">
                <button :class="{ active: resolveStyle('boundsMode', 'safeArea') === 'free' }" @click="emit('update-style', 'boundsMode' as any, 'free' as BoundsMode)">Free</button>
                <button :class="{ active: resolveStyle('boundsMode', 'safeArea') === 'safeArea' }" @click="emit('update-style', 'boundsMode' as any, 'safeArea' as BoundsMode)">Constraint Region</button>
            </div>
        </div>

        <!-- Wrap (only if safeArea) -->
        <div v-if="resolveStyle('boundsMode', 'safeArea') === 'safeArea'" class="style-v2__field">
            <span class="style-v2__field-label">Wrap</span>
            <div class="segmented-control">
                <button :class="{ active: resolveStyle('wrapMode', 'word') === 'none' }" @click="emit('update-style', 'wrapMode' as any, 'none' as WrapMode)">None</button>
                <button :class="{ active: resolveStyle('wrapMode', 'word') === 'word' }" @click="emit('update-style', 'wrapMode' as any, 'word' as WrapMode)">Word</button>
                <button :class="{ active: resolveStyle('wrapMode', 'word') === 'balanced' }" @click="emit('update-style', 'wrapMode' as any, 'balanced' as WrapMode)">Balanced</button>
            </div>
        </div>

        <!-- Max Lines (only if wrap != none) -->
        <AnimatableNumberField
            v-if="resolveStyle('boundsMode', 'safeArea') === 'safeArea' && resolveStyle('wrapMode', 'word') !== 'none'"
            label="Max Lines"
            :model-value="Number(resolveStyle('maxLines', 5))"
            :min="1"
            :max="20"
            :step="1"
            :fallback-value="5"
            :show-keyframing="true"
            :keyframing-enabled="isKeyframingEnabled('style.maxLines')"
            :has-key-at-current-frame="hasKeyframeAtFrame('style.maxLines')"
            :has-any-keyframes="hasAnyKeyframe('style.maxLines')"
            @update:model-value="(v: number) => emit('update-style', 'maxLines' as any, v)"
            @remove-keyframes="emit('toggle-property-keyframing', 'style.maxLines')"
            @toggle-keyframe="(v: number) => diamondClick('style.maxLines', v)"
        />

        <!-- Overflow (only if wrap != none) -->
        <div v-if="resolveStyle('boundsMode', 'safeArea') === 'safeArea' && resolveStyle('wrapMode', 'word') !== 'none'" class="style-v2__field">
            <span class="style-v2__field-label">Overflow</span>
            <div class="segmented-control">
                <button :class="{ active: resolveStyle('overflowBehavior', 'none') === 'none' }" @click="emit('update-style', 'overflowBehavior' as any, 'none' as OverflowBehavior)">None</button>
                <button :class="{ active: resolveStyle('overflowBehavior', 'none') === 'scaleDown' }" @click="emit('update-style', 'overflowBehavior' as any, 'scaleDown' as OverflowBehavior)">Scale Down</button>
                <button :class="{ active: resolveStyle('overflowBehavior', 'none') === 'ellipsis' }" @click="emit('update-style', 'overflowBehavior' as any, 'ellipsis' as OverflowBehavior)">Ellipsis</button>
                <button :class="{ active: resolveStyle('overflowBehavior', 'none') === 'clip' }" @click="emit('update-style', 'overflowBehavior' as any, 'clip' as OverflowBehavior)">Clip</button>
            </div>
        </div>

        <!-- Constraint Region Padding (only if safeArea) -->
        <AnimatableNumberField
            v-if="resolveStyle('boundsMode', 'safeArea') === 'safeArea'"
            label="Inset"
            :model-value="Number(resolveStyle('safeAreaPadding', 40))"
            :min="0"
            :step="1"
            :fallback-value="40"
            :show-keyframing="true"
            :keyframing-enabled="isKeyframingEnabled('style.safeAreaPadding')"
            :has-key-at-current-frame="hasKeyframeAtFrame('style.safeAreaPadding')"
            :has-any-keyframes="hasAnyKeyframe('style.safeAreaPadding')"
            @update:model-value="(v: number) => emit('update-style', 'safeAreaPadding' as any, v)"
            @remove-keyframes="emit('toggle-property-keyframing', 'style.safeAreaPadding')"
            @toggle-keyframe="(v: number) => diamondClick('style.safeAreaPadding', v)"
        />

        <!-- Constraint Region Offset X (only if safeArea) -->
        <AnimatableNumberField
            v-if="resolveStyle('boundsMode', 'safeArea') === 'safeArea'"
            label="Region Offset X"
            :model-value="Number(resolveStyle('safeAreaOffsetX', 0))"
            :step="1"
            :fallback-value="0"
            :show-keyframing="true"
            :keyframing-enabled="isKeyframingEnabled('style.safeAreaOffsetX')"
            :has-key-at-current-frame="hasKeyframeAtFrame('style.safeAreaOffsetX')"
            :has-any-keyframes="hasAnyKeyframe('style.safeAreaOffsetX')"
            @update:model-value="(v: number) => emit('update-style', 'safeAreaOffsetX' as any, v)"
            @remove-keyframes="emit('toggle-property-keyframing', 'style.safeAreaOffsetX')"
            @toggle-keyframe="(v: number) => diamondClick('style.safeAreaOffsetX', v)"
        />

        <!-- Constraint Region Offset Y (only if safeArea) -->
        <AnimatableNumberField
            v-if="resolveStyle('boundsMode', 'safeArea') === 'safeArea'"
            label="Region Offset Y"
            :model-value="Number(resolveStyle('safeAreaOffsetY', 0))"
            :step="1"
            :fallback-value="0"
            :show-keyframing="true"
            :keyframing-enabled="isKeyframingEnabled('style.safeAreaOffsetY')"
            :has-key-at-current-frame="hasKeyframeAtFrame('style.safeAreaOffsetY')"
            :has-any-keyframes="hasAnyKeyframe('style.safeAreaOffsetY')"
            @update:model-value="(v: number) => emit('update-style', 'safeAreaOffsetY' as any, v)"
            @remove-keyframes="emit('toggle-property-keyframing', 'style.safeAreaOffsetY')"
            @toggle-keyframe="(v: number) => diamondClick('style.safeAreaOffsetY', v)"
        />
    </div>
</template>
