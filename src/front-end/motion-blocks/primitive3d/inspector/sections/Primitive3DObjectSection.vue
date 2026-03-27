<script setup lang="ts">
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import type { Primitive3DInspectorApi } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';
import type { Primitive3DType } from '@/front-end/motion-blocks/primitive3d/params';

defineProps<{
    api: Primitive3DInspectorApi;
}>();
</script>

<template>
    <details class="inspector-section" open>
        <summary class="inspector-section__title">Object</summary>
        <div class="inspector-section__content">
            <div class="motion-tab style-v2">
                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Geometry</summary>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Primitive</span>
                        <select aria-label="Primitive type" class="inspector-input" :disabled="api.isLocked" :value="api.params.primitive.type" @change="api.updatePrimitiveType(($event.target as HTMLSelectElement).value as Primitive3DType)">
                            <option value="sphere">Sphere</option>
                            <option value="box">Box</option>
                            <option value="plane">Plane</option>
                            <option value="cylinder">Cylinder</option>
                            <option value="cone">Cone</option>
                            <option value="torus">Torus</option>
                            <option value="icosahedron">Icosahedron</option>
                            <option value="capsule">Capsule</option>
                            <option value="tetrahedron">Tetrahedron</option>
                            <option value="octahedron">Octahedron</option>
                            <option value="dodecahedron">Dodecahedron</option>
                        </select>
                    </div>
                    <AnimatableNumberField label="Sphere Segments" :model-value="api.params.primitive.sphereSegments" :min="8" :max="128" :step="1" :disabled="api.isLocked || api.params.primitive.type !== 'sphere'" @update:model-value="api.updatePathValue('params.primitive.sphereSegments', $event)" />
                    <AnimatableNumberField label="Plane Width" :model-value="api.params.primitive.planeWidth" :min="0.25" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked || api.params.primitive.type !== 'plane'" @update:model-value="api.updatePathValue('params.primitive.planeWidth', $event)" />
                    <AnimatableNumberField label="Plane Height" :model-value="api.params.primitive.planeHeight" :min="0.25" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked || api.params.primitive.type !== 'plane'" @update:model-value="api.updatePathValue('params.primitive.planeHeight', $event)" />
                    <div class="inspector-note">
                        Anchor count now follows the current primitive geometry automatically.
                    </div>
                </details>

                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Models</summary>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Custom Model</span>
                        <button class="btn-sm" type="button" disabled>Import Model (coming later)</button>
                    </div>
                </details>

                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Transform</summary>
                    <AnimatableNumberField label="Position X" :model-value="api.valueForPath('params.object.positionX')" :min="-20" :max="20" :step="0.01" :display-decimals="2" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.object.positionX')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.object.positionX')" :has-any-keyframes="api.hasAnyKeyframes('params.object.positionX')" @update:model-value="api.updatePathValue('params.object.positionX', $event)" @toggle-keyframe="api.toggleKeyframe('params.object.positionX', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.object.positionX')" />
                    <AnimatableNumberField label="Position Y" :model-value="api.valueForPath('params.object.positionY')" :min="-20" :max="20" :step="0.01" :display-decimals="2" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.object.positionY')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.object.positionY')" :has-any-keyframes="api.hasAnyKeyframes('params.object.positionY')" @update:model-value="api.updatePathValue('params.object.positionY', $event)" @toggle-keyframe="api.toggleKeyframe('params.object.positionY', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.object.positionY')" />
                    <AnimatableNumberField label="Position Z" :model-value="api.valueForPath('params.object.positionZ')" :min="-20" :max="20" :step="0.01" :display-decimals="2" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.object.positionZ')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.object.positionZ')" :has-any-keyframes="api.hasAnyKeyframes('params.object.positionZ')" @update:model-value="api.updatePathValue('params.object.positionZ', $event)" @toggle-keyframe="api.toggleKeyframe('params.object.positionZ', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.object.positionZ')" />
                    <AnimatableNumberField label="Rotation X" :model-value="api.valueForPath('params.object.rotationX')" :min="-360" :max="360" :step="1" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.object.rotationX')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.object.rotationX')" :has-any-keyframes="api.hasAnyKeyframes('params.object.rotationX')" @update:model-value="api.updatePathValue('params.object.rotationX', $event)" @toggle-keyframe="api.toggleKeyframe('params.object.rotationX', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.object.rotationX')" />
                    <AnimatableNumberField label="Rotation Y" :model-value="api.valueForPath('params.object.rotationY')" :min="-360" :max="360" :step="1" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.object.rotationY')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.object.rotationY')" :has-any-keyframes="api.hasAnyKeyframes('params.object.rotationY')" @update:model-value="api.updatePathValue('params.object.rotationY', $event)" @toggle-keyframe="api.toggleKeyframe('params.object.rotationY', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.object.rotationY')" />
                    <AnimatableNumberField label="Rotation Z" :model-value="api.valueForPath('params.object.rotationZ')" :min="-360" :max="360" :step="1" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.object.rotationZ')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.object.rotationZ')" :has-any-keyframes="api.hasAnyKeyframes('params.object.rotationZ')" @update:model-value="api.updatePathValue('params.object.rotationZ', $event)" @toggle-keyframe="api.toggleKeyframe('params.object.rotationZ', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.object.rotationZ')" />
                    <AnimatableNumberField label="Object Scale" :model-value="api.valueForPath('params.object.scale')" :min="0.05" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" :show-keyframing="true" :keyframing-enabled="api.hasKeyframing('params.object.scale')" :has-key-at-current-frame="api.hasKeyAtCurrentFrame('params.object.scale')" :has-any-keyframes="api.hasAnyKeyframes('params.object.scale')" @update:model-value="api.updatePathValue('params.object.scale', $event)" @toggle-keyframe="api.toggleKeyframe('params.object.scale', $event)" @remove-keyframes="api.togglePropertyKeyframing('params.object.scale')" />
                </details>
            </div>
        </div>
    </details>
</template>
