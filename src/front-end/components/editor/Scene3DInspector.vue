<script setup lang="ts">
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import { computed } from 'vue';
import type { Scene3DSettings } from '@/types/project_types';

const props = defineProps<{
    scene3d: Scene3DSettings;
    visible?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update-scene3d', value: Scene3DSettings): void;
}>();

const scene3dEnabled = computed(() => props.scene3d.enabled === true);

const updateScene3D = (patch: Partial<Scene3DSettings>) => {
    emit('update-scene3d', {
        ...props.scene3d,
        ...patch,
        globalLighting: {
            ...props.scene3d.globalLighting,
            ...(patch.globalLighting || {}),
        },
    });
};
</script>

<template>
    <details v-if="visible !== false" class="inspector-section">
        <summary class="inspector-section__title">3D Scene</summary>
        <div class="inspector-section__content">
            <div class="motion-tab style-v2">
                <div class="style-v2__field">
                    <span class="style-v2__field-label">Global Lighting</span>
                    <div class="segmented-control">
                        <button :class="{ active: scene3dEnabled }" @click="updateScene3D({ enabled: true })">Enabled</button>
                        <button :class="{ active: !scene3dEnabled }" @click="updateScene3D({ enabled: false })">Disabled</button>
                    </div>
                </div>

                <div class="style-v2__field">
                    <span class="style-v2__field-label">Ambient Color</span>
                    <div class="color-field">
                        <input type="color" class="color-field__swatch" :value="scene3d.globalLighting.ambientColor" @input="updateScene3D({ globalLighting: { ambientColor: ($event.target as HTMLInputElement).value } as any })" />
                        <input type="text" class="color-field__hex inspector-input" :value="scene3d.globalLighting.ambientColor" @change="updateScene3D({ globalLighting: { ambientColor: ($event.target as HTMLInputElement).value } as any })" />
                    </div>
                </div>
                <AnimatableNumberField label="Ambient Intensity" :model-value="scene3d.globalLighting.ambientIntensity" :min="0" :max="10" :step="0.01" :display-decimals="2" @update:model-value="updateScene3D({ globalLighting: { ambientIntensity: $event } as any })" />

                <div class="style-v2__field">
                    <span class="style-v2__field-label">Directional Color</span>
                    <div class="color-field">
                        <input type="color" class="color-field__swatch" :value="scene3d.globalLighting.directionalColor" @input="updateScene3D({ globalLighting: { directionalColor: ($event.target as HTMLInputElement).value } as any })" />
                        <input type="text" class="color-field__hex inspector-input" :value="scene3d.globalLighting.directionalColor" @change="updateScene3D({ globalLighting: { directionalColor: ($event.target as HTMLInputElement).value } as any })" />
                    </div>
                </div>
                <AnimatableNumberField label="Directional Intensity" :model-value="scene3d.globalLighting.directionalIntensity" :min="0" :max="20" :step="0.01" :display-decimals="2" @update:model-value="updateScene3D({ globalLighting: { directionalIntensity: $event } as any })" />
                <AnimatableNumberField label="Directional Azimuth" :model-value="scene3d.globalLighting.directionalAzimuth" :min="-180" :max="180" :step="1" @update:model-value="updateScene3D({ globalLighting: { directionalAzimuth: $event } as any })" />
                <AnimatableNumberField label="Directional Elevation" :model-value="scene3d.globalLighting.directionalElevation" :min="-89" :max="89" :step="1" @update:model-value="updateScene3D({ globalLighting: { directionalElevation: $event } as any })" />
            </div>
        </div>
    </details>
</template>
