<script setup lang="ts">
import type {
    MotionAnimationDirection,
    MotionAnimationEasing,
    MotionAnimationStyle,
    MotionEnterExit,
    MotionTrack,
} from '@/types/project_types';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import TypewriterTimingRangeField from '@/front-end/components/editor/motion/TypewriterTimingRangeField.vue';

const props = defineProps<{
    track: MotionTrack;
    enterValue?: MotionEnterExit | null;
    exitValue?: MotionEnterExit | null;
}>();

const emit = defineEmits<{
    (e: 'update-enter-exit', which: 'enter' | 'exit', value: MotionEnterExit): void;
    (e: 'update-enter-exits', value: { enter?: MotionEnterExit; exit?: MotionEnterExit }): void;
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

type SharedAnimationMode = 'standard' | 'typewriter';
type StandardAnimationPreset = 'subtle' | 'default' | 'snappy' | 'dramatic';
type TypewriterAnimationPreset = 'snappy' | 'balanced' | 'lingering';

const resolveLegacyStyle = (config: MotionEnterExit): MotionAnimationStyle => {
    const style = config.style ?? 'fade';
    if (style === 'none') return 'none';
    if (style === 'slideUp' || style === 'slideDown' || style === 'slideLeft' || style === 'slideRight') return style;
    if (style === 'scale') return style;
    if (style === 'typewriter') return style;
    return 'fade';
};

const defaultDirectionFor = (which: 'enter' | 'exit'): MotionAnimationDirection => {
    return which === 'enter' ? 'up' : 'down';
};

const deriveStyleFromComposer = (config: MotionEnterExit): MotionAnimationStyle => {
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
    const fadeEnabledDefault = legacyStyle !== 'none' && legacyStyle !== 'typewriter';
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
    if (config.style === 'typewriter') return 'typewriter';
    return deriveStyleFromComposer(config);
};

const sectionState = (which: 'enter' | 'exit'): MotionEnterExit => {
    const source = which === 'enter'
        ? (props.enterValue ?? props.track.block.enter)
        : (props.exitValue ?? props.track.block.exit);
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

const setRevealMode = (which: 'enter' | 'exit', mode: 'standard' | 'typewriter') => {
    const current = sectionState(which);
    if (mode === 'typewriter') {
        updateSection(which, {
            style: 'typewriter',
            showCursor: current.showCursor ?? false,
            fade: {
                enabled: false,
                opacityStart: 1,
                opacityEnd: 1,
            },
            move: {
                enabled: false,
            },
            scale: {
                enabled: false,
            },
        });
        return;
    }

    updateSection(which, current.style === 'typewriter'
        ? {
            style: 'fade',
            showCursor: false,
            fade: {
                enabled: true,
                opacityStart: which === 'enter' ? 0 : 1,
                opacityEnd: which === 'enter' ? 1 : 0,
            },
        }
        : {
            style: deriveStyleFromComposer({ ...current, style: 'fade' }),
        });
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

const buildSectionValue = (which: 'enter' | 'exit', patch: Partial<MotionEnterExit>): MotionEnterExit => {
    const current = sectionState(which);
    return {
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
};

const emitSections = (patches: { enter?: Partial<MotionEnterExit>; exit?: Partial<MotionEnterExit> }) => {
    const payload: { enter?: MotionEnterExit; exit?: MotionEnterExit } = {};

    if (patches.enter) payload.enter = buildSectionValue('enter', patches.enter);
    if (patches.exit) payload.exit = buildSectionValue('exit', patches.exit);

    emit('update-enter-exits', payload);
};

const applyStandardPreset = (which: 'enter' | 'exit', preset: StandardAnimationPreset) => {
    if (preset === 'subtle') {
        updateSection(which, {
            fraction: 0.24,
            minFrames: 2,
            maxFrames: 22,
            easing: 'easeOut',
            style: 'fade',
            showCursor: false,
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
            style: 'fade',
            showCursor: false,
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
            style: 'fade',
            showCursor: false,
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
        style: 'fade',
        showCursor: false,
        fade: {
            enabled: true,
            opacityStart: which === 'enter' ? 0 : 1,
            opacityEnd: which === 'enter' ? 1 : 0,
        },
        move: { enabled: true, direction: defaultDirectionFor(which), distancePx: 180 },
        scale: { enabled: true, amount: 0.8 },
    });
};

const isTypewriter = (which: 'enter' | 'exit') => sectionState(which).style === 'typewriter';

const sectionMode = (which: 'enter' | 'exit'): SharedAnimationMode => (isTypewriter(which) ? 'typewriter' : 'standard');

const sharedMode = (): SharedAnimationMode => (
    isTypewriter('enter') && isTypewriter('exit')
        ? 'typewriter'
        : 'standard'
);

const hasModeOverride = () => sectionMode('enter') !== sectionMode('exit');

const isTypewriterActive = () => isTypewriter('enter') || isTypewriter('exit');

const typewriterRangeStart = () => (isTypewriter('enter') ? Number(sectionState('enter').fraction * 100) : 0);

const typewriterRangeEnd = () => (isTypewriter('exit') ? Number(100 - (sectionState('exit').fraction * 100)) : 100);

const setTypewriterWindow = (patch: { start?: number; end?: number }) => {
    let start = Math.max(0, Math.min(100, patch.start ?? typewriterRangeStart()));
    let end = Math.max(0, Math.min(100, patch.end ?? typewriterRangeEnd()));

    if (start > end) {
        if (patch.start !== undefined && patch.end === undefined) {
            end = start;
        } else {
            start = end;
        }
    }

    emitSections({
        enter: isTypewriter('enter')
            ? { fraction: Math.max(0, Math.min(1, start / 100)) }
            : undefined,
        exit: isTypewriter('exit')
            ? { fraction: Math.max(0, Math.min(1, (100 - end) / 100)) }
            : undefined,
    });
};

const typewriterCursorEnabled = () => Boolean(sectionState('enter').showCursor || sectionState('exit').showCursor);

const setTypewriterCursor = (enabled: boolean) => {
    emitSections({
        enter: { showCursor: enabled },
        exit: { showCursor: enabled },
    });
};

const setSharedMode = (mode: SharedAnimationMode) => {
    if (mode === 'typewriter') {
        emitSections({
            enter: {
                style: 'typewriter',
                showCursor: sectionState('enter').showCursor ?? false,
                fade: {
                    enabled: false,
                    opacityStart: 1,
                    opacityEnd: 1,
                },
                move: {
                    enabled: false,
                },
                scale: {
                    enabled: false,
                },
            },
            exit: {
                style: 'typewriter',
                showCursor: sectionState('exit').showCursor ?? false,
                fade: {
                    enabled: false,
                    opacityStart: 1,
                    opacityEnd: 1,
                },
                move: {
                    enabled: false,
                },
                scale: {
                    enabled: false,
                },
            },
        });
        return;
    }

    emitSections({
        enter: sectionState('enter').style === 'typewriter'
            ? {
                style: 'fade',
                showCursor: false,
                fade: {
                    enabled: true,
                    opacityStart: 0,
                    opacityEnd: 1,
                },
            }
            : {
                style: deriveStyleFromComposer({ ...sectionState('enter'), style: 'fade' }),
            },
        exit: sectionState('exit').style === 'typewriter'
            ? {
                style: 'fade',
                showCursor: false,
                fade: {
                    enabled: true,
                    opacityStart: 1,
                    opacityEnd: 0,
                },
            }
            : {
                style: deriveStyleFromComposer({ ...sectionState('exit'), style: 'fade' }),
            },
    });
};

const applyStandardPresetToBoth = (preset: StandardAnimationPreset) => {
    applyStandardPreset('enter', preset);
    applyStandardPreset('exit', preset);
};

const applyTypewriterPresetToBoth = (preset: TypewriterAnimationPreset) => {
    const showCursor = typewriterCursorEnabled();
    if (preset === 'snappy') {
        emitSections({
            enter: {
                style: 'typewriter',
                fraction: 0.18,
                easing: 'linear',
                showCursor,
                fade: { enabled: false, opacityStart: 1, opacityEnd: 1 },
                move: { enabled: false },
                scale: { enabled: false },
            },
            exit: {
                style: 'typewriter',
                fraction: 0.12,
                easing: 'linear',
                showCursor,
                fade: { enabled: false, opacityStart: 1, opacityEnd: 1 },
                move: { enabled: false },
                scale: { enabled: false },
            },
        });
        return;
    }

    if (preset === 'balanced') {
        emitSections({
            enter: {
                style: 'typewriter',
                fraction: 0.3,
                easing: 'easeOut',
                showCursor,
                fade: { enabled: false, opacityStart: 1, opacityEnd: 1 },
                move: { enabled: false },
                scale: { enabled: false },
            },
            exit: {
                style: 'typewriter',
                fraction: 0.2,
                easing: 'easeInOut',
                showCursor,
                fade: { enabled: false, opacityStart: 1, opacityEnd: 1 },
                move: { enabled: false },
                scale: { enabled: false },
            },
        });
        return;
    }

    emitSections({
        enter: {
            style: 'typewriter',
            fraction: 0.45,
            easing: 'easeOut',
            showCursor,
            fade: { enabled: false, opacityStart: 1, opacityEnd: 1 },
            move: { enabled: false },
            scale: { enabled: false },
        },
        exit: {
            style: 'typewriter',
            fraction: 0.12,
            easing: 'easeInOut',
            showCursor,
            fade: { enabled: false, opacityStart: 1, opacityEnd: 1 },
            move: { enabled: false },
            scale: { enabled: false },
        },
    });
};
</script>

<template>
    <div class="motion-tab style-v2 motion-animation-v2">
        <details class="style-sub-section" open>
            <summary class="style-sub-section__header">Animation Mode</summary>

            <div class="style-v2__field">
                <span class="style-v2__field-label">Mode</span>
                <div class="segmented-control">
                    <button
                        :class="{ active: sharedMode() === 'standard' }"
                        @click="setSharedMode('standard')"
                    >Standard</button>
                    <button
                        :class="{ active: sharedMode() === 'typewriter' }"
                        @click="setSharedMode('typewriter')"
                    >Typewriter</button>
                </div>
                <span v-if="hasModeOverride()" class="inspector-hint">
                    Advanced override active. Enter and Exit are using different modes.
                </span>
            </div>

            <div class="style-v2__field">
                <span class="style-v2__field-label">Presets</span>
                <div v-if="sharedMode() === 'typewriter'" class="motion-tab__chips">
                    <button class="chip" @click="applyTypewriterPresetToBoth('snappy')">Snappy</button>
                    <button class="chip" @click="applyTypewriterPresetToBoth('balanced')">Balanced</button>
                    <button class="chip" @click="applyTypewriterPresetToBoth('lingering')">Lingering</button>
                </div>
                <div v-else class="motion-tab__chips">
                    <button class="chip" @click="applyStandardPresetToBoth('subtle')">Subtle</button>
                    <button class="chip" @click="applyStandardPresetToBoth('default')">Default</button>
                    <button class="chip" @click="applyStandardPresetToBoth('snappy')">Snappy</button>
                    <button class="chip" @click="applyStandardPresetToBoth('dramatic')">Dramatic</button>
                </div>
            </div>

            

            <TypewriterTimingRangeField
                v-if="isTypewriterActive()"
                label="Typing / Backspace Window"
                hint="Drag the handles to choose where typing stops and backspace starts."
                :start-value="typewriterRangeStart()"
                :end-value="typewriterRangeEnd()"
                :start-enabled="isTypewriter('enter')"
                :end-enabled="isTypewriter('exit')"
                :step="1"
                @update:start-value="(value:number) => setTypewriterWindow({ start: value })"
                @update:end-value="(value:number) => setTypewriterWindow({ end: value })"
            />

            <div v-if="isTypewriterActive()" class="style-v2__field">
                <span class="style-v2__field-label">Cursor</span>
                <div class="segmented-control">
                    <button
                        :class="{ active: !typewriterCursorEnabled() }"
                        @click="setTypewriterCursor(false)"
                    >Off</button>
                    <button
                        :class="{ active: typewriterCursorEnabled() }"
                        @click="setTypewriterCursor(true)"
                    >On</button>
                </div>
            </div>

            <details class="motion-animation-v2__override" :open="hasModeOverride()">
                <summary class="motion-animation-v2__override-summary">Advanced Override</summary>

                <div class="style-v2__field">
                    <span class="style-v2__field-label">Enter Mode</span>
                    <div class="segmented-control">
                        <button
                            :class="{ active: sectionMode('enter') === 'standard' }"
                            @click="setRevealMode('enter', 'standard')"
                        >Standard</button>
                        <button
                            :class="{ active: sectionMode('enter') === 'typewriter' }"
                            @click="setRevealMode('enter', 'typewriter')"
                        >Typewriter</button>
                    </div>
                </div>

                <div class="style-v2__field">
                    <span class="style-v2__field-label">Exit Mode</span>
                    <div class="segmented-control">
                        <button
                            :class="{ active: sectionMode('exit') === 'standard' }"
                            @click="setRevealMode('exit', 'standard')"
                        >Standard</button>
                        <button
                            :class="{ active: sectionMode('exit') === 'typewriter' }"
                            @click="setRevealMode('exit', 'typewriter')"
                        >Typewriter</button>
                    </div>
                </div>
            </details>
        </details>

        <details class="style-sub-section" open>
            <summary class="style-sub-section__header">Enter</summary>

            <p v-if="isTypewriter('enter')" class="motion-animation-v2__section-note">
                Enter timing is controlled by the shared typewriter range above.
            </p>

            <AnimatableNumberField
                v-if="!isTypewriter('enter')"
                label="Duration %"
                :model-value="Number(sectionState('enter').fraction * 100)"
                :min="0"
                :max="100"
                :step="0.1"
                :fallback-value="30"
                :display-decimals="1"
                @update:model-value="(v:number) => updateSection('enter', { fraction: Math.max(0, Math.min(1, v / 100)) })"
            />

            <div v-if="!isTypewriter('enter')" class="style-v2__field">
                <span class="style-v2__field-label">Fade</span>
                <div class="segmented-control">
                    <button
                        :class="{ active: !sectionState('enter').fade.enabled }"
                        @click="updateSection('enter', { fade: { enabled: false, opacityStart: 1, opacityEnd: 1 } })"
                    >Off</button>
                    <button
                        :class="{ active: sectionState('enter').fade.enabled }"
                        @click="updateSection('enter', { fade: { enabled: true, opacityStart: 0, opacityEnd: 1 } })"
                    >On</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="!isTypewriter('enter') && sectionState('enter').fade.enabled"
                label="From Opacity"
                :model-value="Number(sectionState('enter').fade.opacityStart)"
                :min="0"
                :max="1"
                :step="0.01"
                :fallback-value="0"
                :display-decimals="2"
                @update:model-value="(v:number) => updateSection('enter', { fade: { opacityStart: Math.max(0, Math.min(1, v)), opacityEnd: 1 } })"
            />

            <div v-if="!isTypewriter('enter')" class="style-v2__field">
                <span class="style-v2__field-label">Movement</span>
                <div class="segmented-control">
                    <button :class="{ active: !sectionState('enter').move.enabled }" @click="updateSection('enter', { move: { enabled: false } })">Off</button>
                    <button :class="{ active: sectionState('enter').move.enabled }" @click="updateSection('enter', { move: { enabled: true } })">On</button>
                </div>
            </div>
            <div v-if="!isTypewriter('enter') && sectionState('enter').move.enabled" class="style-v2__field">
                <span class="style-v2__field-label">From Direction</span>
                <div class="segmented-control">
                    <button
                        v-for="d in directionOptions"
                        :key="'enter-dir-' + d.value"
                        :class="{ active: sectionState('enter').move.direction === d.value }"
                        @click="updateSection('enter', { move: { direction: d.value } })"
                    >{{ d.label }}</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="!isTypewriter('enter') && sectionState('enter').move.enabled"
                label="Offset Distance (px)"
                :model-value="Number(sectionState('enter').move.distancePx)"
                :min="0"
                :step="1"
                :fallback-value="24"
                @update:model-value="(v:number) => updateSection('enter', { move: { distancePx: Math.max(0, v) } })"
            />

            <div v-if="!isTypewriter('enter')" class="style-v2__field">
                <span class="style-v2__field-label">Scale</span>
                <div class="segmented-control">
                    <button :class="{ active: !sectionState('enter').scale.enabled }" @click="updateSection('enter', { scale: { enabled: false } })">Off</button>
                    <button :class="{ active: sectionState('enter').scale.enabled }" @click="updateSection('enter', { scale: { enabled: true } })">On</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="!isTypewriter('enter') && sectionState('enter').scale.enabled"
                label="Start Scale Delta"
                :model-value="Number(sectionState('enter').scale.amount)"
                :min="0"
                :step="0.01"
                :fallback-value="0.12"
                :display-decimals="2"
                @update:model-value="(v:number) => updateSection('enter', { scale: { amount: Math.max(0, v) } })"
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

            <p v-if="isTypewriter('exit')" class="motion-animation-v2__section-note">
                Exit backspace timing is controlled by the shared typewriter range above.
            </p>

            <AnimatableNumberField
                v-if="!isTypewriter('exit')"
                label="Duration %"
                :model-value="Number(sectionState('exit').fraction * 100)"
                :min="0"
                :max="100"
                :step="0.1"
                :fallback-value="30"
                :display-decimals="1"
                @update:model-value="(v:number) => updateSection('exit', { fraction: Math.max(0, Math.min(1, v / 100)) })"
            />

            <div v-if="!isTypewriter('exit')" class="style-v2__field">
                <span class="style-v2__field-label">Fade</span>
                <div class="segmented-control">
                    <button
                        :class="{ active: !sectionState('exit').fade.enabled }"
                        @click="updateSection('exit', { fade: { enabled: false, opacityStart: 1, opacityEnd: 1 } })"
                    >Off</button>
                    <button
                        :class="{ active: sectionState('exit').fade.enabled }"
                        @click="updateSection('exit', { fade: { enabled: true, opacityStart: 1, opacityEnd: 0 } })"
                    >On</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="!isTypewriter('exit') && sectionState('exit').fade.enabled"
                label="To Opacity"
                :model-value="Number(sectionState('exit').fade.opacityEnd)"
                :min="0"
                :max="1"
                :step="0.01"
                :fallback-value="0"
                :display-decimals="2"
                @update:model-value="(v:number) => updateSection('exit', { fade: { opacityStart: 1, opacityEnd: Math.max(0, Math.min(1, v)) } })"
            />

            <div v-if="!isTypewriter('exit')" class="style-v2__field">
                <span class="style-v2__field-label">Movement</span>
                <div class="segmented-control">
                    <button :class="{ active: !sectionState('exit').move.enabled }" @click="updateSection('exit', { move: { enabled: false } })">Off</button>
                    <button :class="{ active: sectionState('exit').move.enabled }" @click="updateSection('exit', { move: { enabled: true } })">On</button>
                </div>
            </div>
            <div v-if="!isTypewriter('exit') && sectionState('exit').move.enabled" class="style-v2__field">
                <span class="style-v2__field-label">Leave Direction</span>
                <div class="segmented-control">
                    <button
                        v-for="d in directionOptions"
                        :key="'exit-dir-' + d.value"
                        :class="{ active: sectionState('exit').move.direction === d.value }"
                        @click="updateSection('exit', { move: { direction: d.value } })"
                    >{{ d.label }}</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="!isTypewriter('exit') && sectionState('exit').move.enabled"
                label="Offset Distance (px)"
                :model-value="Number(sectionState('exit').move.distancePx)"
                :min="0"
                :step="1"
                :fallback-value="24"
                @update:model-value="(v:number) => updateSection('exit', { move: { distancePx: Math.max(0, v) } })"
            />

            <div v-if="!isTypewriter('exit')" class="style-v2__field">
                <span class="style-v2__field-label">Scale</span>
                <div class="segmented-control">
                    <button :class="{ active: !sectionState('exit').scale.enabled }" @click="updateSection('exit', { scale: { enabled: false } })">Off</button>
                    <button :class="{ active: sectionState('exit').scale.enabled }" @click="updateSection('exit', { scale: { enabled: true } })">On</button>
                </div>
            </div>
            <AnimatableNumberField
                v-if="!isTypewriter('exit') && sectionState('exit').scale.enabled"
                label="End Scale Delta"
                :model-value="Number(sectionState('exit').scale.amount)"
                :min="0"
                :step="0.01"
                :fallback-value="0.12"
                :display-decimals="2"
                @update:model-value="(v:number) => updateSection('exit', { scale: { amount: Math.max(0, v) } })"
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
