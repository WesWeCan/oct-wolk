<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{
    label: string;
    startValue: number;
    endValue: number;
    startEnabled?: boolean;
    endEnabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    hint?: string;
}>(), {
    startEnabled: true,
    endEnabled: true,
    min: 0,
    max: 100,
    step: 1,
});

const emit = defineEmits<{
    (e: 'update:startValue', value: number): void;
    (e: 'update:endValue', value: number): void;
}>();

const trackRef = ref<HTMLElement | null>(null);

const clamp = (value: number, min = props.min, max = props.max): number => {
    return Math.min(max, Math.max(min, value));
};

const quantize = (value: number): number => {
    if (!Number.isFinite(props.step) || (props.step as number) <= 0) return value;
    return Math.round(value / (props.step as number)) * (props.step as number);
};

const normalizedStart = computed(() => clamp(props.startValue));
const normalizedEnd = computed(() => clamp(props.endValue));
const rangeSpan = computed(() => Math.max(1, props.max - props.min));
const startPercent = computed(() => ((normalizedStart.value - props.min) / rangeSpan.value) * 100);
const endPercent = computed(() => ((normalizedEnd.value - props.min) / rangeSpan.value) * 100);
const emitStart = (value: number) => {
    emit('update:startValue', quantize(clamp(value, props.min, normalizedEnd.value)));
};

const emitEnd = (value: number) => {
    emit('update:endValue', quantize(clamp(value, normalizedStart.value, props.max)));
};

const emitWindow = (start: number, end: number) => {
    const nextStart = quantize(clamp(start, props.min, props.max));
    const nextEnd = quantize(clamp(end, props.min, props.max));
    emit('update:startValue', Math.min(nextStart, nextEnd));
    emit('update:endValue', Math.max(nextStart, nextEnd));
};

const percentFromClientX = (clientX: number): number => {
    const track = trackRef.value;
    if (!track) return normalizedStart.value;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return normalizedStart.value;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return props.min + (ratio * rangeSpan.value);
};

const beginPointerDrag = (
    event: PointerEvent,
    onMoveValue: (nextValue: number) => void,
) => {
    const move = (ev: PointerEvent) => {
        onMoveValue(percentFromClientX(ev.clientX));
    };

    const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    onMoveValue(percentFromClientX(event.clientX));
};

const onStartHandlePointerDown = (event: PointerEvent) => {
    if (!props.startEnabled) return;
    beginPointerDrag(event, emitStart);
};

const onEndHandlePointerDown = (event: PointerEvent) => {
    if (!props.endEnabled) return;
    beginPointerDrag(event, emitEnd);
};

const onWindowPointerDown = (event: PointerEvent) => {
    if (!props.startEnabled || !props.endEnabled) return;
    const track = trackRef.value;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;

    const startAtDown = normalizedStart.value;
    const endAtDown = normalizedEnd.value;
    const width = endAtDown - startAtDown;
    const downX = event.clientX;

    const move = (ev: PointerEvent) => {
        const deltaRatio = (ev.clientX - downX) / rect.width;
        const deltaValue = deltaRatio * rangeSpan.value;
        let nextStart = quantize(startAtDown + deltaValue);
        let nextEnd = nextStart + width;

        if (nextStart < props.min) {
            nextStart = props.min;
            nextEnd = props.min + width;
        }
        if (nextEnd > props.max) {
            nextEnd = props.max;
            nextStart = props.max - width;
        }

        emitWindow(nextStart, nextEnd);
    };

    const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
};
</script>

<template>
    <div class="typewriter-timing-field">
        <label class="typewriter-timing-field__label">
            <span class="anim-number-field__label-text">{{ label }}</span>
            <span v-if="hint" class="inspector-hint">{{ hint }}</span>
        </label>

        <div ref="trackRef" class="typewriter-timing-field__track">
            <div
                class="typewriter-timing-field__segment typewriter-timing-field__segment--enter"
                :style="{ width: `${startPercent}%` }"
            />
            <button
                v-if="startEnabled && endEnabled"
                type="button"
                class="typewriter-timing-field__segment typewriter-timing-field__segment--hold"
                :style="{ left: `${startPercent}%`, width: `${Math.max(endPercent - startPercent, 0)}%` }"
                @pointerdown.prevent="onWindowPointerDown"
            >
                <span class="typewriter-timing-field__segment-label">Hold</span>
            </button>
            <div
                class="typewriter-timing-field__segment typewriter-timing-field__segment--exit"
                :style="{ left: `${endPercent}%`, width: `${Math.max(100 - endPercent, 0)}%` }"
            />

            <button
                type="button"
                class="typewriter-timing-field__handle typewriter-timing-field__handle--start"
                :class="{ 'is-disabled': !startEnabled }"
                :style="{ left: `${startPercent}%` }"
                @pointerdown.prevent="onStartHandlePointerDown"
            >
                <span class="typewriter-timing-field__handle-label">Enter</span>
            </button>

            <button
                type="button"
                class="typewriter-timing-field__handle typewriter-timing-field__handle--end"
                :class="{ 'is-disabled': !endEnabled }"
                :style="{ left: `${endPercent}%` }"
                @pointerdown.prevent="onEndHandlePointerDown"
            >
                <span class="typewriter-timing-field__handle-label">Exit</span>
            </button>
        </div>
    </div>
</template>
