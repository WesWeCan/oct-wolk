<script setup lang="ts">
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import Scene3DInspector from '@/front-end/components/editor/Scene3DInspector.vue';
import type { Primitive3DInspectorApi } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';

defineProps<{
    api: Primitive3DInspectorApi;
}>();
</script>

<template>
    <details class="inspector-section">
        <summary class="inspector-section__title">Lighting</summary>
        <div class="inspector-section__content">
            <div class="motion-tab style-v2">
                <div class="style-v2__field">
                    <span class="style-v2__field-label">Lighting Source</span>
                    <div class="segmented-control">
                        <button type="button" :class="{ active: api.params.lighting.mode === 'global' }" @click="api.updateLightingMode('global')">Global</button>
                        <button type="button" :class="{ active: api.params.lighting.mode === 'local' }" @click="api.updateLightingMode('local')">Local</button>
                    </div>
                </div>
                <span v-if="api.params.lighting.mode === 'global'" class="inspector-hint">
                    Global mode edits the shared project 3D lighting for every block that uses it.
                </span>
                <Scene3DInspector
                    v-if="api.params.lighting.mode === 'global'"
                    :scene3d="api.scene3d"
                    :visible="true"
                    @update-scene3d="api.updateScene3D"
                />
                <template v-else>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Ambient Color</span>
                        <div class="color-field">
                            <input type="color" class="color-field__swatch" :value="api.params.lighting.ambientColor" :disabled="api.isLocked" @input="api.updatePathValue('params.lighting.ambientColor', ($event.target as HTMLInputElement).value)" />
                            <input type="text" class="color-field__hex inspector-input" :value="api.params.lighting.ambientColor" :disabled="api.isLocked" @change="api.updatePathValue('params.lighting.ambientColor', ($event.target as HTMLInputElement).value)" />
                        </div>
                    </div>
                    <AnimatableNumberField label="Ambient Intensity" :model-value="api.params.lighting.ambientIntensity" :min="0" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.lighting.ambientIntensity', $event)" />
                    <span class="inspector-hint">Ambient light fills the whole object evenly.</span>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Directional Color</span>
                        <div class="color-field">
                            <input type="color" class="color-field__swatch" :value="api.params.lighting.directionalColor" :disabled="api.isLocked" @input="api.updatePathValue('params.lighting.directionalColor', ($event.target as HTMLInputElement).value)" />
                            <input type="text" class="color-field__hex inspector-input" :value="api.params.lighting.directionalColor" :disabled="api.isLocked" @change="api.updatePathValue('params.lighting.directionalColor', ($event.target as HTMLInputElement).value)" />
                        </div>
                    </div>
                    <AnimatableNumberField label="Directional Intensity" :model-value="api.valueForPath('params.lighting.directionalIntensity')" :min="0" :max="20" :step="0.01" :display-decimals="2" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.lighting.directionalIntensity')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.lighting.directionalIntensity')" :has-any-keyframes="api.hasAnyKeyframes('params.lighting.directionalIntensity')" @update:model-value="api.updatePathValue('params.lighting.directionalIntensity', $event)" @toggle-keyframe="api.toggleKeyframe('params.lighting.directionalIntensity', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.lighting.directionalIntensity')" />
                    <AnimatableNumberField label="Directional Azimuth" :model-value="api.params.lighting.directionalAzimuth" :min="-180" :max="180" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.lighting.directionalAzimuth', $event)" />
                    <AnimatableNumberField label="Directional Elevation" :model-value="api.params.lighting.directionalElevation" :min="-89" :max="89" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.lighting.directionalElevation', $event)" />
                    <span class="inspector-hint">Azimuth rotates the light around the object. Elevation tilts it up or down.</span>
                </template>
            </div>
        </div>
    </details>
</template>
