<script setup lang="ts">
import type { BoundsMode, MotionStyle, MotionTrack } from '@/types/project_types';
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
    const pt = props.track.block.propertyTracks.find((propertyTrack) => propertyTrack.propertyPath === path);
    return !!(pt && pt.enabled !== false);
};

const hasKeyframeAtFrame = (path: string): boolean => {
    const pt = props.track.block.propertyTracks.find((propertyTrack) => propertyTrack.propertyPath === path);
    if (!pt || !pt.keyframes?.length) return false;
    return pt.keyframes.some((keyframe) => keyframe.frame === props.currentFrame);
};

const hasAnyKeyframe = (path: string): boolean => {
    const pt = props.track.block.propertyTracks.find((propertyTrack) => propertyTrack.propertyPath === path);
    return !!(pt && pt.keyframes?.length);
};

const toggleFieldKeyframe = (path: string, value: any) => {
    if (!isKeyframingEnabled(path)) {
        emit('toggle-property-keyframing', path);
        return;
    }
    emit('toggle-keyframe', path, value);
};

const resolveStyle = <K extends keyof MotionStyle>(key: K, fallback: MotionStyle[K]): MotionStyle[K] => {
    const value = style()[key];
    return value !== undefined && value !== null ? value : fallback;
};
</script>

<template>
    <div class="motion-tab style-v2">
        <div class="style-v2__field">
            <span class="style-v2__field-label">Bounds</span>
            <div class="segmented-control">
                <button :class="{ active: resolveStyle('boundsMode', 'safeArea') === 'free' }" @click="emit('update-style', 'boundsMode' as any, 'free' as BoundsMode)">Free</button>
                <button :class="{ active: resolveStyle('boundsMode', 'safeArea') === 'safeArea' }" @click="emit('update-style', 'boundsMode' as any, 'safeArea' as BoundsMode)">Constraint Region</button>
            </div>
        </div>

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
            @update:model-value="(value: number) => emit('update-style', 'safeAreaPadding', value)"
            @remove-keyframes="emit('toggle-property-keyframing', 'style.safeAreaPadding')"
            @toggle-keyframe="(value: number) => toggleFieldKeyframe('style.safeAreaPadding', value)"
        />

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
            @update:model-value="(value: number) => emit('update-style', 'safeAreaOffsetX', value)"
            @remove-keyframes="emit('toggle-property-keyframing', 'style.safeAreaOffsetX')"
            @toggle-keyframe="(value: number) => toggleFieldKeyframe('style.safeAreaOffsetX', value)"
        />

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
            @update:model-value="(value: number) => emit('update-style', 'safeAreaOffsetY', value)"
            @remove-keyframes="emit('toggle-property-keyframing', 'style.safeAreaOffsetY')"
            @toggle-keyframe="(value: number) => toggleFieldKeyframe('style.safeAreaOffsetY', value)"
        />

        <p class="inspector-hint">
            Words are scattered within this region. The block transform is applied on top.
        </p>
    </div>
</template>
