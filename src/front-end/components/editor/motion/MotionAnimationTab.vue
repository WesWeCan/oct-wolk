<script setup lang="ts">
import type { MotionTrack, MotionEnterExit, MotionAnimationStyle } from '@/types/project_types';

const props = defineProps<{
    track: MotionTrack;
}>();

const emit = defineEmits<{
    (e: 'update-enter-exit', which: 'enter' | 'exit', key: keyof MotionEnterExit, value: any): void;
}>();

const animStyles: { value: MotionAnimationStyle; label: string }[] = [
    { value: 'fade', label: 'Fade' },
    { value: 'slideUp', label: 'Up' },
    { value: 'slideDown', label: 'Down' },
    { value: 'slideLeft', label: 'Left' },
    { value: 'slideRight', label: 'Right' },
    { value: 'scale', label: 'Scale' },
    { value: 'none', label: 'None' },
];

const easings = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'easeInCubic', 'easeOutCubic'] as const;
</script>

<template>
    <div class="motion-tab">
        <div class="motion-tab__section-label">Enter</div>

        <div class="motion-tab__field">
            <label>Style</label>
            <div class="motion-tab__chips">
                <button
                    v-for="s in animStyles" :key="s.value"
                    class="chip"
                    :class="{ active: track.block.enter.style === s.value }"
                    @click="emit('update-enter-exit', 'enter', 'style', s.value)"
                >{{ s.label }}</button>
            </div>
        </div>

        <div class="motion-tab__field">
            <label>Duration <span class="motion-tab__value">{{ (track.block.enter.fraction * 100).toFixed(0) }}%</span></label>
            <input type="range" class="inspector-input" min="0" max="1" step="0.05" :value="track.block.enter.fraction" @input="emit('update-enter-exit', 'enter', 'fraction', Number(($event.target as HTMLInputElement).value))" />
        </div>

        <div class="motion-tab__field">
            <label>Easing</label>
            <select class="inspector-input" :value="track.block.enter.easing" @change="emit('update-enter-exit', 'enter', 'easing', ($event.target as HTMLSelectElement).value)">
                <option v-for="e in easings" :key="e" :value="e">{{ e }}</option>
            </select>
        </div>

        <div class="motion-tab__row">
            <div class="motion-tab__field">
                <label>Opacity Start</label>
                <input type="number" class="inspector-input" min="0" max="1" step="0.05" :value="track.block.enter.opacityStart" @change="emit('update-enter-exit', 'enter', 'opacityStart', Number(($event.target as HTMLInputElement).value))" />
            </div>
            <div class="motion-tab__field">
                <label>Opacity End</label>
                <input type="number" class="inspector-input" min="0" max="1" step="0.05" :value="track.block.enter.opacityEnd" @change="emit('update-enter-exit', 'enter', 'opacityEnd', Number(($event.target as HTMLInputElement).value))" />
            </div>
        </div>

        <div class="motion-tab__divider"></div>

        <div class="motion-tab__section-label">Exit</div>

        <div class="motion-tab__field">
            <label>Style</label>
            <div class="motion-tab__chips">
                <button
                    v-for="s in animStyles" :key="'exit-' + s.value"
                    class="chip"
                    :class="{ active: track.block.exit.style === s.value }"
                    @click="emit('update-enter-exit', 'exit', 'style', s.value)"
                >{{ s.label }}</button>
            </div>
        </div>

        <div class="motion-tab__field">
            <label>Duration <span class="motion-tab__value">{{ (track.block.exit.fraction * 100).toFixed(0) }}%</span></label>
            <input type="range" class="inspector-input" min="0" max="1" step="0.05" :value="track.block.exit.fraction" @input="emit('update-enter-exit', 'exit', 'fraction', Number(($event.target as HTMLInputElement).value))" />
        </div>

        <div class="motion-tab__field">
            <label>Easing</label>
            <select class="inspector-input" :value="track.block.exit.easing" @change="emit('update-enter-exit', 'exit', 'easing', ($event.target as HTMLSelectElement).value)">
                <option v-for="e in easings" :key="'exit-' + e" :value="e">{{ e }}</option>
            </select>
        </div>

        <div class="motion-tab__row">
            <div class="motion-tab__field">
                <label>Opacity Start</label>
                <input type="number" class="inspector-input" min="0" max="1" step="0.05" :value="track.block.exit.opacityStart" @change="emit('update-enter-exit', 'exit', 'opacityStart', Number(($event.target as HTMLInputElement).value))" />
            </div>
            <div class="motion-tab__field">
                <label>Opacity End</label>
                <input type="number" class="inspector-input" min="0" max="1" step="0.05" :value="track.block.exit.opacityEnd" @change="emit('update-enter-exit', 'exit', 'opacityEnd', Number(($event.target as HTMLInputElement).value))" />
            </div>
        </div>
    </div>
</template>
