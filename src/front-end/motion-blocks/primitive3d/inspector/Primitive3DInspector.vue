<script setup lang="ts">
import { computed, ref } from 'vue';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import Scene3DInspector from '@/front-end/components/editor/Scene3DInspector.vue';
import MotionFontSelector from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionFontSelector.vue';
import { getPrimitive3DAnchorCapacity } from '@/front-end/motion-blocks/primitive3d/anchor-points';
import type { MotionFontSelection } from '@/front-end/utils/fonts/fontUtils';
import { evalInterpolatedAtFrame, removeKeyframeAtIndex, upsertKeyframe } from '@/front-end/utils/tracks';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';
import { getMotionBlockPropertyValue, setMotionBlockPropertyValue } from '@/front-end/utils/motion/blockPropertyPaths';
import {
    resolvePrimitive3DParams,
    type Primitive3DLightingMode,
    type Primitive3DMaterialRenderMode,
    type Primitive3DType,
    type Primitive3DWordPunctuationMode,
} from '@/front-end/motion-blocks/primitive3d/params';
import type { RendererBounds } from '@/front-end/motion-blocks/core/types';
import { normalizeScene3DSettings } from '@/front-end/utils/projectScene3D';
import type { LyricTrack, MotionStyle, MotionTrack, Scene3DSettings, WolkProjectFont } from '@/types/project_types';

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

const activeTab = ref<'object' | 'camera' | 'material' | 'words' | 'lighting'>('object');
const fpsValue = computed(() => Math.max(1, props.fps ?? 60));
const currentFrame = computed(() => Math.round(((props.playheadMs ?? 0) / 1000) * fpsValue.value));
const isLocked = computed(() => !!props.motionTrack?.locked);
const params = computed(() => resolvePrimitive3DParams(props.motionTrack?.block.params));
const scene3d = computed(() => normalizeScene3DSettings(props.scene3d));
const style = computed(() => props.motionTrack?.block.style || null);
const wordTracks = computed(() => props.lyricTracks.filter((track) => track.kind === 'word'));
const selectedWordTrack = computed(() => wordTracks.value.find((track) => track.id === props.motionTrack?.block.sourceTrackId) ?? null);
const anchorCapacity = computed(() => getPrimitive3DAnchorCapacity(params.value));

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

const updateStyle = (key: keyof MotionStyle, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = {
        ...props.motionTrack.block,
        style: {
            ...props.motionTrack.block.style,
            [key]: value,
        },
    };
    emitUpdatedBlock(block);
};

const updateFontSelection = (selection: MotionFontSelection) => {
    updateStyle('fontFamily', selection.family);
    updateStyle('fontFallbacks', selection.fallbacks);
    updateStyle('fontStyle', selection.style);
    updateStyle('fontWeight', selection.weight);
    updateStyle('fontName', selection.name);
    updateStyle('fontLocalPath', selection.localPath);
};

const updateSourceTrackId = (trackId: string) => {
    if (!props.motionTrack || isLocked.value) return;
    emit('update-track', {
        ...props.motionTrack,
        block: {
            ...props.motionTrack.block,
            sourceTrackId: trackId,
        },
    });
};

const toggleKeyframe = (path: string, value: any) => {
    if (!props.motionTrack || isLocked.value) return;
    const block = { ...props.motionTrack.block, propertyTracks: [...(props.motionTrack.block.propertyTracks || [])] };
    const propertyTrackIndex = block.propertyTracks.findIndex((track) => track.propertyPath === path);
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
const updateRenderMode = (mode: Primitive3DMaterialRenderMode) => updatePathValue('params.material.renderMode', mode);
const updatePunctuationMode = (mode: Primitive3DWordPunctuationMode) => updatePathValue('params.words.punctuationMode', mode);
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
                        <button :class="{ active: activeTab === 'words' }" @click="activeTab = 'words'">Words</button>
                        <button :class="{ active: activeTab === 'lighting' }" @click="activeTab = 'lighting'">Lighting</button>
                    </div>
                </div>
            </div>
        </details>

        <details class="inspector-section" open>
            <summary class="inspector-section__title">
                {{
                    activeTab === 'object'
                        ? 'Object'
                        : activeTab === 'camera'
                            ? 'Camera'
                            : activeTab === 'material'
                                ? 'Material'
                                : activeTab === 'words'
                                    ? 'Words'
                                    : 'Lighting'
                }}
            </summary>
            <div class="inspector-section__content">
                <div v-if="activeTab === 'object'" class="motion-tab style-v2">
                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Transform</summary>
                        <AnimatableNumberField label="Position X" :model-value="valueForPath('params.object.positionX')" :min="-20" :max="20" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.positionX')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.positionX')" :has-any-keyframes="hasAnyKeyframes('params.object.positionX')" @update:model-value="updatePathValue('params.object.positionX', $event)" @toggle-keyframe="toggleKeyframe('params.object.positionX', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.positionX')" />
                        <AnimatableNumberField label="Position Y" :model-value="valueForPath('params.object.positionY')" :min="-20" :max="20" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.positionY')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.positionY')" :has-any-keyframes="hasAnyKeyframes('params.object.positionY')" @update:model-value="updatePathValue('params.object.positionY', $event)" @toggle-keyframe="toggleKeyframe('params.object.positionY', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.positionY')" />
                        <AnimatableNumberField label="Position Z" :model-value="valueForPath('params.object.positionZ')" :min="-20" :max="20" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.positionZ')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.positionZ')" :has-any-keyframes="hasAnyKeyframes('params.object.positionZ')" @update:model-value="updatePathValue('params.object.positionZ', $event)" @toggle-keyframe="toggleKeyframe('params.object.positionZ', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.positionZ')" />
                        <AnimatableNumberField label="Rotation X" :model-value="valueForPath('params.object.rotationX')" :min="-360" :max="360" :step="1" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.rotationX')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.rotationX')" :has-any-keyframes="hasAnyKeyframes('params.object.rotationX')" @update:model-value="updatePathValue('params.object.rotationX', $event)" @toggle-keyframe="toggleKeyframe('params.object.rotationX', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.rotationX')" />
                        <AnimatableNumberField label="Rotation Y" :model-value="valueForPath('params.object.rotationY')" :min="-360" :max="360" :step="1" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.rotationY')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.rotationY')" :has-any-keyframes="hasAnyKeyframes('params.object.rotationY')" @update:model-value="updatePathValue('params.object.rotationY', $event)" @toggle-keyframe="toggleKeyframe('params.object.rotationY', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.rotationY')" />
                        <AnimatableNumberField label="Rotation Z" :model-value="valueForPath('params.object.rotationZ')" :min="-360" :max="360" :step="1" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.rotationZ')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.rotationZ')" :has-any-keyframes="hasAnyKeyframes('params.object.rotationZ')" @update:model-value="updatePathValue('params.object.rotationZ', $event)" @toggle-keyframe="toggleKeyframe('params.object.rotationZ', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.rotationZ')" />
                        <AnimatableNumberField label="Object Scale" :model-value="valueForPath('params.object.scale')" :min="0.05" :max="10" :step="0.01" :display-decimals="2" :disabled="isLocked" :show-keyframing="true" :keyframing-enabled="hasKeyframing('params.object.scale')" :has-key-at-current-frame="hasKeyAtCurrentFrame('params.object.scale')" :has-any-keyframes="hasAnyKeyframes('params.object.scale')" @update:model-value="updatePathValue('params.object.scale', $event)" @toggle-keyframe="toggleKeyframe('params.object.scale', $event)" @remove-keyframes="togglePropertyKeyframing('params.object.scale')" />
                    </details>

                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Geometry</summary>
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
                        <AnimatableNumberField label="Sphere Segments" :model-value="params.primitive.sphereSegments" :min="8" :max="128" :step="1" :disabled="isLocked || params.primitive.type !== 'sphere'" @update:model-value="updatePathValue('params.primitive.sphereSegments', $event)" />
                        <AnimatableNumberField label="Plane Width" :model-value="params.primitive.planeWidth" :min="0.25" :max="10" :step="0.01" :display-decimals="2" :disabled="isLocked || params.primitive.type !== 'plane'" @update:model-value="updatePathValue('params.primitive.planeWidth', $event)" />
                        <AnimatableNumberField label="Plane Height" :model-value="params.primitive.planeHeight" :min="0.25" :max="10" :step="0.01" :display-decimals="2" :disabled="isLocked || params.primitive.type !== 'plane'" @update:model-value="updatePathValue('params.primitive.planeHeight', $event)" />
                        <div class="inspector-note">
                            Anchor count now follows the current primitive geometry automatically.
                        </div>
                    </details>

                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Models</summary>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Custom Model</span>
                            <button class="btn-sm" type="button" disabled>Import Model (coming later)</button>
                        </div>
                    </details>
                </div>

                <div v-else-if="activeTab === 'camera'" class="motion-tab style-v2">
                    <div class="inspector-note">
                        Camera motion is intentionally fixed. Use object position Z, scale, and word world size to control depth.
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
                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Surface</summary>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Surface Mode</span>
                            <div class="segmented-control segmented-control--wrap">
                                <button :class="{ active: params.material.renderMode === 'solid' }" @click="updateRenderMode('solid')">Solid</button>
                                <button :class="{ active: params.material.renderMode === 'wireframe' }" @click="updateRenderMode('wireframe')">Wire</button>
                                <button :class="{ active: params.material.renderMode === 'solid-wireframe' }" @click="updateRenderMode('solid-wireframe')">Hybrid</button>
                            </div>
                        </div>
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
                    </details>

                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Wireframe</summary>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Wire Color</span>
                            <div class="color-field">
                                <input type="color" class="color-field__swatch" :value="params.material.wireColor" :disabled="isLocked" @input="updatePathValue('params.material.wireColor', ($event.target as HTMLInputElement).value)" />
                                <input type="text" class="color-field__hex inspector-input" :value="params.material.wireColor" :disabled="isLocked" @change="updatePathValue('params.material.wireColor', ($event.target as HTMLInputElement).value)" />
                            </div>
                        </div>
                        <AnimatableNumberField label="Wire Opacity" :model-value="params.material.wireOpacity" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="isLocked" @update:model-value="updatePathValue('params.material.wireOpacity', $event)" />
                    </details>
                </div>

                <div v-else-if="activeTab === 'words'" class="motion-tab style-v2">
                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Source</summary>
                        <div class="style-v2__field style-v2__field--inline">
                            <span class="style-v2__field-label">Enable Word Sprites</span>
                            <label class="inspector-toggle">
                                <input type="checkbox" :checked="params.words.enabled" :disabled="isLocked" @change="updatePathValue('params.words.enabled', ($event.target as HTMLInputElement).checked)" />
                                <span>{{ params.words.enabled ? 'On' : 'Off' }}</span>
                            </label>
                        </div>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Word Track</span>
                            <select class="inspector-input" :disabled="isLocked" :value="motionTrack.block.sourceTrackId" @change="updateSourceTrackId(($event.target as HTMLSelectElement).value)">
                                <option value="">No source track</option>
                                <option v-for="track in wordTracks" :key="track.id" :value="track.id">
                                    {{ track.name }}
                                </option>
                            </select>
                        </div>
                        <div class="inspector-note">
                            <template v-if="selectedWordTrack">
                                Using `{{ selectedWordTrack.name }}` with {{ anchorCapacity }} geometry-driven slots.
                            </template>
                            <template v-else-if="wordTracks.length > 0">
                                Select a `word` lyric track to render billboarded word sprites.
                            </template>
                            <template v-else>
                                No `word` lyric tracks found yet. Create one first so the sprites have timing data.
                            </template>
                        </div>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Visible Slots</span>
                            <div class="inspector-note">
                                Auto: {{ anchorCapacity }} points on the current primitive.
                            </div>
                        </div>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Punctuation</span>
                            <div class="segmented-control">
                                <button :class="{ active: params.words.punctuationMode === 'keep' }" @click="updatePunctuationMode('keep')">Keep</button>
                                <button :class="{ active: params.words.punctuationMode === 'strip' }" @click="updatePunctuationMode('strip')">Strip</button>
                            </div>
                        </div>
                    </details>

                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Facing</summary>
                        <AnimatableNumberField label="Radial Offset" :model-value="params.words.radialOffset" :min="-4" :max="4" :step="0.01" :display-decimals="2" :disabled="isLocked || !params.words.enabled" @update:model-value="updatePathValue('params.words.radialOffset', $event)" />
                        <div class="style-v2__field style-v2__field--inline">
                            <span class="style-v2__field-label">Camera Facing</span>
                            <label class="inspector-toggle">
                                <input type="checkbox" :checked="params.billboard.enabled" :disabled="isLocked || !params.words.enabled" @change="updatePathValue('params.billboard.enabled', ($event.target as HTMLInputElement).checked)" />
                                <span>{{ params.billboard.enabled ? 'Billboard' : 'Locked' }}</span>
                            </label>
                        </div>
                        <AnimatableNumberField label="Facing Offset X" :model-value="params.billboard.rotationOffsetX" :min="-180" :max="180" :step="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updatePathValue('params.billboard.rotationOffsetX', $event)" />
                        <AnimatableNumberField label="Facing Offset Y" :model-value="params.billboard.rotationOffsetY" :min="-180" :max="180" :step="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updatePathValue('params.billboard.rotationOffsetY', $event)" />
                        <AnimatableNumberField label="Facing Offset Z" :model-value="params.billboard.rotationOffsetZ" :min="-180" :max="180" :step="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updatePathValue('params.billboard.rotationOffsetZ', $event)" />
                        <AnimatableNumberField label="Active Point Offset X" :model-value="params.reaction.activePointOffsetX" :min="-180" :max="180" :step="0.1" :display-decimals="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updatePathValue('params.reaction.activePointOffsetX', $event)" />
                        <AnimatableNumberField label="Active Point Offset Y" :model-value="params.reaction.activePointOffsetY" :min="-180" :max="180" :step="0.1" :display-decimals="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updatePathValue('params.reaction.activePointOffsetY', $event)" />
                        <AnimatableNumberField label="Active Point Offset Z" :model-value="params.reaction.activePointOffsetZ" :min="-180" :max="180" :step="0.1" :display-decimals="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updatePathValue('params.reaction.activePointOffsetZ', $event)" />
                        <div class="style-v2__field style-v2__field--inline">
                            <span class="style-v2__field-label">Smooth Facing</span>
                            <label class="inspector-toggle">
                                <input type="checkbox" :checked="params.reaction.smoothFacing" :disabled="isLocked || !params.words.enabled" @change="updatePathValue('params.reaction.smoothFacing', ($event.target as HTMLInputElement).checked)" />
                                <span>{{ params.reaction.smoothFacing ? 'On' : 'Off' }}</span>
                            </label>
                        </div>
                        <AnimatableNumberField label="Smooth Strength" :model-value="params.reaction.smoothStrength" :min="0.01" :max="1" :step="0.01" :display-decimals="2" :disabled="isLocked || !params.words.enabled || !params.reaction.smoothFacing" @update:model-value="updatePathValue('params.reaction.smoothStrength', $event)" />
                        <div class="inspector-note">
                            Lower values feel softer and less jumpy. Higher values react faster.
                        </div>
                    </details>

                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Typography</summary>
                        <AnimatableNumberField label="Size Multiplier" :model-value="params.words.worldSize" :min="0.05" :max="6" :step="0.01" :display-decimals="2" :disabled="isLocked || !params.words.enabled" @update:model-value="updatePathValue('params.words.worldSize', $event)" />
                        <div class="inspector-note">
                            Word size is auto-derived from primitive span and point density, then multiplied here.
                        </div>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Font</span>
                            <MotionFontSelector :model-value="style || motionTrack.block.style" :project-font="projectFont" :disabled="isLocked || !params.words.enabled" @update:model-value="updateFontSelection" />
                        </div>
                        <AnimatableNumberField label="Font Size" :model-value="Number(style?.fontSize ?? 72)" :min="8" :max="256" :step="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updateStyle('fontSize', $event)" />
                        <AnimatableNumberField label="Font Weight" :model-value="Number(style?.fontWeight ?? 400)" :min="100" :max="900" :step="100" :disabled="isLocked || !params.words.enabled" @update:model-value="updateStyle('fontWeight', $event)" />
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Text Case</span>
                            <div class="segmented-control segmented-control--wrap">
                                <button :class="{ active: (style?.textCase || 'none') === 'none' }" @click="updateStyle('textCase', 'none')">Aa</button>
                                <button :class="{ active: style?.textCase === 'uppercase' }" @click="updateStyle('textCase', 'uppercase')">AA</button>
                                <button :class="{ active: style?.textCase === 'lowercase' }" @click="updateStyle('textCase', 'lowercase')">aa</button>
                                <button :class="{ active: style?.textCase === 'capitalize' }" @click="updateStyle('textCase', 'capitalize')">Aa.</button>
                            </div>
                        </div>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Text Color</span>
                            <div class="color-field">
                                <input type="color" class="color-field__swatch" :value="style?.color || '#ffffff'" :disabled="isLocked || !params.words.enabled" @input="updateStyle('color', ($event.target as HTMLInputElement).value)" />
                                <input type="text" class="color-field__hex inspector-input" :value="style?.color || '#ffffff'" :disabled="isLocked || !params.words.enabled" @change="updateStyle('color', ($event.target as HTMLInputElement).value)" />
                            </div>
                        </div>
                        <AnimatableNumberField label="Text Opacity" :model-value="Number(style?.opacity ?? 1)" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="isLocked || !params.words.enabled" @update:model-value="updateStyle('opacity', $event)" />
                    </details>

                    <details class="style-sub-section" open>
                        <summary class="style-sub-section__header">Background</summary>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Background Color</span>
                            <div class="color-field">
                                <input type="color" class="color-field__swatch" :value="style?.backgroundColor || '#000000'" :disabled="isLocked || !params.words.enabled" @input="updateStyle('backgroundColor', ($event.target as HTMLInputElement).value)" />
                                <input type="text" class="color-field__hex inspector-input" :value="style?.backgroundColor || '#000000'" :disabled="isLocked || !params.words.enabled" @change="updateStyle('backgroundColor', ($event.target as HTMLInputElement).value)" />
                            </div>
                        </div>
                        <AnimatableNumberField label="Background Opacity" :model-value="Number(style?.backgroundOpacity ?? 0)" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="isLocked || !params.words.enabled" @update:model-value="updateStyle('backgroundOpacity', $event)" />
                        <AnimatableNumberField label="Background Padding" :model-value="Number(style?.backgroundPadding ?? 0)" :min="0" :max="128" :step="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updateStyle('backgroundPadding', $event)" />
                        <AnimatableNumberField label="Background Radius" :model-value="Number(style?.backgroundBorderRadius ?? 0)" :min="0" :max="128" :step="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updateStyle('backgroundBorderRadius', $event)" />
                        <AnimatableNumberField label="Outline Width" :model-value="Number(style?.outlineWidth ?? 0)" :min="0" :max="32" :step="0.5" :display-decimals="1" :disabled="isLocked || !params.words.enabled" @update:model-value="updateStyle('outlineWidth', $event)" />
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Outline Color</span>
                            <div class="color-field">
                                <input type="color" class="color-field__swatch" :value="style?.outlineColor || '#000000'" :disabled="isLocked || !params.words.enabled" @input="updateStyle('outlineColor', ($event.target as HTMLInputElement).value)" />
                                <input type="text" class="color-field__hex inspector-input" :value="style?.outlineColor || '#000000'" :disabled="isLocked || !params.words.enabled" @change="updateStyle('outlineColor', ($event.target as HTMLInputElement).value)" />
                            </div>
                        </div>
                    </details>
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
