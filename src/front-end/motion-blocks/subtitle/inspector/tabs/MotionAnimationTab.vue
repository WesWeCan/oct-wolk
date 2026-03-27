<script setup lang="ts">
import type { MotionEnterExit, MotionTrack } from '@/types/project_types';
import MotionEnterExitEditor from '@/front-end/components/editor/motion/MotionEnterExitEditor.vue';
import MotionTextRevealEditor from '@/front-end/components/editor/motion/MotionTextRevealEditor.vue';
import type { TextRevealParams } from '@/front-end/utils/motion/textReveal';

const props = withDefaults(defineProps<{
    track: MotionTrack;
    enterValue?: MotionEnterExit | null;
    exitValue?: MotionEnterExit | null;
    revealValue?: TextRevealParams | null;
    showReveal?: boolean;
    revealDisabled?: boolean;
}>(), {
    showReveal: true,
    revealDisabled: false,
});

const emit = defineEmits<{
    (e: 'update-enter-exit', which: 'enter' | 'exit', value: MotionEnterExit): void;
    (e: 'update-text-reveal', value: TextRevealParams): void;
}>();

const resolvedEnter = (): MotionEnterExit => props.enterValue ?? props.track.block.enter;
const resolvedExit = (): MotionEnterExit => props.exitValue ?? props.track.block.exit;
</script>

<template>
    <div class="motion-animation-tab">
        <details v-if="showReveal && revealValue" class="style-sub-section" open>
            <summary class="style-sub-section__header">Text Reveal</summary>
            <MotionTextRevealEditor
                :value="revealValue"
                :disabled="revealDisabled"
                @update-text-reveal="(value) => emit('update-text-reveal', value)"
            />
        </details>

        <details class="style-sub-section" open>
            <summary class="style-sub-section__header">Motion</summary>
            <MotionEnterExitEditor
                :enter-value="resolvedEnter()"
                :exit-value="resolvedExit()"
                @update-enter-exit="(which, value) => emit('update-enter-exit', which, value)"
            />
        </details>
    </div>
</template>
