<script setup lang="ts">
import { computed } from 'vue';
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiDiamond, mdiMinus, mdiPlus, mdiArrowLeftRight } from '@mdi/js';

const props = withDefaults(defineProps<{
    label: string;
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    fallbackValue?: number;
    hint?: string;
    disabled?: boolean;
    showKeyframing?: boolean;
    keyframingEnabled?: boolean;
    hasKeyAtCurrentFrame?: boolean;
    hasAnyKeyframes?: boolean;
    scrubPerPx?: number;
    displayDecimals?: number;
}>(), {
    step: 1,
    fallbackValue: 0,
    disabled: false,
    showKeyframing: false,
    keyframingEnabled: false,
    hasKeyAtCurrentFrame: false,
    hasAnyKeyframes: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: number): void;
    (e: 'toggle-keyframe', value: number): void;
    (e: 'remove-keyframes'): void;
}>();

const safeNumber = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const clampToBounds = (value: number): number => {
    let next = value;
    if (Number.isFinite(props.min)) next = Math.max(props.min as number, next);
    if (Number.isFinite(props.max)) next = Math.min(props.max as number, next);
    return next;
};

const quantizeToStep = (value: number): number => {
    const step = safeNumber(props.step, 1);
    if (!Number.isFinite(step) || step <= 0) return value;
    return Math.round(value / step) * step;
};

const emitValue = (value: number) => {
    emit('update:modelValue', clampToBounds(quantizeToStep(value)));
};

const onInputChange = (event: Event) => {
    const raw = (event.target as HTMLInputElement).value;
    emitValue(safeNumber(raw, props.fallbackValue));
};

const onArrowAdjust = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const direction = event.key === 'ArrowUp' ? 1 : -1;
    let step = safeNumber(props.step, 1);
    if (event.shiftKey) step *= 10;
    if (event.altKey || event.metaKey) step *= 0.25;
    emitValue(safeNumber(props.modelValue, props.fallbackValue) + (direction * step));
};

const onStep = (direction: -1 | 1) => {
    const step = safeNumber(props.step, 1);
    emitValue(safeNumber(props.modelValue, props.fallbackValue) + (direction * step));
};

const onStartScrub = (event: PointerEvent) => {
    if (props.disabled) return;
    try { (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId); } catch {}
    const startX = event.clientX;
    const initialValue = safeNumber(props.modelValue, props.fallbackValue);
    const range = Number.isFinite(props.min) && Number.isFinite(props.max) && (props.max as number) > (props.min as number)
        ? (props.max as number) - (props.min as number)
        : 100;
    const basePerPx = Number.isFinite(props.scrubPerPx) ? (props.scrubPerPx as number) : (range * 0.002);

    const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        let speed = basePerPx;
        if (ev.shiftKey) speed *= 4;
        if (ev.altKey || ev.metaKey) speed *= 0.25;
        emitValue(initialValue + (dx * speed));
    };

    const onUp = () => {
        try { (event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId); } catch {}
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
};

const displayValue = computed(() => {
    const v = safeNumber(props.modelValue, props.fallbackValue);
    if (Number.isFinite(props.displayDecimals)) {
        const decimals = Math.max(0, Math.round(props.displayDecimals as number));
        return v.toFixed(decimals);
    }
    return Number.isInteger(v) ? v : parseFloat(v.toFixed(3));
});

const diamondState = computed(() => {
    if (!props.showKeyframing || !props.keyframingEnabled) return 'empty';
    if (props.hasKeyAtCurrentFrame) return 'filled';
    if (props.hasAnyKeyframes) return 'half';
    return 'empty';
});

const showRemoveKeyframes = computed(() => {
    if (!props.showKeyframing) return false;
    return props.hasAnyKeyframes || props.keyframingEnabled;
});
</script>

<template>
    <div class="anim-number-field" :class="{ 'is-disabled': disabled }">
        <label class="anim-number-field__label">
            <span class="anim-number-field__label-row">
                <span class="anim-number-field__label-text">{{ label }}</span>
                <button
                    v-if="showRemoveKeyframes"
                    type="button"
                    class="kf-remove-btn"
                    :disabled="disabled"
                    title="Remove all keyframes for this property"
                    @click="emit('remove-keyframes')"
                >
                    Remove keyframes
                </button>
            </span>
            <span v-if="hint" class="inspector-hint">{{ hint }}</span>
        </label>

        <div class="anim-number-field__row">
            <input
                type="number"
                class="inspector-input"
                :value="displayValue"
                :min="min"
                :max="max"
                :step="step"
                :disabled="disabled"
                @change="onInputChange"
                @keydown="onArrowAdjust"
            />
            <button class="anim-number-field__icon-btn anim-number-field__step" type="button" :disabled="disabled" title="Decrease" @click="onStep(-1)">
                <SvgIcon type="mdi" :path="mdiMinus" :size="16" />
            </button>
            <button class="anim-number-field__icon-btn anim-number-field__step" type="button" :disabled="disabled" title="Increase" @click="onStep(1)">
                <SvgIcon type="mdi" :path="mdiPlus" :size="16" />
            </button>
            <button
                class="anim-number-field__icon-btn anim-number-field__scrub"
                type="button"
                :disabled="disabled"
                title="Drag left/right to adjust; Shift=fast, Alt=slow"
                @pointerdown.prevent.stop="onStartScrub"
            >
                <SvgIcon type="mdi" :path="mdiArrowLeftRight" :size="16" />
            </button>
            <button
                v-if="showKeyframing"
                class="kf-diamond"
                :class="diamondState"
                :disabled="disabled"
                :title="diamondState === 'filled' ? 'Remove keyframe at current frame' : 'Add keyframe at current frame'"
                @click="emit('toggle-keyframe', modelValue)"
            >
                <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
            </button>
        </div>
    </div>
</template>
