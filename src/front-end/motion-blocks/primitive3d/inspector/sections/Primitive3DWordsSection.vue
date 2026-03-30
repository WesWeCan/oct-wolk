<script setup lang="ts">
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import MotionFontSelector from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionFontSelector.vue';
import type { Primitive3DInspectorApi } from '@/front-end/motion-blocks/primitive3d/inspector/usePrimitive3DInspector';
import type { MotionTrack } from '@/types/project_types';

defineProps<{
    motionTrack: MotionTrack;
    api: Primitive3DInspectorApi;
}>();
</script>

<template>
    <details class="inspector-section">
        <summary class="inspector-section__title">Words</summary>
        <div class="inspector-section__content">
            <div class="motion-tab style-v2">
                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Placement</summary>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Visible Slots</span>
                        <div class="inspector-note">
                            Auto: {{ api.anchorCapacity }} points on the current primitive.
                        </div>
                    </div>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Punctuation</span>
                        <div class="segmented-control">
                            <button type="button" :class="{ active: api.params.words.punctuationMode === 'keep' }" @click="api.updatePunctuationMode('keep')">Keep</button>
                            <button type="button" :class="{ active: api.params.words.punctuationMode === 'strip' }" @click="api.updatePunctuationMode('strip')">Strip</button>
                        </div>
                    </div>
                    <AnimatableNumberField label="Radial Offset" :model-value="api.params.words.radialOffset" :min="-4" :max="4" :step="0.01" :display-decimals="2" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updatePathValue('params.words.radialOffset', $event)" />
                    <div class="inspector-note">
                        Push each word outward from its anchor point on the primitive surface.
                    </div>
                </details>

                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Word Facing</summary>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Face Camera</span>
                        <div class="segmented-control">
                            <button type="button" aria-label="Word facing off" :class="{ active: !api.params.billboard.enabled }" :disabled="api.isLocked || !api.params.words.enabled" @click="api.updatePathValue('params.billboard.enabled', false)">Off</button>
                            <button type="button" aria-label="Word facing on" :class="{ active: api.params.billboard.enabled }" :disabled="api.isLocked || !api.params.words.enabled" @click="api.updatePathValue('params.billboard.enabled', true)">On</button>
                        </div>
                    </div>
                    <div class="inspector-note">
                        Turn this on to rotate each word toward the camera before applying the extra rotation below.
                    </div>
                    <AnimatableNumberField label="Extra Rotation X" :model-value="api.params.billboard.rotationOffsetX" :min="-180" :max="180" :step="1" :disabled="api.isLocked || !api.params.words.enabled || !api.params.billboard.enabled" @update:model-value="api.updatePathValue('params.billboard.rotationOffsetX', $event)" />
                    <AnimatableNumberField label="Extra Rotation Y" :model-value="api.params.billboard.rotationOffsetY" :min="-180" :max="180" :step="1" :disabled="api.isLocked || !api.params.words.enabled || !api.params.billboard.enabled" @update:model-value="api.updatePathValue('params.billboard.rotationOffsetY', $event)" />
                    <AnimatableNumberField label="Extra Rotation Z" :model-value="api.params.billboard.rotationOffsetZ" :min="-180" :max="180" :step="1" :disabled="api.isLocked || !api.params.words.enabled || !api.params.billboard.enabled" @update:model-value="api.updatePathValue('params.billboard.rotationOffsetZ', $event)" />
                </details>

                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Object Follow</summary>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Follow Active Word</span>
                        <div class="segmented-control">
                            <button type="button" aria-label="Object follow off" :class="{ active: !api.params.reaction.enabled }" :disabled="api.isLocked || !api.params.words.enabled" @click="api.updatePathValue('params.reaction.enabled', false)">Off</button>
                            <button type="button" aria-label="Object follow on" :class="{ active: api.params.reaction.enabled }" :disabled="api.isLocked || !api.params.words.enabled" @click="api.updatePathValue('params.reaction.enabled', true)">On</button>
                        </div>
                    </div>
                    <div class="inspector-note">
                        When this is on, the object rotates its active anchor toward the camera. This adds on top of Object rotation and can visually override rotation keyframes while a word is active.
                    </div>
                    <AnimatableNumberField label="Follow Offset X" :model-value="api.params.reaction.activePointOffsetX" :min="-180" :max="180" :step="0.1" :display-decimals="1" :disabled="api.isLocked || !api.params.words.enabled || !api.params.reaction.enabled" @update:model-value="api.updatePathValue('params.reaction.activePointOffsetX', $event)" />
                    <AnimatableNumberField label="Follow Offset Y" :model-value="api.params.reaction.activePointOffsetY" :min="-180" :max="180" :step="0.1" :display-decimals="1" :disabled="api.isLocked || !api.params.words.enabled || !api.params.reaction.enabled" @update:model-value="api.updatePathValue('params.reaction.activePointOffsetY', $event)" />
                    <AnimatableNumberField label="Follow Offset Z" :model-value="api.params.reaction.activePointOffsetZ" :min="-180" :max="180" :step="0.1" :display-decimals="1" :disabled="api.isLocked || !api.params.words.enabled || !api.params.reaction.enabled" @update:model-value="api.updatePathValue('params.reaction.activePointOffsetZ', $event)" />
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Smooth Follow</span>
                        <div class="segmented-control">
                            <button type="button" aria-label="Smooth follow off" :class="{ active: !api.params.reaction.smoothFacing }" :disabled="api.isLocked || !api.params.words.enabled || !api.params.reaction.enabled" @click="api.updatePathValue('params.reaction.smoothFacing', false)">Off</button>
                            <button type="button" aria-label="Smooth follow on" :class="{ active: api.params.reaction.smoothFacing }" :disabled="api.isLocked || !api.params.words.enabled || !api.params.reaction.enabled" @click="api.updatePathValue('params.reaction.smoothFacing', true)">On</button>
                        </div>
                    </div>
                    <AnimatableNumberField label="Follow Strength" :model-value="api.params.reaction.smoothStrength" :min="0.01" :max="1" :step="0.01" :display-decimals="2" :disabled="api.isLocked || !api.params.words.enabled || !api.params.reaction.enabled || !api.params.reaction.smoothFacing" @update:model-value="api.updatePathValue('params.reaction.smoothStrength', $event)" />
                    <div class="inspector-note">
                        Lower values feel softer and slower. Higher values react faster.
                    </div>
                </details>

                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Typography</summary>
                    <AnimatableNumberField label="Size Multiplier" :model-value="api.params.words.worldSize" :min="0.05" :max="6" :step="0.01" :display-decimals="2" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updatePathValue('params.words.worldSize', $event)" />
                    <div class="inspector-note">
                        Word size is auto-derived from primitive span and point density, then multiplied here.
                    </div>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Font</span>
                        <MotionFontSelector :model-value="api.style || motionTrack.block.style" :project-font="api.projectFont" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updateFontSelection" />
                    </div>
                    <AnimatableNumberField label="Font Size" :model-value="Number(api.style?.fontSize ?? 72)" :min="8" :max="256" :step="1" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updateStyle('fontSize', $event)" />
                    <AnimatableNumberField label="Font Weight" :model-value="Number(api.style?.fontWeight ?? 400)" :min="100" :max="900" :step="100" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updateStyle('fontWeight', $event)" />
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Text Case</span>
                        <div class="segmented-control segmented-control--wrap">
                            <button type="button" :class="{ active: (api.style?.textCase || 'none') === 'none' }" @click="api.updateStyle('textCase', 'none')">Aa</button>
                            <button type="button" :class="{ active: api.style?.textCase === 'uppercase' }" @click="api.updateStyle('textCase', 'uppercase')">AA</button>
                            <button type="button" :class="{ active: api.style?.textCase === 'lowercase' }" @click="api.updateStyle('textCase', 'lowercase')">aa</button>
                            <button type="button" :class="{ active: api.style?.textCase === 'capitalize' }" @click="api.updateStyle('textCase', 'capitalize')">Aa.</button>
                        </div>
                    </div>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Text Color</span>
                        <div class="color-field">
                            <input type="color" class="color-field__swatch" :value="api.style?.color || '#ffffff'" :disabled="api.isLocked || !api.params.words.enabled" @input="api.updateStyle('color', ($event.target as HTMLInputElement).value)" />
                            <input type="text" class="color-field__hex inspector-input" :value="api.style?.color || '#ffffff'" :disabled="api.isLocked || !api.params.words.enabled" @change="api.updateStyle('color', ($event.target as HTMLInputElement).value)" />
                        </div>
                    </div>
                    <AnimatableNumberField label="Text Opacity" :model-value="Number(api.style?.opacity ?? 1)" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updateStyle('opacity', $event)" />
                </details>

                <details class="style-sub-section">
                    <summary class="style-sub-section__header">Background</summary>
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Background Color</span>
                        <div class="color-field">
                            <input type="color" class="color-field__swatch" :value="api.style?.backgroundColor || '#000000'" :disabled="api.isLocked || !api.params.words.enabled" @input="api.updateStyle('backgroundColor', ($event.target as HTMLInputElement).value)" />
                            <input type="text" class="color-field__hex inspector-input" :value="api.style?.backgroundColor || '#000000'" :disabled="api.isLocked || !api.params.words.enabled" @change="api.updateStyle('backgroundColor', ($event.target as HTMLInputElement).value)" />
                        </div>
                    </div>
                    <AnimatableNumberField label="Background Opacity" :model-value="Number(api.style?.backgroundOpacity ?? 0)" :min="0" :max="1" :step="0.01" :display-decimals="2" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updateStyle('backgroundOpacity', $event)" />
                    <AnimatableNumberField label="Background Padding" :model-value="Number(api.style?.backgroundPadding ?? 0)" :min="0" :max="128" :step="1" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updateStyle('backgroundPadding', $event)" />
                    <AnimatableNumberField label="Background Radius" :model-value="Number(api.style?.backgroundBorderRadius ?? 0)" :min="0" :max="128" :step="1" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updateStyle('backgroundBorderRadius', $event)" />
                    <AnimatableNumberField label="Outline Width" :model-value="Number(api.style?.outlineWidth ?? 0)" :min="0" :max="32" :step="0.5" :display-decimals="1" :disabled="api.isLocked || !api.params.words.enabled" @update:model-value="api.updateStyle('outlineWidth', $event)" />
                    <div class="style-v2__field">
                        <span class="style-v2__field-label">Outline Color</span>
                        <div class="color-field">
                            <input type="color" class="color-field__swatch" :value="api.style?.outlineColor || '#000000'" :disabled="api.isLocked || !api.params.words.enabled" @input="api.updateStyle('outlineColor', ($event.target as HTMLInputElement).value)" />
                            <input type="text" class="color-field__hex inspector-input" :value="api.style?.outlineColor || '#000000'" :disabled="api.isLocked || !api.params.words.enabled" @change="api.updateStyle('outlineColor', ($event.target as HTMLInputElement).value)" />
                        </div>
                    </div>
                </details>
            </div>
        </div>
    </details>
</template>
