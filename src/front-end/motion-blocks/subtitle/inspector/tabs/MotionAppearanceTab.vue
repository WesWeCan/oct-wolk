<script setup lang="ts">
import SvgIcon from '@jamescoyle/vue-icon';
import {
    mdiDiamond,
    mdiFormatBold,
    mdiFormatItalic,
    mdiFormatUnderline,
    mdiFormatAlignLeft,
    mdiFormatAlignCenter,
    mdiFormatAlignRight,
    mdiFormatAlignJustify,
} from '@mdi/js';
import type { MotionTrack, MotionStyle, TextAlign, WolkProjectFont } from '@/types/project_types';
import AnimatableNumberField from '@/front-end/components/editor/motion/AnimatableNumberField.vue';
import MotionFontSelector from '@/front-end/motion-blocks/subtitle/inspector/tabs/MotionFontSelector.vue';
import type { MotionFontSelection } from '@/front-end/utils/fonts/fontUtils';

const props = defineProps<{
    track: MotionTrack;
    currentFrame: number;
    projectFont?: WolkProjectFont;
}>();

const emit = defineEmits<{
    (e: 'update-style', key: keyof MotionStyle, value: any): void;
    (e: 'update-font', value: MotionFontSelection): void;
    (e: 'toggle-keyframe', path: string, value: any): void;
    (e: 'toggle-property-keyframing', path: string): void;
}>();

const style = () => props.track.block.style;

const isKeyframingEnabled = (path: string): boolean => {
    const pt = props.track.block.propertyTracks.find(p => p.propertyPath === path);
    return !!(pt && pt.enabled !== false);
};

const hasKeyframeAtFrame = (path: string): boolean => {
    const pt = props.track.block.propertyTracks.find(p => p.propertyPath === path);
    if (!pt || !pt.keyframes?.length) return false;
    return pt.keyframes.some(kf => kf.frame === props.currentFrame);
};

const hasAnyKeyframe = (path: string): boolean => {
    const pt = props.track.block.propertyTracks.find(p => p.propertyPath === path);
    return !!(pt && pt.keyframes?.length);
};

type DiamondState = 'empty' | 'half' | 'filled';
const diamondState = (path: string): DiamondState => {
    if (!isKeyframingEnabled(path)) return 'empty';
    if (hasKeyframeAtFrame(path)) return 'filled';
    if (hasAnyKeyframe(path)) return 'half';
    return 'empty';
};

const diamondClick = (path: string, value: any) => {
    if (!isKeyframingEnabled(path)) {
        emit('toggle-property-keyframing', path);
        return;
    }
    emit('toggle-keyframe', path, value);
};

const diamondContextMenu = (event: MouseEvent, path: string) => {
    event.preventDefault();
    if (isKeyframingEnabled(path)) {
        emit('toggle-property-keyframing', path);
    }
};

const resolveStyle = <K extends keyof MotionStyle>(key: K, fallback: MotionStyle[K]): MotionStyle[K] => {
    const v = style()[key];
    return v !== undefined && v !== null ? v : fallback;
};
</script>

<template>
    <div class="motion-tab style-v2">
        <!-- ===== Typography ===== -->
        <details class="style-sub-section" open>
            <summary class="style-sub-section__header">Typography</summary>

            <div class="style-v2__field">
                <div class="style-v2__field-header">
                    <span class="style-v2__field-label">Font Family</span>
                    <button
                        class="kf-diamond"
                        :class="diamondState('style.fontFamily')"
                        title="Keyframe font family"
                        @click="diamondClick('style.fontFamily', style().fontFamily)"
                        @contextmenu="diamondContextMenu($event, 'style.fontFamily')"
                    >
                        <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
                    </button>
                </div>
                <MotionFontSelector
                    :model-value="style()"
                    :project-font="projectFont"
                    @update:model-value="(v: MotionFontSelection) => emit('update-font', v)"
                />
            </div>

            <AnimatableNumberField
                label="Size"
                :model-value="Number(style().fontSize)"
                :min="8"
                :step="1"
                :fallback-value="72"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.fontSize')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.fontSize')"
                :has-any-keyframes="hasAnyKeyframe('style.fontSize')"
                @update:model-value="(v: number) => emit('update-style', 'fontSize', v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.fontSize')"
                @toggle-keyframe="(v: number) => diamondClick('style.fontSize', v)"
            />

            <AnimatableNumberField
                label="Weight"
                :model-value="Number(style().fontWeight)"
                :min="100"
                :max="900"
                :step="100"
                :fallback-value="400"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.fontWeight')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.fontWeight')"
                :has-any-keyframes="hasAnyKeyframe('style.fontWeight')"
                @update:model-value="(v: number) => emit('update-style', 'fontWeight', v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.fontWeight')"
                @toggle-keyframe="(v: number) => diamondClick('style.fontWeight', v)"
            />

            <!-- B / I / U style toggles -->
            <div class="style-v2__icon-row">
                <button
                    class="style-toggle"
                    :class="{ active: style().fontWeight >= 700 }"
                    title="Bold"
                    @click="emit('update-style', 'fontWeight', style().fontWeight >= 700 ? 400 : 700)"
                >
                    <SvgIcon type="mdi" :path="mdiFormatBold" :size="16" />
                </button>
                <button
                    class="style-toggle"
                    :class="{ active: style().fontStyle === 'italic' }"
                    title="Italic"
                    @click="emit('update-style', 'fontStyle', style().fontStyle === 'italic' ? 'normal' : 'italic')"
                >
                    <SvgIcon type="mdi" :path="mdiFormatItalic" :size="16" />
                </button>
                <button
                    class="style-toggle"
                    :class="{ active: style().underline }"
                    title="Underline"
                    @click="emit('update-style', 'underline', !style().underline)"
                >
                    <SvgIcon type="mdi" :path="mdiFormatUnderline" :size="16" />
                </button>
            </div>
        </details>

        <!-- ===== Text ===== -->
        <details class="style-sub-section" open>
            <summary class="style-sub-section__header">Text</summary>

            <!-- Text Case -->
            <div class="style-v2__field">
                <div class="style-v2__field-header">
                    <span class="style-v2__field-label">Text Case</span>
                    <button
                        class="kf-diamond"
                        :class="diamondState('style.textCase')"
                        title="Keyframe text case"
                        @click="diamondClick('style.textCase', style().textCase)"
                        @contextmenu="diamondContextMenu($event, 'style.textCase')"
                    >
                        <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
                    </button>
                </div>
                <div class="segmented-control">
                    <button :class="{ active: style().textCase === 'none' }" @click="emit('update-style', 'textCase', 'none')">Aa</button>
                    <button :class="{ active: style().textCase === 'uppercase' }" @click="emit('update-style', 'textCase', 'uppercase')">AA</button>
                    <button :class="{ active: style().textCase === 'lowercase' }" @click="emit('update-style', 'textCase', 'lowercase')">aa</button>
                    <button :class="{ active: style().textCase === 'capitalize' }" @click="emit('update-style', 'textCase', 'capitalize')">Aa.</button>
                </div>
            </div>

            <!-- Text Align -->
            <div class="style-v2__field">
                <div class="style-v2__field-header">
                    <span class="style-v2__field-label">Text Align</span>
                    <button
                        class="kf-diamond"
                        :class="diamondState('style.textAlign')"
                        title="Keyframe text align"
                        @click="diamondClick('style.textAlign', resolveStyle('textAlign', 'center'))"
                        @contextmenu="diamondContextMenu($event, 'style.textAlign')"
                    >
                        <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
                    </button>
                </div>
                <div class="segmented-control">
                    <button :class="{ active: resolveStyle('textAlign', 'center') === 'left' }" title="Left" @click="emit('update-style', 'textAlign' as any, 'left' as TextAlign)">
                        <SvgIcon type="mdi" :path="mdiFormatAlignLeft" :size="16" />
                    </button>
                    <button :class="{ active: resolveStyle('textAlign', 'center') === 'center' }" title="Center" @click="emit('update-style', 'textAlign' as any, 'center' as TextAlign)">
                        <SvgIcon type="mdi" :path="mdiFormatAlignCenter" :size="16" />
                    </button>
                    <button :class="{ active: resolveStyle('textAlign', 'center') === 'right' }" title="Right" @click="emit('update-style', 'textAlign' as any, 'right' as TextAlign)">
                        <SvgIcon type="mdi" :path="mdiFormatAlignRight" :size="16" />
                    </button>
                    <button :class="{ active: resolveStyle('textAlign', 'center') === 'justify' }" title="Justify" @click="emit('update-style', 'textAlign' as any, 'justify' as TextAlign)">
                        <SvgIcon type="mdi" :path="mdiFormatAlignJustify" :size="16" />
                    </button>
                </div>
            </div>

            <AnimatableNumberField
                label="Letter Spacing"
                :model-value="Number(style().letterSpacing)"
                :min="-20"
                :max="80"
                :step="0.5"
                :fallback-value="0"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.letterSpacing')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.letterSpacing')"
                :has-any-keyframes="hasAnyKeyframe('style.letterSpacing')"
                @update:model-value="(v: number) => emit('update-style', 'letterSpacing', v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.letterSpacing')"
                @toggle-keyframe="(v: number) => diamondClick('style.letterSpacing', v)"
            />

            <AnimatableNumberField
                label="Line Height"
                :model-value="Number(style().lineHeight)"
                :min="0.8"
                :max="3"
                :step="0.05"
                :fallback-value="1.2"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.lineHeight')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.lineHeight')"
                :has-any-keyframes="hasAnyKeyframe('style.lineHeight')"
                @update:model-value="(v: number) => emit('update-style', 'lineHeight', v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.lineHeight')"
                @toggle-keyframe="(v: number) => diamondClick('style.lineHeight', v)"
            />
        </details>

        <!-- ===== Color ===== -->
        <details class="style-sub-section" open>
            <summary class="style-sub-section__header">Color</summary>

            <!-- Text Color -->
            <div class="style-v2__field">
                <div class="style-v2__field-header">
                    <span class="style-v2__field-label">Text Color</span>
                    <button
                        class="kf-diamond"
                        :class="diamondState('style.color')"
                        title="Keyframe color"
                        @click="diamondClick('style.color', style().color)"
                        @contextmenu="diamondContextMenu($event, 'style.color')"
                    >
                        <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
                    </button>
                </div>
                <div class="color-field">
                    <input
                        type="color"
                        class="color-field__swatch"
                        :value="style().color"
                        @input="emit('update-style', 'color', ($event.target as HTMLInputElement).value)"
                    />
                    <input
                        type="text"
                        class="color-field__hex inspector-input"
                        :value="style().color"
                        @change="emit('update-style', 'color', ($event.target as HTMLInputElement).value)"
                    />
                </div>
            </div>

            <!-- Text Opacity -->
            <AnimatableNumberField
                label="Text Opacity"
                :model-value="Number(style().opacity)"
                :min="0"
                :max="1"
                :step="0.05"
                :fallback-value="1"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.opacity')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.opacity')"
                :has-any-keyframes="hasAnyKeyframe('style.opacity')"
                @update:model-value="(v: number) => emit('update-style', 'opacity', v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.opacity')"
                @toggle-keyframe="(v: number) => diamondClick('style.opacity', v)"
            />

            <!-- Block Opacity -->
            <AnimatableNumberField
                label="Block Opacity"
                :model-value="Number(resolveStyle('globalOpacity', 1))"
                :min="0"
                :max="1"
                :step="0.05"
                :fallback-value="1"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.globalOpacity')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.globalOpacity')"
                :has-any-keyframes="hasAnyKeyframe('style.globalOpacity')"
                @update:model-value="(v: number) => emit('update-style', 'globalOpacity' as any, v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.globalOpacity')"
                @toggle-keyframe="(v: number) => diamondClick('style.globalOpacity', v)"
            />

            <!-- BG Color -->
            <div class="style-v2__field">
                <div class="style-v2__field-header">
                    <span class="style-v2__field-label">Background</span>
                    <button
                        class="kf-diamond"
                        :class="diamondState('style.backgroundColor')"
                        title="Keyframe BG color"
                        @click="diamondClick('style.backgroundColor', style().backgroundColor ?? '#000000')"
                        @contextmenu="diamondContextMenu($event, 'style.backgroundColor')"
                    >
                        <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
                    </button>
                </div>
                <div class="color-field">
                    <input
                        type="color"
                        class="color-field__swatch"
                        :value="style().backgroundColor || '#000000'"
                        @input="emit('update-style', 'backgroundColor', ($event.target as HTMLInputElement).value)"
                    />
                    <input
                        type="text"
                        class="color-field__hex inspector-input"
                        :value="style().backgroundColor || '#000000'"
                        @change="emit('update-style', 'backgroundColor', ($event.target as HTMLInputElement).value)"
                    />
                </div>
            </div>

            <AnimatableNumberField
                label="BG Opacity"
                :model-value="Number(resolveStyle('backgroundOpacity', 0))"
                :min="0"
                :max="1"
                :step="0.05"
                :fallback-value="0"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.backgroundOpacity')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.backgroundOpacity')"
                :has-any-keyframes="hasAnyKeyframe('style.backgroundOpacity')"
                @update:model-value="(v: number) => emit('update-style', 'backgroundOpacity' as any, v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.backgroundOpacity')"
                @toggle-keyframe="(v: number) => diamondClick('style.backgroundOpacity', v)"
            />

            <AnimatableNumberField
                label="BG Padding"
                :model-value="Number(style().backgroundPadding)"
                :min="0"
                :max="200"
                :step="1"
                :fallback-value="0"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.backgroundPadding')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.backgroundPadding')"
                :has-any-keyframes="hasAnyKeyframe('style.backgroundPadding')"
                @update:model-value="(v: number) => emit('update-style', 'backgroundPadding', v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.backgroundPadding')"
                @toggle-keyframe="(v: number) => diamondClick('style.backgroundPadding', v)"
            />

            <AnimatableNumberField
                label="BG Radius"
                :model-value="Number(resolveStyle('backgroundBorderRadius', 0))"
                :min="0"
                :max="100"
                :step="1"
                :fallback-value="0"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.backgroundBorderRadius')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.backgroundBorderRadius')"
                :has-any-keyframes="hasAnyKeyframe('style.backgroundBorderRadius')"
                @update:model-value="(v: number) => emit('update-style', 'backgroundBorderRadius' as any, v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.backgroundBorderRadius')"
                @toggle-keyframe="(v: number) => diamondClick('style.backgroundBorderRadius', v)"
            />
        </details>

        <!-- ===== Outline ===== -->
        <details class="style-sub-section" open>
            <summary class="style-sub-section__header">Outline</summary>

            <AnimatableNumberField
                label="Outline Width"
                :model-value="Number(resolveStyle('outlineWidth', 0))"
                :min="0"
                :max="50"
                :step="0.5"
                :fallback-value="0"
                :show-keyframing="true"
                :keyframing-enabled="isKeyframingEnabled('style.outlineWidth')"
                :has-key-at-current-frame="hasKeyframeAtFrame('style.outlineWidth')"
                :has-any-keyframes="hasAnyKeyframe('style.outlineWidth')"
                @update:model-value="(v: number) => emit('update-style', 'outlineWidth' as any, v)"
                @remove-keyframes="emit('toggle-property-keyframing', 'style.outlineWidth')"
                @toggle-keyframe="(v: number) => diamondClick('style.outlineWidth', v)"
            />

            <div class="style-v2__field">
                <div class="style-v2__field-header">
                    <span class="style-v2__field-label">Outline Color</span>
                    <button
                        class="kf-diamond"
                        :class="diamondState('style.outlineColor')"
                        title="Keyframe outline color"
                        @click="diamondClick('style.outlineColor', resolveStyle('outlineColor', '#000000'))"
                        @contextmenu="diamondContextMenu($event, 'style.outlineColor')"
                    >
                        <SvgIcon type="mdi" :path="mdiDiamond" :size="12" />
                    </button>
                </div>
                <div class="color-field">
                    <input
                        type="color"
                        class="color-field__swatch"
                        :value="resolveStyle('outlineColor', '#000000')"
                        @input="emit('update-style', 'outlineColor' as any, ($event.target as HTMLInputElement).value)"
                    />
                    <input
                        type="text"
                        class="color-field__hex inspector-input"
                        :value="resolveStyle('outlineColor', '#000000')"
                        @change="emit('update-style', 'outlineColor' as any, ($event.target as HTMLInputElement).value)"
                    />
                </div>
            </div>
        </details>

    </div>
</template>
