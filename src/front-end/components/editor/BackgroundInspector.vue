<script setup lang="ts">
import { computed, ref } from 'vue';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';

const props = defineProps<{
    backgroundImage?: string;
    backgroundColor: string;
    backgroundVisible?: boolean;
    backgroundImageVisible?: boolean;
    backgroundOpacity?: number;
    backgroundUseGradient?: boolean;
    backgroundGradientColor?: string;
    backgroundGradientAngle?: number;
    backgroundImageFit?: 'cover' | 'contain' | 'stretch';
    backgroundImageOffsetX?: number;
    backgroundImageOffsetY?: number;
    backgroundImageScale?: number;
    backgroundImageOpacity?: number;
}>();

const emit = defineEmits<{
    (e: 'set-background-color', color: string): void;
    (e: 'set-background-visible', visible: boolean): void;
    (e: 'set-background-image-visible', visible: boolean): void;
    (e: 'set-background-opacity', opacity: number): void;
    (e: 'set-background-use-gradient', enabled: boolean): void;
    (e: 'set-background-gradient-color', color: string): void;
    (e: 'set-background-gradient-angle', angle: number): void;
    (e: 'set-background-fit', fit: 'cover' | 'contain' | 'stretch'): void;
    (e: 'set-background-image-offset-x', offsetX: number): void;
    (e: 'set-background-image-offset-y', offsetY: number): void;
    (e: 'set-background-image-scale', scale: number): void;
    (e: 'set-background-image-opacity', opacity: number): void;
    (e: 'upload-background-image', file: File): void;
    (e: 'clear-background-image'): void;
    (e: 'reset-background-image-controls'): void;
    (e: 'reset-background'): void;
}>();

const backgroundFitValue = computed(() => props.backgroundImageFit || 'cover');
const backgroundVisibleValue = computed(() => props.backgroundVisible !== false);
const backgroundImageVisibleValue = computed(() => props.backgroundImageVisible !== false);
const backgroundOpacityValue = computed(() => {
    const raw = Number(props.backgroundOpacity);
    return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 1;
});
const backgroundUseGradientValue = computed(() => !!props.backgroundUseGradient);
const backgroundGradientColorValue = computed(() => props.backgroundGradientColor || '#222222');
const backgroundGradientAngleValue = computed(() => {
    const raw = Number(props.backgroundGradientAngle);
    return Number.isFinite(raw) ? raw : 90;
});
const backgroundPreviewFillStyle = computed(() => {
    const opacity = backgroundOpacityValue.value;
    if (backgroundUseGradientValue.value) {
        return {
            background: `linear-gradient(${backgroundGradientAngleValue.value}deg, ${props.backgroundColor}, ${backgroundGradientColorValue.value})`,
            opacity: `${opacity}`,
        };
    }
    return {
        background: props.backgroundColor,
        opacity: `${opacity}`,
    };
});
const backgroundImageOffsetXValue = computed(() => {
    const raw = Number(props.backgroundImageOffsetX);
    return Number.isFinite(raw) ? raw : 0;
});
const backgroundImageOffsetYValue = computed(() => {
    const raw = Number(props.backgroundImageOffsetY);
    return Number.isFinite(raw) ? raw : 0;
});
const backgroundImageScaleValue = computed(() => {
    const raw = Number(props.backgroundImageScale);
    return Number.isFinite(raw) ? Math.max(0.05, raw) : 1;
});
const backgroundImageOpacityValue = computed(() => {
    const raw = Number(props.backgroundImageOpacity);
    return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 1;
});
const bgDropActive = ref(false);
const backgroundFileInput = ref<HTMLInputElement | null>(null);

const uploadBackgroundFile = (file?: File | null) => {
    if (!file) return;
    emit('upload-background-image', file);
};

const onUploadBackgroundImage = (event: Event) => {
    const input = event.target as HTMLInputElement;
    uploadBackgroundFile(input.files?.[0] ?? null);
    input.value = '';
};

const openBackgroundFilePicker = () => backgroundFileInput.value?.click();

const onBackgroundDrop = (event: DragEvent) => {
    event.preventDefault();
    bgDropActive.value = false;
    const file = event.dataTransfer?.files?.[0];
    uploadBackgroundFile(file ?? null);
};

const onBackgroundDragOver = (event: DragEvent) => {
    event.preventDefault();
    bgDropActive.value = true;
};

const onBackgroundDragLeave = () => {
    bgDropActive.value = false;
};
</script>

<template>
    <div class="background-inspector">
        <details class="inspector-section">
            <summary class="inspector-section__title">Background</summary>
            <div class="inspector-section__content">
                <div class="motion-tab style-v2">
                    <details class="style-sub-section">
                        <summary class="style-sub-section__header">Fill</summary>
                        <div v-if="!backgroundVisibleValue" class="inspector-note">
                            Background layer is currently hidden globally.
                        </div>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Mode</span>
                            <div class="segmented-control">
                                <button :class="{ active: !backgroundUseGradientValue }" @click="emit('set-background-use-gradient', false)">Solid</button>
                                <button :class="{ active: backgroundUseGradientValue }" @click="emit('set-background-use-gradient', true)">Gradient</button>
                            </div>
                        </div>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">{{ backgroundUseGradientValue ? 'Start Color' : 'Color' }}</span>
                            <div class="color-field">
                                <input
                                    type="color"
                                    class="color-field__swatch"
                                    :value="backgroundColor === 'transparent' ? '#000000' : backgroundColor"
                                    @input="emit('set-background-color', ($event.target as HTMLInputElement).value)"
                                />
                                <input
                                    type="text"
                                    class="color-field__hex inspector-input"
                                    :value="backgroundColor === 'transparent' ? '#000000' : backgroundColor"
                                    @change="emit('set-background-color', ($event.target as HTMLInputElement).value)"
                                />
                            </div>
                        </div>
                        <div v-if="backgroundUseGradientValue" class="style-v2__field">
                            <span class="style-v2__field-label">End Color</span>
                            <div class="color-field">
                                <input
                                    type="color"
                                    class="color-field__swatch"
                                    :value="backgroundGradientColorValue"
                                    @input="emit('set-background-gradient-color', ($event.target as HTMLInputElement).value)"
                                />
                                <input
                                    type="text"
                                    class="color-field__hex inspector-input"
                                    :value="backgroundGradientColorValue"
                                    @change="emit('set-background-gradient-color', ($event.target as HTMLInputElement).value)"
                                />
                            </div>
                        </div>
                        <AnimatableNumberField
                            v-if="backgroundUseGradientValue"
                            label="Gradient Angle"
                            :model-value="backgroundGradientAngleValue"
                            :step="1"
                            :fallback-value="90"
                            :hint="'0 = left to right, 90 = top to bottom'"
                            @update:model-value="emit('set-background-gradient-angle', $event)"
                        />

                        <AnimatableNumberField
                            label="Fill Opacity"
                            :model-value="backgroundOpacityValue"
                            :min="0"
                            :max="1"
                            :step="0.01"
                            :fallback-value="1"
                            :display-decimals="2"
                            @update:model-value="emit('set-background-opacity', Math.max(0, Math.min(1, $event)))"
                        />
                    </details>

                    <details class="style-sub-section">
                        <summary class="style-sub-section__header">Image</summary>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Image Layer</span>
                            <div class="segmented-control">
                                <button :class="{ active: backgroundImageVisibleValue }" @click="emit('set-background-image-visible', true)">Shown</button>
                                <button :class="{ active: !backgroundImageVisibleValue }" @click="emit('set-background-image-visible', false)">Hidden</button>
                            </div>
                        </div>
                        <div
                            class="background-preview"
                            :class="{ 'is-empty': !backgroundImage, 'is-drag-active': bgDropActive }"
                            @drop="onBackgroundDrop"
                            @dragover="onBackgroundDragOver"
                            @dragleave="onBackgroundDragLeave"
                        >
                            <div class="background-preview__fill" :style="backgroundPreviewFillStyle" />
                            <img
                                v-if="backgroundImage && backgroundImageVisibleValue"
                                class="background-preview__image"
                                :src="backgroundImage"
                                :style="{ opacity: backgroundImageOpacityValue }"
                                alt="Background preview"
                            />
                            <div class="background-preview__overlay">
                                {{
                                    bgDropActive
                                        ? 'Drop image to replace'
                                        : (backgroundImageVisibleValue
                                            ? (backgroundImage ? 'Drag image here to replace' : 'Drop image here')
                                            : 'Image hidden - showing fill/gradient')
                                }}
                            </div>
                        </div>

                        <input ref="backgroundFileInput" type="file" accept="image/*" class="background-hidden-file-input" @change="onUploadBackgroundImage" />
                        <div class="inspector-actions">
                            <button class="btn-sm" @click="openBackgroundFilePicker">{{ backgroundImage ? 'Replace Image' : 'Upload Image' }}</button>
                            <button v-if="backgroundImage" class="btn-sm danger" @click="emit('clear-background-image')">Remove Image</button>
                        </div>
                        <div class="style-v2__field">
                            <span class="style-v2__field-label">Image Fit</span>
                            <div class="segmented-control">
                                <button :class="{ active: backgroundFitValue === 'cover' }" @click="emit('set-background-fit', 'cover')">▣ Cover</button>
                                <button :class="{ active: backgroundFitValue === 'contain' }" @click="emit('set-background-fit', 'contain')">□ Contain</button>
                                <button :class="{ active: backgroundFitValue === 'stretch' }" @click="emit('set-background-fit', 'stretch')">↔ Stretch</button>
                            </div>
                        </div>
                        <AnimatableNumberField
                            label="Offset X"
                            :model-value="backgroundImageOffsetXValue"
                            :step="1"
                            :fallback-value="0"
                            @update:model-value="emit('set-background-image-offset-x', $event)"
                        />
                        <AnimatableNumberField
                            label="Offset Y"
                            :model-value="backgroundImageOffsetYValue"
                            :step="1"
                            :fallback-value="0"
                            @update:model-value="emit('set-background-image-offset-y', $event)"
                        />
                        <AnimatableNumberField
                            label="Image Scale"
                            :model-value="backgroundImageScaleValue"
                            :min="0.05"
                            :step="0.01"
                            :fallback-value="1"
                            :display-decimals="2"
                            @update:model-value="emit('set-background-image-scale', Math.max(0.05, $event))"
                        />
                        <AnimatableNumberField
                            label="Image Opacity"
                            :model-value="backgroundImageOpacityValue"
                            :min="0"
                            :max="1"
                            :step="0.01"
                            :fallback-value="1"
                            :display-decimals="2"
                            @update:model-value="emit('set-background-image-opacity', Math.max(0, Math.min(1, $event)))"
                        />
                    </details>

                    <details class="style-sub-section">
                        <summary class="style-sub-section__header">Reset</summary>
                        <div class="inspector-actions">
                            <button class="btn-sm" @click="emit('reset-background-image-controls')">Reset Image Controls</button>
                            <button class="btn-sm danger" @click="emit('reset-background')">Reset Background</button>
                        </div>
                    </details>
                </div>
            </div>
        </details>
    </div>
</template>
