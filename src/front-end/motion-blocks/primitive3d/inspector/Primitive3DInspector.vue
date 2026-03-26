<script setup lang="ts">
import { computed, ref } from 'vue';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import Scene3DInspector from '@/front-end/components/editor/Scene3DInspector.vue';
import { evalInterpolatedAtFrame, removeKeyframeAtIndex, upsertKeyframe } from '@/front-end/utils/tracks';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';
import { getMotionBlockPropertyValue, setMotionBlockPropertyValue } from '@/front-end/utils/motion/blockPropertyPaths';
import { resolvePrimitive3DParams, type Primitive3DLightingMode, type Primitive3DType } from '@/front-end/motion-blocks/primitive3d/params';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import { normalizeScene3DSettings } from '@/front-end/utils/projectScene3D';
import type { LyricTrack, MotionTrack, Scene3DSettings, WolkProjectFont } from '@/types/project_types';

const props = defineProps<{
    motionTrack: MotionTrack | null;
    lyricTracks: LyricTrack[];
    playheadMs?: number;
    fps?: number;
    projectFont?: WolkProjectFont;
    renderWidth?: number;
    renderHeight?: number;
    rendererBounds?: RendererBounds | null;
    scene3d?: Scene3DSettings;
}>();

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
    (e: 'seek-to-ms', ms: number): void;
    (e: 'update-scene3d', value: Scene3DSettings): void;
}>();

const activeTab = ref<'object' | 'camera' | 'material' | 'lighting'>('object');
const fpsValue = computed(() => Math.max(1, props.fps ?? 60));
const currentFrame = computed(() => Math.round(((props.playheadMs ?? 0) / 1000) * fpsValue.value));
const isLocked = computed(() => !!props.motionTrack?.locked);
const params = computed(() => resolvePrimitive3DParams(props.motionTrack?.block.params));
const scene3d = computed(() => normalizeScene3DSettings(props.scene3d));

const getPropertyTrack = (path: string) => {
    return props.motionTrack?.block.propertyTracks.find((track) => track.propertyPath === path) ?? null;
};

const hasKeyframing = (path: string) => !!getPropertyTrack(path);
const hasAnyKeyframes = (path: string) => !!getPropertyTrack(path)?.keyframes?.length;
const hasKeyAtCurrentFrame = (path: string) => !!getPropertyTrack(path)?.keyframes?.some((keyframe) => keyframe.frame === currentFrame.value);

const valueForPath = (path: string) => {
    if (!props.motionTrack) return 0;
    const propertyTrack = getPropertyTrack(path);
    if (propertyTrack && propertyTrack.enabled !== false && propertyTrack.keyframes?.length) {
        const fallback = getMotionBlockPropertyValue(props.motionTrack.block, path);
        return evalInterpolatedAtFrame(propertyTrack as any, currentFrame.value, fallback);
    }
    return getMotionBlockPropertyValue(props.motionTrack.block, path);
};

const emitUpdatedBlock = (nextBlock: MotionTrack['block']) => {
    if (!props.motionTrack) return;
    emit('update-track', { ...props.motionTrack, block: nextBlock });
};

const autoKeyframe = (path: string, value: any, propertyTracks: any[]): any[] => {
    const propertyTrackIndex = propertyTracks.findIndex((track: any) => track.propertyPath === path);
    if (propertyTrackIndex < 0) return propertyTracks;
    if (propertyTracks[propertyTrackIndex].enabled === false) return propertyTracks;
    if (!propertyTracks[propertyTrackIndex].keyframes?.length) return propertyTracks;
    const definition = getPropertyDef(path);
    const interpolation = definition?.defaultInterpolation ?? 'linear';
    const nextTracks = [...propertyTracks];
    nextTracks[propertyTrackIndex] = upsertKeyframe(nextTracks[propertyTrackIndex] as any, currentFrame.value, value, interpolation) as any;
    return nextTracks;
};

const updatePathValue = (path: string, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = setMotionBlockPropertyValue(props.motionTrack.block, path, value);
    block.propertyTracks = autoKeyframe(path, value, [...(block.propertyTracks || [])]);
    emitUpdatedBlock(block);
};

const toggleKeyframe = (path: string, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block, propertyTracks: [...(props.motionTrack.block.propertyTracks || [])] };
    let propertyTrackIndex = block.propertyTracks.findIndex((track) => track.propertyPath === path);
    const definition = getPropertyDef(path);
    const interpolation = definition?.defaultInterpolation ?? 'linear';

    if (propertyTrackIndex < 0) {
        block.propertyTracks.push({
            propertyPath: path,
            enabled: true,
            keyframes: [{ frame: currentFrame.value, value, interpolation }],
        });
        emitUpdatedBlock(block);
        return;
    }

    const propertyTrack = { ...block.propertyTracks[propertyTrackIndex] };
    const existingIndex = propertyTrack.keyframes.findIndex((keyframe) => keyframe.frame === currentFrame.value);
    if (existingIndex >= 0) {
        propertyTrack.keyframes = removeKeyframeAtIndex(propertyTrack as any, existingIndex).keyframes;
        block.propertyTracks[propertyTrackIndex] = propertyTrack;
    } else {
        block.propertyTracks[propertyTrackIndex] = upsertKeyframe(propertyTrack as any, currentFrame.value, value, interpolation) as any;
    }

    emitUpdatedBlock(block);
};

const togglePropertyKeyframing = (path: string) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block, propertyTracks: [...(props.motionTrack.block.propertyTracks || [])] };
    const propertyTrackIndex = block.propertyTracks.findIndex((track) => track.propertyPath === path);

    if (propertyTrackIndex >= 0) {
        block.propertyTracks.splice(propertyTrackIndex, 1);
        emitUpdatedBlock(block);
        return;
    }

    const value = getMotionBlockPropertyValue(block, path);
    block.propertyTracks.push({
        propertyPath: path,
        enabled: true,
        keyframes: [{ frame: currentFrame.value, value, interpolation: getPropertyDef(path)?.defaultInterpolation ?? 'linear' }],
    });
    emitUpdatedBlock(block);
};

const updatePrimitiveType = (type: Primitive3DType) => updatePathValue('params.primitive.type', type);
const updateLightingMode = (mode: Primitive3DLightingMode) => updatePathValue('params.lighting.mode', mode);
const updateScene3D = (value: Scene3DSettings) => emit('update-scene3d', value);
</script>

<template>
    <div v-if="motionTrack" class="motion-inspector motion-inspector--primitive3d">
        <details class="inspector-section" open>
            <summary class="inspector-section__title">3D Primitive</summary>
            <div class="inspector-section__content">
                <div class="style-v2__field">
                    <span class="style-v2__field-label">Block Timing</span>
                    <div class="inspector-note">
                        {{ Math.round(motionTrack.block.startMs) }} ms to {{ Math.round(motionTrack.block.endMs) }} ms
                    </div>
                </div>

                <div class="style-v2__field">
                    <span class="style-v2__field-label">Editor</span>
                    <div class="segmented-control segmented-control--wrap">
                        <button :class="{ active: activeTab === 'object' }" @click="activeTab = 'object'">Object</button>
                        <button :class="{ active: activeTab === 'camera' }" @click="activeTab = 'camera'">Camera</button>
                        <button :class="{ active: activeTab === 'material' }" @click="activeTab = 'material'">Material</button>
                        <button :class="{ active: activeTab === 'lighting' }" @click="activeTab = 'lighting'">Lighting</button>
                    </div>
                </div>
            </div>
        </details>

        <details class="inspector-section" open>
            <summary class="inspector-section__title">
                {{ activeTab === 'object' ? 'Object' : activeTab === 'camera' ? 'Camera' : activeTab === 'material' ? 'Material' : 'Lighting' }}
            </summary>
            <div class="inspector-section__content">
                <div v-if="activeTab === 'object'" class="motion-tab style-v2">
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Primitive</span>
                        <select class="inspector-input" :disabled="isLocked" :value="params.primitive.type" @change="updatePrimitiveType(($event.target as HTMLSelectElement).value as Primitive3DType)">
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

                    <AnimatableNumberField label="Position X" :model-value="valueForPath('params.object.positionX')" :min="-20" :max="20" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.positionX')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.positionX')" :has-any-keyframes="hasAnyKeyframes('params.object.positionX')" @update:model-value="updatePathValue('params.object.positionX', $event)" @toggle-keyframe="toggleKeyframe('params.object.positionX', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.positionX')" />
                    <AnimatableNumberField label="Position Y" :model-value="valueForPath('params.object.positionY')" :min="-20" :max="20" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.positionY')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.positionY')" :has-any-keyframes="hasAnyKeyframes('params.object.positionY')" @update:model-value="updatePathValue('params.object.positionY', $event)" @toggle-keyframe="toggleKeyframe('params.object.positionY', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.positionY')" />
                    <AnimatableNumberField label="Position Z" :model-value="valueForPath('params.object.positionZ')" :min="-20" :max="20" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.positionZ')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.positionZ')" :has-any-keyframes="hasAnyKeyframes('params.object.positionZ')" @update:model-value="updatePathValue('params.object.positionZ', $event)" @toggle-keyframe="toggleKeyframe('params.object.positionZ', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.positionZ')" />
                    <AnimatableNumberField label="Rotation X" :model-value="valueForPath('params.object.rotationX')" :min="-360" :max="360" :step="1" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.rotationX')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.rotationX')" :has-any-keyframes="hasAnyKeyframes('params.object.rotationX')" @update:model-value="updatePathValue('params.object.rotationX', $event)" @toggle-keyframe="toggleKeyframe('params.object.rotationX', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.rotationX')" />
                    <AnimatableNumberField label="Rotation Y" :model-value="valueForPath('params.object.rotationY')" :min="-360" :max="360" :step="1" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.rotationY')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.rotationY')" :has-any-keyframes="hasAnyKeyframes('params.object.rotationY')" @update:model-value="updatePathValue('params.object.rotationY', $event)" @toggle-keyframe="toggleKeyframe('params.object.rotationY', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.rotationY')" />
                    <AnimatableNumberField label="Rotation Z" :model-value="valueForPath('params.object.rotationZ')" :min="-360" :max="360" :step="1" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.rotationZ')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.rotationZ')" :has-any-keyframes="hasAnyKeyframes('params.object.rotationZ')" @update:model-value="updatePathValue('params.object.rotationZ', $event)" @toggle-keyframe="toggleKeyframe('params.object.rotationZ', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.rotationZ')" />
                    <AnimatableNumberField label="Object Scale" :model-value="valueForPath('params.object.scale')" :min="0.05" :max="10" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.scale')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.scale')" :has-any-keyframes="hasAnyKeyframes('params.object.scale')" @update:model-value="updatePathValue('params.object.scale', $event)" @toggle-keyframe="toggleKeyframe('params.object.scale', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.scale')" />
                    <AnimatableNumberField label="Sphere Segments" :model-value="params.primitive.sphereSegments" :min="8" :max="128" :step="1" :disabled="isLocked || params.primitive.type !== 'sphere'" @update:model-value="updatePathValue('params.primitive.sphereSegments', $event)" />
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Custom Model</span>
                        <button class="btn-sm" type="button" disabled>Import Model (coming later)</button>
                    </div>
                </div>

                <div v-else-if="activeTab === 'camera'" class="motion-tab style-v2">
                    <div class="inspector-note">
                        Camera motion is intentionally fixed. Use object position Z and scale to push toward or away from screen.
                    </div>
                    <AnimatableNumberField label="Camera Distance" :model-value="params.camera.distance" :min="1" :max="25" :step="0.01" :display-decimals="2" :disabled="isLocked" @update:model-value="updatePathValue('params.camera.distance', $event)" />
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Projected Bounds</span>
                        <div class="inspector-note">
                            <template v-if="rendererBounds">
                                {{ Math.round(rendererBounds.width) }} x {{ Math.round(rendererBounds.height) }} px
                            </template>
                            <template v-else>
                                Bounds will appear after the first render.
                            </template>
                        </div>
                    </div>
                </div>

                <div v-else-if="activeTab === 'material'" class="motion-tab style-v2">
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Color</span>
                        <div class="color-field">
                            <input type="color" class="color-field__swatch" :value="params.material.color" :disabled="isLocked" @input="updatePathValue('params.material.color', ($event.target as HTMLInputElement).value)" />
                            <input type="text" class="color-field__hex inspector-input" :value="params.material.color" :disabled="isLocked" @change="updatePathValue('params.material.color', ($event.target as HTMLInputElement).value)" />
                        </div>
                    </div>
                    <AnimatableNumberField label="Roughness" :model-value="valueForPath('params.material.roughness')" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.material.roughness')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.material.roughness')" :has-any-keyframes="hasAnyKeyframes('params.material.roughness')" @update:model-value="updatePathValue('params.material.roughness', $event)" @toggle-keyframe="toggleKeyframe('params.material.roughness', $event)" @remove-keyframes="togglePropertyKeyframing('params.material.roughness')" />
                    <AnimatableNumberField label="Metalness" :model-value="valueForPath('params.material.metalness')" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.material.metalness')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.material.metalness')" :has-any-keyframes="hasAnyKeyframes('params.material.metalness')" @update:model-value="updatePathValue('params.material.metalness', $event)" @toggle-keyframe="toggleKeyframe('params.material.metalness', $event)" @remove-keyframes="togglePropertyKeyframing('params.material.metalness')" />
                    <AnimatableNumberField label="Opacity" :model-value="valueForPath('params.material.opacity')" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.material.opacity')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.material.opacity')" :has-any-keyframes="hasAnyKeyframes('params.material.opacity')" @update:model-value="updatePathValue('params.material.opacity', $event)" @toggle-keyframe="toggleKeyframe('params.material.opacity', $event)" @remove-keyframes="togglePropertyKeyframing('params.material.opacity')" />
                </div>

                <div v-else class="motion-tab style-v2">
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Lighting Source</span>
                        <div class="segmented-control">
                            <button :class="{ active: params.lighting.mode === 'global' }" @click="updateLightingMode('global')">Global</button>
                            <button :class="{ active: params.lighting.mode === 'local' }" @click="updateLightingMode('local')">Local</button>
                        </div>
                    </div>
                    <div v-if="params.lighting.mode === 'global'" class="inspector-note">
                        This block uses shared project 3D lighting. Changes below update the global scene lighting directly.
                    </div>
                    <Scene3DInspector
                        v-if="params.lighting.mode === 'global'"
                        :scene3d="scene3d"
                        :visible="true"
                        @update-scene3d="updateScene3D"
                    />
                    <template v-else>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Ambient Color</span>
                            <div class="color-field">
                                <input type="color" class="color-field__swatch" :value="params.lighting.ambientColor" :disabled="isLocked" @input="updatePathValue('params.lighting.ambientColor', ($event.target as HTMLInputElement).value)" />
                                <input type="text" class="color-field__hex inspector-input" :value="params.lighting.ambientColor" :disabled="isLocked" @change="updatePathValue('params.lighting.ambientColor', ($event.target as HTMLInputElement).value)" />
                            </div>
                        </div>
                        <AnimatableNumberField label="Ambient Intensity" :model-value="params.lighting.ambientIntensity" :min="0" :max="10" :step="0.01" :display-decimals="2" :disabled="isLocked" @update:model-value="updatePathValue('params.lighting.ambientIntensity', $event)" />
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Directional Color</span>
                            <div class="color-field">
                                <input type="color" class="color-field__swatch" :value="params.lighting.directionalColor" :disabled="isLocked" @input="updatePathValue('params.lighting.directionalColor', ($event.target as HTMLInputElement).value)" />
                                <input type="text" class="color-field__hex inspector-input" :value="params.lighting.directionalColor" :disabled="isLocked" @change="updatePathValue('params.lighting.directionalColor', ($event.target as HTMLInputElement).value)" />
                            </div>
                        </div>
                        <AnimatableNumberField label="Directional Intensity" :model-value="valueForPath('params.lighting.directionalIntensity')" :min="0" :max="20" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.lighting.directionalIntensity')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.lighting.directionalIntensity')" :has-any-keyframes="hasAnyKeyframes('params.lighting.directionalIntensity')" @update:model-value="updatePathValue('params.lighting.directionalIntensity', $event)" @toggle-keyframe="toggleKeyframe('params.lighting.directionalIntensity', $event)" @remove-keyframes="togglePropertyKeyframing('params.lighting.directionalIntensity')" />
                        <AnimatableNumberField label="Directional Azimuth" :model-value="params.lighting.directionalAzimuth" :min="-180" :max="180" :step="1" :disabled="isLocked" @update:model-value="updatePathValue('params.lighting.directionalAzimuth', $event)" />
                        <AnimatableNumberField label="Directional Elevation" :model-value="params.lighting.directionalElevation" :min="-89" :max="89" :step="1" :disabled="isLocked" @update:model-value="updatePathValue('params.lighting.directionalElevation', $event)" />
                    </template>
                </div>
            </div>
        </details>
    </div>
</template>
