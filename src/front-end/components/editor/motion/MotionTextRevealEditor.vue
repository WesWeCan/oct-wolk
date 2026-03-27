<script setup lang="ts">
import { computed, watch } from 'vue';
import TypewriterTimingRangeField from '@/front-end/components/editor/motion/TypewriterTimingRangeField.vue';
import {
    DEFAULT_TYPEWRITER_ENTER_PORTION,
    DEFAULT_TYPEWRITER_EXIT_PORTION,
    resolveTextRevealParams,
    type TextRevealMode,
    type TextRevealParams,
} from '@/front-end/utils/motion/textReveal';

const props = withDefaults(defineProps<{
    value: TextRevealParams;
    disabled?: boolean;
}>(), {
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update-text-reveal', value: TextRevealParams): void;
}>();

const resolved = computed(() => resolveTextRevealParams(props.value));
const isLegacyTypewriterPlaceholder = computed(() => (
    resolved.value.textRevealMode === 'typewriter'
    && resolved.value.textRevealEnterPortion === 1
    && resolved.value.textRevealExitPortion === 1
));

const displayEnterPortion = computed(() => (
    isLegacyTypewriterPlaceholder.value
        ? DEFAULT_TYPEWRITER_ENTER_PORTION
        : resolved.value.textRevealEnterPortion
));
const displayExitPortion = computed(() => (
    isLegacyTypewriterPlaceholder.value
        ? DEFAULT_TYPEWRITER_EXIT_PORTION
        : resolved.value.textRevealExitPortion
));

const emitPatch = (patch: Partial<TextRevealParams>) => {
    emit('update-text-reveal', {
        ...resolved.value,
        ...patch,
    });
};

const percentFromPortion = (portion: number): number => Math.round(portion * 100);
const portionFromPercent = (percent: number): number => Math.max(0.01, Math.min(1, percent / 100));
const rangeStart = computed(() => percentFromPortion(displayEnterPortion.value));
const rangeEnd = computed(() => 100 - percentFromPortion(displayExitPortion.value));
const holdPercent = computed(() => Math.max(0, rangeEnd.value - rangeStart.value));

watch(isLegacyTypewriterPlaceholder, (value) => {
    if (!value || props.disabled) return;
    emitPatch({
        textRevealEnterPortion: DEFAULT_TYPEWRITER_ENTER_PORTION,
        textRevealExitPortion: DEFAULT_TYPEWRITER_EXIT_PORTION,
    });
}, { immediate: true });

const updateMode = (mode: TextRevealMode) => {
    if (mode !== 'typewriter') {
        emitPatch({ textRevealMode: mode });
        return;
    }

    emitPatch({
        textRevealMode: mode,
        textRevealEnterPortion: resolved.value.textRevealMode === 'typewriter'
            ? resolved.value.textRevealEnterPortion
            : DEFAULT_TYPEWRITER_ENTER_PORTION,
        textRevealExitPortion: resolved.value.textRevealMode === 'typewriter'
            ? resolved.value.textRevealExitPortion
            : DEFAULT_TYPEWRITER_EXIT_PORTION,
    });
};
const updateEnterPortion = (percent: number) => emitPatch({
    textRevealEnterPortion: portionFromPercent(percent),
});
const updateExitBoundary = (percent: number) => emitPatch({
    textRevealExitPortion: portionFromPercent(100 - percent),
});
const updateShowCursor = (enabled: boolean) => emitPatch({
    textRevealShowCursor: enabled,
});
</script>

<template>
    <div class="motion-text-reveal-editor">
        <div class="inspector-field">
            <label>Mode</label>
            <span class="inspector-hint">
                Controls how characters enter and exit. Uses the block's enter and exit timing windows.
            </span>
            <div class="segmented-control">
                <button
                    :class="{ active: resolved.textRevealMode === 'none' }"
                    :disabled="disabled"
                    @click="updateMode('none')"
                >Off</button>
                <button
                    :class="{ active: resolved.textRevealMode === 'typewriter' }"
                    :disabled="disabled"
                    @click="updateMode('typewriter')"
                >Typewriter</button>
            </div>
        </div>

        <template v-if="resolved.textRevealMode === 'typewriter'">
            <div class="inspector-note">
                Typewriter usually looks best with Motion Off or very subtle motion. If it feels too busy, use the Motion section's All Off preset.
            </div>

            <TypewriterTimingRangeField
                label="Typewriter Timing"
                :start-value="rangeStart"
                :end-value="rangeEnd"
                hint="Type, hold, and delete across the shared reveal window."
                @update:start-value="updateEnterPortion"
                @update:end-value="updateExitBoundary"
            />

            <div class="inspector-field">
                <label>Cursor</label>
                <div class="segmented-control">
                    <button
                        type="button"
                        :class="{ active: !resolved.textRevealShowCursor }"
                        :disabled="disabled"
                        @click="updateShowCursor(false)"
                    >Off</button>
                    <button
                        type="button"
                        :class="{ active: resolved.textRevealShowCursor }"
                        :disabled="disabled"
                        @click="updateShowCursor(true)"
                    >On</button>
                </div>
                <span class="inspector-hint">Show a typing cursor while entering or backspacing.</span>
            </div>

            <div class="motion-text-reveal-editor__stats">
                <div class="motion-text-reveal-editor__stat">
                    <span>Type</span>
                    <strong>{{ percentFromPortion(displayEnterPortion) }}%</strong>
                </div>
                <div class="motion-text-reveal-editor__stat">
                    <span>Delete</span>
                    <strong>{{ percentFromPortion(displayExitPortion) }}%</strong>
                </div>
                <div class="motion-text-reveal-editor__stat">
                    <span>Hold</span>
                    <strong>{{ holdPercent }}%</strong>
                </div>
            </div>
        </template>
    </div>
</template>
