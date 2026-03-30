<script setup lang="ts">
import { computed } from 'vue';
import type { MotionTrack, MotionTransform, AnchorX, AnchorY } from '@/types/project_types';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';

const props = defineProps<{
    track: MotionTrack;
    currentFrame: number;
    renderWidth?: number;
    renderHeight?: number;
}>();

const emit = defineEmits<{
    (e: 'update-transform', key: keyof MotionTransform, value: any): void;
    (e: 'update-anchor', x: AnchorX, y: AnchorY): void;
    (e: 'toggle-keyframe', path: string, value: any): void;
    (e: 'toggle-property-keyframing', path: string): void;
    (e: 'reset-to-defaults'): void;
    (e: 'set-default-keyframe'): void;
}>();

const t = () => props.track.block.transform;

const anchorGrid: { x: AnchorX; y: AnchorY }[][] = [
    [{ x: 'left', y: 'top' }, { x: 'center', y: 'top' }, { x: 'right', y: 'top' }],
    [{ x: 'left', y: 'center' }, { x: 'center', y: 'center' }, { x: 'right', y: 'center' }],
    [{ x: 'left', y: 'bottom' }, { x: 'center', y: 'bottom' }, { x: 'right', y: 'bottom' }],
];

const setAnchor = (x: AnchorX, y: AnchorY) => {
    emit('update-anchor', x, y);
};

const isAnchorActive = (x: AnchorX, y: AnchorY) => t().anchorX === x && t().anchorY === y;

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

const fields = computed(() => {
    return [
        { label: 'Reference X', path: 'transform.offsetX', key: 'offsetX' as keyof MotionTransform, step: 1 },
        { label: 'Reference Y', path: 'transform.offsetY', key: 'offsetY' as keyof MotionTransform, step: 1 },
        { label: 'Scale', path: 'transform.scale', key: 'scale' as keyof MotionTransform, min: 0.05, max: 10, step: 0.01 },
        { label: 'Rotation', path: 'transform.rotation', key: 'rotation' as keyof MotionTransform, min: -360, max: 360, step: 0.5 },
    ];
});
</script>

<template>
    <div class="motion-tab">
        <div class="motion-tab__field">
            <label>Reference Point</label>
            <div class="anchor-grid">
                <div v-for="(row, ri) in anchorGrid" :key="ri" class="anchor-grid__row">
                    <button
                        v-for="(cell, ci) in row"
                        :key="ci"
                        class="anchor-grid__cell"
                        :class="{ active: isAnchorActive(cell.x, cell.y) }"
                        @click="setAnchor(cell.x, cell.y)"
                    >
                        <span class="anchor-grid__dot"></span>
                    </button>
                </div>
            </div>
        </div>

        <div v-for="field in fields" :key="field.path" class="motion-tab__kf-field">
            <AnimatableNumberField
                :label="field.label"
                :model-value="Number(t()[field.key])"
                :min="field.min"
                :max="field.max"
                :step="field.step || 1"
                :fallback-value="0"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled(field.path)"
                :has-key-at-current-frame="hasKeyframeAtFrame(field.path)"
                :has-any-keyframes="hasAnyKeyframe(field.path)"
                @update:model-value="(value:number) => emit('update-transform', field.key, value)"
                @remove-keyframes="emit('toggle-property-keyframing', field.path)"
                @toggle-keyframe="(value:number) => emit('toggle-keyframe', field.path, value)"
            />
        </div>

        <div class="inspector-actions">
            <button class="btn-sm" @click="emit('reset-to-defaults')">Reset to Defaults</button>
            <button class="btn-sm" @click="emit('set-default-keyframe')">Set Default Keyframe</button>
        </div>
    </div>
</template>
