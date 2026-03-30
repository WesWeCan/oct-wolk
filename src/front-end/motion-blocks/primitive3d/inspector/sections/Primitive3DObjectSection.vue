<script setup lang="ts">
import { ref } from 'vue';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import type { Primitive3DInspectorApi } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';
import type { Primitive3DType } from '@/front-end/motion-blocks/primitive3d/params';

const corePrimitiveOptions: Array<{ value: Primitive3DType; label: string }> = [
    { value: 'sphere', label: 'Sphere' },
    { value: 'box', label: 'Box' },
    { value: 'plane', label: 'Plane' },
    { value: 'cylinder', label: 'Cylinder' },
    { value: 'cone', label: 'Cone' },
    { value: 'capsule', label: 'Capsule' },
    { value: 'torus', label: 'Torus' },
    { value: 'model', label: 'Model' },
];

const morePrimitiveOptions: Array<{ value: Primitive3DType; label: string }> = [
    { value: 'icosahedron', label: 'Icosahedron' },
    { value: 'tetrahedron', label: 'Tetrahedron' },
    { value: 'octahedron', label: 'Octahedron' },
    { value: 'dodecahedron', label: 'Dodecahedron' },
];

defineProps<{
    api: Primitive3DInspectorApi;
}>();

const objInput = ref<HTMLInputElement | null>(null);
const textureInput = ref<HTMLInputElement | null>(null);
const normalInput = ref<HTMLInputElement | null>(null);

const openPicker = (input: HTMLInputElement | null) => {
    input?.click();
};

const onFileChange = async (
    event: Event,
    api: Primitive3DInspectorApi,
    kind: 'obj' | 'texture' | 'normal',
) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    await api.uploadModelAsset(kind, file);
    input.value = '';
};
</script>

<template>
    <details class="inspector-section">
        <summary class="inspector-section__title">Object</summary>
        <div class="inspector-section__content">
            <div class="motion-tab style-v2">
                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Geometry</summary>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Primitive</span>
                        <select aria-label="Primitive type" class="inspector-input" :disabled="api.isLocked" :value="api.params.primitive.type" @change="api.updatePrimitiveType(($event.target as HTMLSelectElement).value as Primitive3DType)">
                            <optgroup label="Core Shapes">
                                <option v-for="option in corePrimitiveOptions" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </option>
                            </optgroup>
                            <optgroup label="More Shapes">
                                <option v-for="option in morePrimitiveOptions" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </option>
                            </optgroup>
                        </select>
                    </div>
                    <AnimatableNumberField v-if="api.params.primitive.type === 'sphere'" label="Width Segments" :model-value="api.params.primitive.sphereWidthSegments" :min="8" :max="128" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.sphereWidthSegments', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'sphere'" label="Height Segments" :model-value="api.params.primitive.sphereHeightSegments" :min="8" :max="128" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.sphereHeightSegments', $event)" />

                    <AnimatableNumberField v-if="api.params.primitive.type === 'box'" label="Box Width" :model-value="api.params.primitive.boxWidth" :min="0.25" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.boxWidth', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'box'" label="Box Height" :model-value="api.params.primitive.boxHeight" :min="0.25" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.boxHeight', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'box'" label="Box Depth" :model-value="api.params.primitive.boxDepth" :min="0.25" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.boxDepth', $event)" />

                    <AnimatableNumberField v-if="api.params.primitive.type === 'plane'" label="Plane Width" :model-value="api.params.primitive.planeWidth" :min="0.25" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.planeWidth', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'plane'" label="Plane Height" :model-value="api.params.primitive.planeHeight" :min="0.25" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.planeHeight', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'plane'" label="Width Segments" :model-value="api.params.primitive.planeWidthSegments" :min="1" :max="32" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.planeWidthSegments', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'plane'" label="Height Segments" :model-value="api.params.primitive.planeHeightSegments" :min="1" :max="32" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.planeHeightSegments', $event)" />

                    <AnimatableNumberField v-if="api.params.primitive.type === 'cylinder'" label="Top Radius" :model-value="api.params.primitive.cylinderRadiusTop" :min="0.05" :max="6" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.cylinderRadiusTop', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'cylinder'" label="Bottom Radius" :model-value="api.params.primitive.cylinderRadiusBottom" :min="0.05" :max="6" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.cylinderRadiusBottom', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'cylinder'" label="Height" :model-value="api.params.primitive.cylinderHeight" :min="0.1" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.cylinderHeight', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'cylinder'" label="Radial Segments" :model-value="api.params.primitive.cylinderRadialSegments" :min="3" :max="128" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.cylinderRadialSegments', $event)" />

                    <AnimatableNumberField v-if="api.params.primitive.type === 'cone'" label="Radius" :model-value="api.params.primitive.coneRadius" :min="0.05" :max="6" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.coneRadius', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'cone'" label="Height" :model-value="api.params.primitive.coneHeight" :min="0.1" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.coneHeight', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'cone'" label="Radial Segments" :model-value="api.params.primitive.coneRadialSegments" :min="3" :max="128" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.coneRadialSegments', $event)" />

                    <AnimatableNumberField v-if="api.params.primitive.type === 'capsule'" label="Radius" :model-value="api.params.primitive.capsuleRadius" :min="0.05" :max="6" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.capsuleRadius', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'capsule'" label="Length" :model-value="api.params.primitive.capsuleLength" :min="0.1" :max="10" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.capsuleLength', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'capsule'" label="Cap Segments" :model-value="api.params.primitive.capsuleCapSegments" :min="1" :max="32" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.capsuleCapSegments', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'capsule'" label="Radial Segments" :model-value="api.params.primitive.capsuleRadialSegments" :min="3" :max="64" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.capsuleRadialSegments', $event)" />

                    <AnimatableNumberField v-if="api.params.primitive.type === 'torus'" label="Ring Radius" :model-value="api.params.primitive.torusRadius" :min="0.1" :max="6" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.torusRadius', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'torus'" label="Tube Radius" :model-value="api.params.primitive.torusTube" :min="0.05" :max="3" :step="0.01" :display-decimals="2" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.torusTube', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'torus'" label="Radial Segments" :model-value="api.params.primitive.torusRadialSegments" :min="3" :max="64" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.torusRadialSegments', $event)" />
                    <AnimatableNumberField v-if="api.params.primitive.type === 'torus'" label="Tubular Segments" :model-value="api.params.primitive.torusTubularSegments" :min="8" :max="128" :step="1" :disabled="api.isLocked" @update:model-value="api.updatePathValue('params.primitive.torusTubularSegments', $event)" />

                    <span v-if="['icosahedron', 'tetrahedron', 'octahedron', 'dodecahedron'].includes(api.params.primitive.type)" class="inspector-hint">
                        This shape does not have extra geometry controls yet.
                    </span>
                    <template v-if="api.params.primitive.type === 'model'">
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">OBJ Geometry</span>
                            <input
                                class="inspector-input"
                                type="text"
                                :value="api.getAssetLabel(api.params.primitive.modelObjUrl)"
                                disabled
                            >
                            <div class="inspector-button-row">
                                <button type="button" class="btn-sm" :disabled="api.isLocked || !api.projectId || api.modelUploadState.obj" @click="openPicker(objInput)">
                                    {{ api.params.primitive.modelObjUrl ? 'Replace OBJ' : 'Upload OBJ' }}
                                </button>
                                <button
                                    v-if="api.params.primitive.modelObjUrl"
                                    type="button"
                                    class="btn-sm"
                                    :disabled="api.isLocked || api.modelUploadState.obj"
                                    @click="api.clearModelAsset('obj')"
                                >
                                    Clear
                                </button>
                            </div>
                            <input
                                ref="objInput"
                                data-testid="primitive3d-model-obj-input"
                                type="file"
                                accept=".obj,text/plain"
                                hidden
                                :disabled="api.isLocked || !api.projectId || api.modelUploadState.obj"
                                @change="onFileChange($event, api, 'obj')"
                            >
                            <span class="inspector-hint">Upload the OBJ geometry used by this block.</span>
                        </div>

                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Base Texture</span>
                            <input
                                class="inspector-input"
                                type="text"
                                :value="api.getAssetLabel(api.params.primitive.modelTextureUrl)"
                                disabled
                            >
                            <div class="inspector-button-row">
                                <button type="button" class="btn-sm" :disabled="api.isLocked || !api.projectId || api.modelUploadState.texture" @click="openPicker(textureInput)">
                                    {{ api.params.primitive.modelTextureUrl ? 'Replace Texture' : 'Upload Texture' }}
                                </button>
                                <button
                                    v-if="api.params.primitive.modelTextureUrl"
                                    type="button"
                                    class="btn-sm"
                                    :disabled="api.isLocked || api.modelUploadState.texture"
                                    @click="api.clearModelAsset('texture')"
                                >
                                    Clear
                                </button>
                            </div>
                            <input
                                ref="textureInput"
                                data-testid="primitive3d-model-texture-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/avif"
                                hidden
                                :disabled="api.isLocked || !api.projectId || api.modelUploadState.texture"
                                @change="onFileChange($event, api, 'texture')"
                            >
                            <span class="inspector-hint">Optional color texture for the uploaded model.</span>
                        </div>

                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Normal Map</span>
                            <input
                                class="inspector-input"
                                type="text"
                                :value="api.getAssetLabel(api.params.primitive.modelNormalUrl)"
                                disabled
                            >
                            <div class="inspector-button-row">
                                <button type="button" class="btn-sm" :disabled="api.isLocked || !api.projectId || api.modelUploadState.normal" @click="openPicker(normalInput)">
                                    {{ api.params.primitive.modelNormalUrl ? 'Replace Normal Map' : 'Upload Normal Map' }}
                                </button>
                                <button
                                    v-if="api.params.primitive.modelNormalUrl"
                                    type="button"
                                    class="btn-sm"
                                    :disabled="api.isLocked || api.modelUploadState.normal"
                                    @click="api.clearModelAsset('normal')"
                                >
                                    Clear
                                </button>
                            </div>
                            <input
                                ref="normalInput"
                                data-testid="primitive3d-model-normal-input"
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/avif"
                                hidden
                                :disabled="api.isLocked || !api.projectId || api.modelUploadState.normal"
                                @change="onFileChange($event, api, 'normal')"
                            >
                            <span class="inspector-hint">Optional normal map for extra surface detail.</span>
                        </div>

                        <div v-if="api.modelUploadError" class="inspector-hint" style="color: #e57373;">
                            {{ api.modelUploadError }}
                        </div>
                        <span class="inspector-hint">
                            Imported materials stay app-controlled so Hybrid wireframe still behaves consistently.
                        </span>
                    </template>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Anchor Slots</span>
                        <input
                            class="inspector-input"
                            type="text"
                            :value="`${api.anchorCapacity} geometry-driven slots`"
                            disabled
                        >
                        <span class="inspector-hint">Word placement updates automatically when the primitive geometry changes.</span>
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
