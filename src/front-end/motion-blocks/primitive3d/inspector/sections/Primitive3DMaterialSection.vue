<script setup lang="ts">
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import type { Primitive3DInspectorApi } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';

defineProps<{
    api: Primitive3DInspectorApi;
}>();
</script>

<template>
    <details class="inspector-section">
        <summary class="inspector-section__title">Material</summary>
        <div class="inspector-section__content">
            <div class="motion-tab style-v2">
                <details class="style-sub-section" open>
                    <summary class="style-sub-section__header">Surface</summary>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Surface Mode</span>
                        <div class="segmented-control segmented-control--wrap">
                            <button type="button" :class="{ active: api.params.material.renderMode === 'solid' }" @click="api.updateRenderMode('solid')">Solid</button>
                            <button type="button" :class="{ active: api.params.material.renderMode === 'wireframe' }" @click="api.updateRenderMode('wireframe')">Wire</button>
                            <button type="button" :class="{ active: api.params.material.renderMode === 'solid-wireframe' }" @click="api.updateRenderMode('solid-wireframe')">Hybrid</button>
                        </div>
                    </div>
                    <div v-if="api.params.primitive.type === 'model'" class="style-v2__field">
                        <span class="style-v2__field-label">Texture Blend</span>
                        <div class="segmented-control segmented-control--wrap">
                            <button type="button" :class="{ active: api.params.material.textureMode === 'color-only' }" @click="api.updateTextureMode('color-only')">Color</button>
                            <button type="button" :disabled="!api.params.primitive.modelTextureUrl" :class="{ active: api.params.material.textureMode === 'texture-only' }" @click="api.updateTextureMode('texture-only')">Texture</button>
                            <button type="button" :disabled="!api.params.primitive.modelTextureUrl" :class="{ active: api.params.material.textureMode === 'texture-with-tint' }" @click="api.updateTextureMode('texture-with-tint')">Tinted Texture</button>
                        </div>
                    </div>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Color</span>
                        <div class="color-field">
                            <input type="color" class="color-field__swatch" :value="api.params.material.color" :disabled="api.isLocked" @input="api.updatePathValue('params.material.color', ($event.target as HTMLInputElement).value)" />
                            <input type="text" class="color-field__hex inspector-input" :value="api.params.material.color" :disabled="api.isLocked" @change="api.updatePathValue('params.material.color', ($event.target as HTMLInputElement).value)" />
                        </div>
                    </div>
                    <div v-if="api.params.primitive.type === 'model'" class="inspector-note">
                        Use Tinted Texture for the best “scanner texture plus art-directed highlight” balance.
                    </div>
                    <AnimatableNumberField label="Roughness" :model-value="api.valueForPath('params.material.roughness')" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.material.roughness')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.material.roughness')" :has-any-keyframes="api.hasAnyKeyframes('params.material.roughness')" @update:model-value="api.updatePathValue('params.material.roughness', $event)" @toggle-keyframe="api.toggleKeyframe('params.material.roughness', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.material.roughness')" />
                    <AnimatableNumberField label="Metalness" :model-value="api.valueForPath('params.material.metalness')" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.material.metalness')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.material.metalness')" :has-any-keyframes="api.hasAnyKeyframes('params.material.metalness')" @update:model-value="api.updatePathValue('params.material.metalness', $event)" @toggle-keyframe="api.toggleKeyframe('params.material.metalness', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.material.metalness')" />
                    <AnimatableNumberField label="Opacity" :model-value="api.valueForPath('params.material.opacity')" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.material.opacity')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.material.opacity')" :has-any-keyframes="api.hasAnyKeyframes('params.material.opacity')" @update:model-value="api.updatePathValue('params.material.opacity', $event)" @toggle-keyframe="api.toggleKeyframe('params.material.opacity', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.material.opacity')" />
                </details>

                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Wireframe</summary>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Wire Color</span>
                        <div class="color-field">
                            <input type="color" class="color-field__swatch" :value="api.params.material.wireColor" :disabled="api.isLocked" @input="api.updatePathValue('params.material.wireColor', ($event.target as HTMLInputElement).value)" />
                            <input type="text" class="color-field__hex inspector-input" :value="api.params.material.wireColor" :disabled="api.isLocked" @change="api.updatePathValue('params.material.wireColor', ($event.target as HTMLInputElement).value)" />
                        </div>
                    </div>
                    <AnimatableNumberField label="Wire Opacity" :model-value="api.params.material.wireOpacity" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.material.wireOpacity', $event)" />
                </details>
            </div>
        </div>
    </details>
</template>
