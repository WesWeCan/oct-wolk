<script setup lang="ts">
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiDiamond } from '@mdi/js';
import type { MotionTrack, MotionTransform, AnchorX, AnchorY } from '@/types/project_types';

const props = defineProps<{
    track: MotionTrack;
    currentFrame: number;
}>();

const emit = defineEmits<{
    (e: 'update-transform', key: keyof MotionTransform, value: any): void;
    (e: 'update-anchor', x: AnchorX, y: AnchorY): void;
    (e: 'update-style-opacity', value: number): void;
    (e: 'toggle-keyframe', path: string, value: any): void;
    (e: 'toggle-property-keyframing', path: string): void;
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

type DiamondState = 'empty' | 'half' | 'filled';
const diamondState = (path: string): DiamondState => {
    if (!isKeyframingEnabled(path)) return 'empty';
    if (hasKeyframeAtFrame(path)) return 'filled';
    if (hasAnyKeyframe(path)) return 'half';
    return 'empty';
};

const resetTransform = () => {
    emit('update-transform', 'offsetX', 0);
    emit('update-transform', 'offsetY', 0);
    emit('update-transform', 'scale', 1);
    emit('update-transform', 'rotation', 0);
};

const fields: { label: string; path: string; key: keyof MotionTransform; min?: number; max?: number; step?: number }[] = [
    { label: 'X', path: 'transform.offsetX', key: 'offsetX' },
    { label: 'Y', path: 'transform.offsetY', key: 'offsetY' },
    { label: 'Scale', path: 'transform.scale', key: 'scale', min: 0.05, max: 10, step: 0.01 },
    { label: 'Rotation', path: 'transform.rotation', key: 'rotation', min: -360, max: 360, step: 0.5 },
];
</script>

<template>
    <div class="motion-tab">
        <div class="motion-tab__field">
            <label>Anchor</label>
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
            <label>
                <input
                    type="checkbox"
                    class="kf-enable-checkbox"
                    :checked="isKeyframingEnabled(field.path)"
                    title="Enable keyframing"
                    @change="emit('toggle-property-keyframing', field.path)"
                />
                {{ field.label }}
            </label>
            <div class="motion-tab__kf-row">
                <input
                    type="number"
                    class="inspector-input"
                    :min="field.min"
                    :max="field.max"
                    :step="field.step || 1"
                    :value="t()[field.key]"
                    @change="emit('update-transform', field.key, Number(($event.target as HTMLInputElement).value) || 0)"
                />
                <button
                    class="kf-diamond"
                    :class="diamondState(field.path)"
                    :disabled="!isKeyframingEnabled(field.path)"
                    :title="!isKeyframingEnabled(field.path) ? 'Enable keyframing first' : diamondState(field.path) === 'filled' ? 'Remove keyframe' : 'Add keyframe at current frame'"
                    @click="isKeyframingEnabled(field.path) && emit('toggle-keyframe', field.path, Number(t()[field.key]))"
                >
                    <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
                </button>
            </div>
        </div>

        <div class="motion-tab__kf-field">
            <label>
                <input
                    type="checkbox"
                    class="kf-enable-checkbox"
                    :checked="isKeyframingEnabled('style.opacity')"
                    title="Enable keyframing"
                    @change="emit('toggle-property-keyframing', 'style.opacity')"
                />
                Opacity
            </label>
            <div class="motion-tab__kf-row">
                <input
                    type="range"
                    class="inspector-input"
                    min="0" max="1" step="0.05"
                    :value="track.block.style.opacity"
                    @input="$emit('update-style-opacity', Number(($event.target as HTMLInputElement).value))"
                />
                <span class="motion-tab__value">{{ (track.block.style.opacity * 100).toFixed(0) }}%</span>
                <button
                    class="kf-diamond"
                    :class="diamondState('style.opacity')"
                    :disabled="!isKeyframingEnabled('style.opacity')"
                    title="Keyframe opacity"
                    @click="isKeyframingEnabled('style.opacity') && emit('toggle-keyframe', 'style.opacity', track.block.style.opacity)"
                >
                    <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
                </button>
            </div>
        </div>

        <div class="inspector-actions">
            <button @click="resetTransform">Reset Transform</button>
        </div>
    </div>
</template>
