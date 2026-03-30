<script setup lang="ts">
const props = defineProps<{
    overlayOpts: {
        showEnergy: boolean;
        showBeats: boolean;
        showBands: boolean;
        showBeatStrength: boolean;
    };
}>();

const emit = defineEmits<{
    (e: 'update:overlayOpts', value: {
        showEnergy: boolean;
        showBeats: boolean;
        showBands: boolean;
        showBeatStrength: boolean;
    }): void;
}>();

const toggleOverlay = (key: keyof typeof props.overlayOpts) => {
    emit('update:overlayOpts', { ...props.overlayOpts, [key]: !props.overlayOpts[key] });
};
</script>

<template>
    <details class="inspector-section">
        <summary class="inspector-section__title">Analysis Overlays</summary>
        <div class="inspector-section__content">
            <label class="overlay-toggle">
                <input type="checkbox" :checked="overlayOpts.showEnergy" @change="toggleOverlay('showEnergy')" />
                Energy
            </label>
            <label class="overlay-toggle">
                <input type="checkbox" :checked="overlayOpts.showBeats" @change="toggleOverlay('showBeats')" />
                Beats
            </label>
            <label class="overlay-toggle">
                <input type="checkbox" :checked="overlayOpts.showBeatStrength" @change="toggleOverlay('showBeatStrength')" />
                Beat Strength
            </label>
            <label class="overlay-toggle">
                <input type="checkbox" :checked="overlayOpts.showBands" @change="toggleOverlay('showBands')" />
                Frequency Bands
            </label>
        </div>
    </details>
</template>
