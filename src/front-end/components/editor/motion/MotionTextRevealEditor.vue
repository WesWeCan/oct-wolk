<script setup lang="ts">
import { computed } from 'vue';
import TypewriterTimingRangeField from '@/front-end/components/editor/motion/TypewriterTimingRangeField.vue';
import {
    DEFAULT_TYPEWRITER_ENTER_WINDOW,
    DEFAULT_TYPEWRITER_EXIT_WINDOW,
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

const emitPatch = (patch: Partial<TextRevealParams>) => {
    emit('update-text-reveal', {
        ...resolved.value,
        ...patch,
    });
};

const percentFromPortion = (portion: number): number => Math.round(portion * 100);
const portionFromPercent = (percent: number): number => Math.max(0.01, Math.min(1, percent / 100));
const rangeStart = computed(() => percentFromPortion(resolved.value.textRevealEnterWindow));
const rangeEnd = computed(() => 100 - percentFromPortion(resolved.value.textRevealExitWindow));
const updateMode = (mode: TextRevealMode) => {
    if (mode !== 'typewriter') {
        emitPatch({ textRevealMode: mode });
        return;
    }

    emitPatch({
        textRevealMode: mode,
        textRevealEnterWindow: resolved.value.textRevealMode === 'typewriter'
            ? resolved.value.textRevealEnterWindow
            : DEFAULT_TYPEWRITER_ENTER_WINDOW,
        textRevealExitWindow: resolved.value.textRevealMode === 'typewriter'
            ? resolved.value.textRevealExitWindow
            : DEFAULT_TYPEWRITER_EXIT_WINDOW,
        textRevealEnterPortion: resolved.value.textRevealMode === 'typewriter'
            ? resolved.value.textRevealEnterPortion
            : 1,
        textRevealExitPortion: resolved.value.textRevealMode === 'typewriter'
            ? resolved.value.textRevealExitPortion
            : 1,
    });
};
const updateEnterPortion = (percent: number) => emitPatch({
    textRevealEnterWindow: portionFromPercent(percent),
});
const updateExitBoundary = (percent: number) => emitPatch({
    textRevealExitWindow: portionFromPercent(100 - percent),
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
                Controls how characters enter and exit. Reveal timing is independent from the Motion section.
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
            <span class="inspector-hint">
                Typewriter usually works best with very subtle motion or an `All Off` motion preset.
            </span>

            <TypewriterTimingRangeField
                label="Typewriter Timing"
                :start-value="rangeStart"
                :end-value="rangeEnd"
                hint="Type from the left handle and delete from the right handle."
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
        </template>
    </div>
</template>
