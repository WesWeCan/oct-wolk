<script setup lang="ts">
import type {
    MotionAnimationDirection,
    MotionAnimationEasing,
    MotionAnimationStyle,
    MotionEnterExit,
} from '@/types/project_types';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import { createMotionAllOffEnterExit } from '@/front-end/utils/motion/motionEnterExitPresets';

const props = defineProps<{
    enterValue: MotionEnterExit;
    exitValue: MotionEnterExit;
}>();

const emit = defineEmits<{
    (e: 'update-enter-exit', which: 'enter' | 'exit', value: MotionEnterExit): void;
}>();

const easingOptions: { value: MotionAnimationEasing; label: string }[] = [
    { value: 'linear', label: 'Linear' },
    { value: 'easeIn', label: 'Ease In' },
    { value: 'easeOut', label: 'Ease Out' },
    { value: 'easeInOut', label: 'Ease In/Out' },
    { value: 'easeInCubic', label: 'In Cubic' },
    { value: 'easeOutCubic', label: 'Out Cubic' },
    { value: 'easeInBack', label: 'In Overshoot' },
    { value: 'easeOutBack', label: 'Out Overshoot' },
    { value: 'easeInBounce', label: 'In Bounce' },
    { value: 'easeOutBounce', label: 'Out Bounce' },
];

const directionOptions: { value: MotionAnimationDirection; label: string }[] = [
    { value: 'up', label: 'Up' },
    { value: 'down', label: 'Down' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
];

const resolveLegacyStyle = (config: MotionEnterExit): MotionAnimationStyle => {
    const style = config.style ?? 'fade';
    if (style === 'none') return 'none';
    if (style === 'slideUp' || style === 'slideDown' || style === 'slideLeft' || style === 'slideRight') return style;
    if (style === 'scale') return style;
    return 'fade';
};

const defaultDirectionFor = (which: 'enter' | 'exit'): MotionAnimationDirection => {
    return which === 'enter' ? 'up' : 'down';
};

const toComposer = (which: 'enter' | 'exit', config: MotionEnterExit): MotionEnterExit => {
    const legacyStyle = resolveLegacyStyle(config);
    const legacyDirection = legacyStyle === 'slideUp'
        ? 'up'
        : legacyStyle === 'slideDown'
            ? 'down'
            : legacyStyle === 'slideLeft'
                ? 'left'
                : legacyStyle === 'slideRight'
                    ? 'right'
                    : defaultDirectionFor(which);
    const fadeEnabledDefault = legacyStyle !== 'none';
    const moveEnabledDefault = legacyStyle === 'slideUp' || legacyStyle === 'slideDown' || legacyStyle === 'slideLeft' || legacyStyle === 'slideRight';
    const scaleEnabledDefault = legacyStyle === 'scale';
    const fadeStartFallback = which === 'enter' ? 0 : 1;
    const fadeEndFallback = which === 'enter' ? 1 : 0;

    const fade = {
        enabled: config.fade?.enabled ?? fadeEnabledDefault,
        opacityStart: config.fade?.opacityStart ?? config.opacityStart ?? fadeStartFallback,
        opacityEnd: config.fade?.opacityEnd ?? config.opacityEnd ?? fadeEndFallback,
    };
    const move = {
        enabled: config.move?.enabled ?? moveEnabledDefault,
        direction: config.move?.direction ?? legacyDirection,
        distancePx: config.move?.distancePx ?? 24,
    };
    const scale = {
        enabled: config.scale?.enabled ?? scaleEnabledDefault,
        amount: config.scale?.amount ?? 0.12,
    };

    return {
        ...config,
        fade,
        move,
        scale,
        style: deriveLegacyStyle({ ...config, fade, move, scale } as MotionEnterExit),
        opacityStart: fade.opacityStart,
        opacityEnd: fade.opacityEnd,
    };
};

const deriveLegacyStyle = (config: MotionEnterExit): MotionAnimationStyle => {
    if (config.move?.enabled) {
        if (config.move.direction === 'up') return 'slideUp';
        if (config.move.direction === 'down') return 'slideDown';
        if (config.move.direction === 'left') return 'slideLeft';
        return 'slideRight';
    }
    if (config.scale?.enabled) return 'scale';
    if (config.fade?.enabled) return 'fade';
    return 'none';
};

const sectionState = (which: 'enter' | 'exit'): MotionEnterExit => {
    const source = which === 'enter' ? props.enterValue : props.exitValue;
    return toComposer(which, source);
};

const emitSection = (which: 'enter' | 'exit', next: MotionEnterExit) => {
    const withLegacy = {
        ...next,
        style: deriveLegacyStyle(next),
        opacityStart: next.fade.opacityStart,
        opacityEnd: next.fade.opacityEnd,
    };
    emit('update-enter-exit', which, withLegacy);
};

const updateSection = (which: 'enter' | 'exit', patch: Partial<MotionEnterExit>) => {
    const current = sectionState(which);
    const next: MotionEnterExit = {
        ...current,
        ...patch,
        fade: {
            ...current.fade,
            ...(patch.fade ?? {}),
        },
        move: {
            ...current.move,
            ...(patch.move ?? {}),
        },
        scale: {
            ...current.scale,
            ...(patch.scale ?? {}),
        },
    };
    emitSection(which, next);
};

const setFadeEnabled = (which: 'enter' | 'exit', enabled: boolean) => {
    updateSection(which, {
        fade: enabled
            ? {
                ...sectionState(which).fade,
                enabled: true,
                opacityStart: which === 'enter' ? 0 : 1,
                opacityEnd: which === 'enter' ? 1 : 0,
            }
            : {
                ...sectionState(which).fade,
                enabled: false,
                opacityStart: 1,
                opacityEnd: 1,
            },
    });
};

const setFadeBoundary = (which: 'enter' | 'exit', value: number) => {
    updateSection(which, {
        fade: which === 'enter'
            ? {
                ...sectionState(which).fade,
                opacityStart: Math.max(0, Math.min(1, value)),
                opacityEnd: 1,
            }
            : {
                ...sectionState(which).fade,
                opacityStart: 1,
                opacityEnd: Math.max(0, Math.min(1, value)),
            },
    });
};

const setMoveEnabled = (which: 'enter' | 'exit', enabled: boolean) => {
    updateSection(which, {
        move: {
            ...sectionState(which).move,
            enabled,
        },
    });
};

const setMoveDirection = (which: 'enter' | 'exit', direction: MotionAnimationDirection) => {
    updateSection(which, {
        move: {
            ...sectionState(which).move,
            direction,
        },
    });
};

const setMoveDistance = (which: 'enter' | 'exit', distancePx: number) => {
    updateSection(which, {
        move: {
            ...sectionState(which).move,
            distancePx: Math.max(0, distancePx),
        },
    });
};

const setScaleEnabled = (which: 'enter' | 'exit', enabled: boolean) => {
    updateSection(which, {
        scale: {
            ...sectionState(which).scale,
            enabled,
        },
    });
};

const setScaleAmount = (which: 'enter' | 'exit', amount: number) => {
    updateSection(which, {
        scale: {
            ...sectionState(which).scale,
            amount: Math.max(0, amount),
        },
    });
};

const applyPreset = (which: 'enter' | 'exit', preset: 'subtle' | 'default' | 'snappy' | 'dramatic' | 'allOff') => {
    if (preset === 'allOff') {
        emitSection(which, createMotionAllOffEnterExit(sectionState(which)));
        return;
    }
    if (preset === 'subtle') {
        updateSection(which, {
            fraction: 0.24,
            minFrames: 2,
            maxFrames: 22,
            easing: 'easeOut',
            fade: {
                enabled: true,
                opacityStart: which === 'enter' ? 0 : 1,
                opacityEnd: which === 'enter' ? 1 : 0,
            },
            move: { enabled: true, direction: defaultDirectionFor(which), distancePx: 32 },
            scale: { enabled: false, amount: 0.16 },
        });
        return;
    }
    if (preset === 'default') {
        updateSection(which, {
            fraction: 0.3,
            minFrames: 3,
            maxFrames: 30,
            easing: 'easeOut',
            fade: {
                enabled: true,
                opacityStart: which === 'enter' ? 0 : 1,
                opacityEnd: which === 'enter' ? 1 : 0,
            },
            move: { enabled: true, direction: defaultDirectionFor(which), distancePx: 48 },
            scale: { enabled: false, amount: 0.2 },
        });
        return;
    }
    if (preset === 'snappy') {
        updateSection(which, {
            fraction: 0.15,
            minFrames: 2,
            maxFrames: 12,
            easing: 'easeOutCubic',
            fade: {
                enabled: true,
                opacityStart: which === 'enter' ? 0 : 1,
                opacityEnd: which === 'enter' ? 1 : 0,
            },
            move: { enabled: true, direction: defaultDirectionFor(which), distancePx: 80 },
            scale: { enabled: true, amount: 0.4 },
        });
        return;
    }
    updateSection(which, {
        fraction: 0.52,
        minFrames: 6,
        maxFrames: 70,
        easing: which === 'enter' ? 'easeOutBack' : 'easeOutBounce',
        fade: {
            enabled: true,
            opacityStart: which === 'enter' ? 0 : 1,
            opacityEnd: which === 'enter' ? 1 : 0,
        },
        move: { enabled: true, direction: defaultDirectionFor(which), distancePx: 180 },
        scale: { enabled: true, amount: 0.8 },
    });
};
</script>

<template>
    <div class="motion-tab style-v2 motion-animation-v2">
        <details class="style-sub-section" open>
            <summary class="style-sub-section__header">Enter</summary>

            <div class="style-v2__field">
                <span class="style-v2__field-label">Presets</span>
                <div class="motion-tab__chips">
                    <button class="chip" @click="applyPreset('enter', 'allOff')">All Off</button>
                    <button class="chip" @click="applyPreset('enter', 'subtle')">Subtle</button>
                    <button class="chip" @click="applyPreset('enter', 'default')">Default</button>
                    <button class="chip" @click="applyPreset('enter', 'snappy')">Snappy</button>
                    <button class="chip" @click="applyPreset('enter', 'dramatic')">Dramatic</button>
                </div>
            </div>

            <AnimatableNumberField
                label="Duration %"
                :model-value="Number(sectionState('enter').fraction * 100)"
                :min="0"
                :max="100"
                :step="0.1"
                :fallback-value="30"
                :display-decimals="1"
                @update:model-value="(v:number) => updateSection('enter', { fraction: Math.max(0, Math.min(1, v / 100)) })"
            />

            <div class="style-v2__field">
                <span class="style-v2__field-label">Fade</span>
                <div class="segmented-control">
                    <button
                        :class="{ active: !sectionState('enter').fade.enabled }"
                        @click="setFadeEnabled('enter', false)"
                    >Off</button>
                    <button
                        :class="{ active: sectionState('enter').fade.enabled }"
                        @click="setFadeEnabled('enter', true)"
                    >On</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="sectionState('enter').fade.enabled"
                label="From Opacity"
                :model-value="Number(sectionState('enter').fade.opacityStart)"
                :min="0"
                :max="1"
                :step="0.01"
                :fallback-value="0"
                :display-decimals="2"
                @update:model-value="(v:number) => setFadeBoundary('enter', v)"
            />

            <div class="style-v2__field">
                <span class="style-v2__field-label">Movement</span>
                <div class="segmented-control">
                    <button :class="{ active: !sectionState('enter').move.enabled }" @click="setMoveEnabled('enter', false)">Off</button>
                    <button :class="{ active: sectionState('enter').move.enabled }" @click="setMoveEnabled('enter', true)">On</button>
                </div>
            </div>
            <div v-if="sectionState('enter').move.enabled" class="style-v2__field">
                <span class="style-v2__field-label">From Direction</span>
                <div class="segmented-control">
                    <button
                        v-for="d in directionOptions"
                        :key="'enter-dir-' + d.value"
                        :class="{ active: sectionState('enter').move.direction === d.value }"
                        @click="setMoveDirection('enter', d.value)"
                    >{{ d.label }}</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="sectionState('enter').move.enabled"
                label="Offset Distance (px)"
                :model-value="Number(sectionState('enter').move.distancePx)"
                :min="0"
                :step="1"
                :fallback-value="24"
                @update:model-value="(v:number) => setMoveDistance('enter', v)"
            />

            <div class="style-v2__field">
                <span class="style-v2__field-label">Scale</span>
                <div class="segmented-control">
                    <button :class="{ active: !sectionState('enter').scale.enabled }" @click="setScaleEnabled('enter', false)">Off</button>
                    <button :class="{ active: sectionState('enter').scale.enabled }" @click="setScaleEnabled('enter', true)">On</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="sectionState('enter').scale.enabled"
                label="Start Scale Delta"
                :model-value="Number(sectionState('enter').scale.amount)"
                :min="0"
                :step="0.01"
                :fallback-value="0.12"
                :display-decimals="2"
                @update:model-value="(v:number) => setScaleAmount('enter', v)"
            />

            <div class="style-v2__field">
                <span class="style-v2__field-label">Easing</span>
                <select
                    class="inspector-input"
                    :value="sectionState('enter').easing"
                    @change="updateSection('enter', { easing: ($event.target as HTMLSelectElement).value as MotionAnimationEasing })"
                >
                    <option v-for="e in easingOptions" :key="'enter-ease-' + e.value" :value="e.value">{{ e.label }}</option>
                </select>
            </div>
        </details>

        <details class="style-sub-section" open>
            <summary class="style-sub-section__header">Exit</summary>

            <div class="style-v2__field">
                <span class="style-v2__field-label">Presets</span>
                <div class="motion-tab__chips">
                    <button class="chip" @click="applyPreset('exit', 'allOff')">All Off</button>
                    <button class="chip" @click="applyPreset('exit', 'subtle')">Subtle</button>
                    <button class="chip" @click="applyPreset('exit', 'default')">Default</button>
                    <button class="chip" @click="applyPreset('exit', 'snappy')">Snappy</button>
                    <button class="chip" @click="applyPreset('exit', 'dramatic')">Dramatic</button>
                </div>
            </div>

            <AnimatableNumberField
                label="Duration %"
                :model-value="Number(sectionState('exit').fraction * 100)"
                :min="0"
                :max="100"
                :step="0.1"
                :fallback-value="30"
                :display-decimals="1"
                @update:model-value="(v:number) => updateSection('exit', { fraction: Math.max(0, Math.min(1, v / 100)) })"
            />

            <div class="style-v2__field">
                <span class="style-v2__field-label">Fade</span>
                <div class="segmented-control">
                    <button
                        :class="{ active: !sectionState('exit').fade.enabled }"
                        @click="setFadeEnabled('exit', false)"
                    >Off</button>
                    <button
                        :class="{ active: sectionState('exit').fade.enabled }"
                        @click="setFadeEnabled('exit', true)"
                    >On</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="sectionState('exit').fade.enabled"
                label="To Opacity"
                :model-value="Number(sectionState('exit').fade.opacityEnd)"
                :min="0"
                :max="1"
                :step="0.01"
                :fallback-value="0"
                :display-decimals="2"
                @update:model-value="(v:number) => setFadeBoundary('exit', v)"
            />

            <div class="style-v2__field">
                <span class="style-v2__field-label">Movement</span>
                <div class="segmented-control">
                    <button :class="{ active: !sectionState('exit').move.enabled }" @click="setMoveEnabled('exit', false)">Off</button>
                    <button :class="{ active: sectionState('exit').move.enabled }" @click="setMoveEnabled('exit', true)">On</button>
                </div>
            </div>
            <div v-if="sectionState('exit').move.enabled" class="style-v2__field">
                <span class="style-v2__field-label">Leave Direction</span>
                <div class="segmented-control">
                    <button
                        v-for="d in directionOptions"
                        :key="'exit-dir-' + d.value"
                        :class="{ active: sectionState('exit').move.direction === d.value }"
                        @click="setMoveDirection('exit', d.value)"
                    >{{ d.label }}</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="sectionState('exit').move.enabled"
                label="Offset Distance (px)"
                :model-value="Number(sectionState('exit').move.distancePx)"
                :min="0"
                :step="1"
                :fallback-value="24"
                @update:model-value="(v:number) => setMoveDistance('exit', v)"
            />

            <div class="style-v2__field">
                <span class="style-v2__field-label">Scale</span>
                <div class="segmented-control">
                    <button :class="{ active: !sectionState('exit').scale.enabled }" @click="setScaleEnabled('exit', false)">Off</button>
                    <button :class="{ active: sectionState('exit').scale.enabled }" @click="setScaleEnabled('exit', true)">On</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="sectionState('exit').scale.enabled"
                label="End Scale Delta"
                :model-value="Number(sectionState('exit').scale.amount)"
                :min="0"
                :step="0.01"
                :fallback-value="0.12"
                :display-decimals="2"
                @update:model-value="(v:number) => setScaleAmount('exit', v)"
            />

            <div class="style-v2__field">
                <span class="style-v2__field-label">Easing</span>
                <select
                    class="inspector-input"
                    :value="sectionState('exit').easing"
                    @change="updateSection('exit', { easing: ($event.target as HTMLSelectElement).value as MotionAnimationEasing })"
                >
                    <option v-for="e in easingOptions" :key="'exit-ease-' + e.value" :value="e.value">{{ e.label }}</option>
                </select>
            </div>
        </details>
    </div>
</template>
