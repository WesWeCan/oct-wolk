<script setup lang="ts">
import type { MotionTrack, MotionStyle } from '@/types/project_types';

const props = defineProps<{
    track: MotionTrack;
    currentFrame: number;
    projectFontFamily?: string;
}>();

const emit = defineEmits<{
    (e: 'update-style', key: keyof MotionStyle, value: any): void;
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

const kfClick = (path: string, value: any) => {
    if (isKeyframingEnabled(path)) emit('toggle-keyframe', path, value);
};
</script>

<template>
    <div class="motion-tab">
        <!-- Font Family (stationary keyframeable) -->
        <div class="motion-tab__kf-field">
            <label>
                <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.fontFamily')" @change="emit('toggle-property-keyframing', 'style.fontFamily')" />
                Font Family
            </label>
            <div class="motion-tab__kf-row">
                <input
                    type="text"
                    class="inspector-input"
                    :value="style().fontFamily"
                    :placeholder="projectFontFamily || 'system-ui'"
                    @change="emit('update-style', 'fontFamily', ($event.target as HTMLInputElement).value || projectFontFamily || 'system-ui')"
                />
                <button class="kf-diamond" :class="diamondState('style.fontFamily')" :disabled="!isKeyframingEnabled('style.fontFamily')" @click="kfClick('style.fontFamily', style().fontFamily)">
                    <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 L11 6 L6 11 L1 6 Z" /></svg>
                </button>
            </div>
        </div>

        <div class="motion-tab__row">
            <!-- Font Size (moving) -->
            <div class="motion-tab__kf-field" style="flex:1;">
                <label>
                    <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.fontSize')" @change="emit('toggle-property-keyframing', 'style.fontSize')" />
                    Size
                </label>
                <div class="motion-tab__kf-row">
                    <input type="number" class="inspector-input" :value="style().fontSize" min="8" @change="emit('update-style', 'fontSize', Number(($event.target as HTMLInputElement).value) || 72)" />
                    <button class="kf-diamond" :class="diamondState('style.fontSize')" :disabled="!isKeyframingEnabled('style.fontSize')" @click="kfClick('style.fontSize', style().fontSize)">
                        <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 L11 6 L6 11 L1 6 Z" /></svg>
                    </button>
                </div>
            </div>
            <!-- Font Weight (moving) -->
            <div class="motion-tab__kf-field" style="flex:1;">
                <label>
                    <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.fontWeight')" @change="emit('toggle-property-keyframing', 'style.fontWeight')" />
                    Weight
                </label>
                <div class="motion-tab__kf-row">
                    <input type="number" class="inspector-input" :value="style().fontWeight" step="100" min="100" max="900" @change="emit('update-style', 'fontWeight', Number(($event.target as HTMLInputElement).value) || 400)" />
                    <button class="kf-diamond" :class="diamondState('style.fontWeight')" :disabled="!isKeyframingEnabled('style.fontWeight')" @click="kfClick('style.fontWeight', style().fontWeight)">
                        <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 L11 6 L6 11 L1 6 Z" /></svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- B / I / U toggles with keyframe checkboxes -->
        <div class="motion-tab__toggles">
            <button class="style-toggle" :class="{ active: style().fontWeight >= 700 }" title="Bold" @click="emit('update-style', 'fontWeight', style().fontWeight >= 700 ? 400 : 700)">B</button>
            <button class="style-toggle italic" :class="{ active: style().fontStyle === 'italic' }" title="Italic" @click="emit('update-style', 'fontStyle', style().fontStyle === 'italic' ? 'normal' : 'italic')">I</button>
            <button class="style-toggle underline" :class="{ active: style().underline }" title="Underline" @click="emit('update-style', 'underline', !style().underline)">U</button>
            <span style="flex:1;"></span>
            <label class="kf-inline-toggle" title="Keyframe font style">
                <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.fontStyle')" @change="emit('toggle-property-keyframing', 'style.fontStyle')" />
                <span>I kf</span>
            </label>
            <label class="kf-inline-toggle" title="Keyframe underline">
                <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.underline')" @change="emit('toggle-property-keyframing', 'style.underline')" />
                <span>U kf</span>
            </label>
        </div>

        <div class="motion-tab__row">
            <!-- Color (stationary) -->
            <div class="motion-tab__kf-field" style="flex:1;">
                <label>
                    <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.color')" @change="emit('toggle-property-keyframing', 'style.color')" />
                    Color
                </label>
                <div class="motion-tab__kf-row">
                    <input type="color" class="inspector-input" :value="style().color" @input="emit('update-style', 'color', ($event.target as HTMLInputElement).value)" />
                    <button class="kf-diamond" :class="diamondState('style.color')" :disabled="!isKeyframingEnabled('style.color')" @click="kfClick('style.color', style().color)">
                        <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 L11 6 L6 11 L1 6 Z" /></svg>
                    </button>
                </div>
            </div>
            <!-- Opacity (moving, no duplicate — Position tab has it, keep here for quick access) -->
            <div class="motion-tab__field" style="flex:1;">
                <label>Opacity</label>
                <input type="range" min="0" max="1" step="0.05" class="inspector-input" :value="style().opacity" @input="emit('update-style', 'opacity', Number(($event.target as HTMLInputElement).value))" />
                <span class="motion-tab__value">{{ (style().opacity * 100).toFixed(0) }}%</span>
            </div>
        </div>

        <!-- Text Case (stationary) -->
        <div class="motion-tab__kf-field">
            <label>
                <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.textCase')" @change="emit('toggle-property-keyframing', 'style.textCase')" />
                Text Case
            </label>
            <div class="motion-tab__chips">
                <button class="chip" :class="{ active: style().textCase === 'none' }" @click="emit('update-style', 'textCase', 'none')">Aa</button>
                <button class="chip" :class="{ active: style().textCase === 'uppercase' }" @click="emit('update-style', 'textCase', 'uppercase')">AA</button>
                <button class="chip" :class="{ active: style().textCase === 'lowercase' }" @click="emit('update-style', 'textCase', 'lowercase')">aa</button>
                <button class="chip" :class="{ active: style().textCase === 'capitalize' }" @click="emit('update-style', 'textCase', 'capitalize')">Aa.</button>
                <button class="kf-diamond" :class="diamondState('style.textCase')" :disabled="!isKeyframingEnabled('style.textCase')" @click="kfClick('style.textCase', style().textCase)">
                    <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 L11 6 L6 11 L1 6 Z" /></svg>
                </button>
            </div>
        </div>

        <details class="motion-tab__advanced">
            <summary>Advanced</summary>
            <div class="motion-tab__advanced-content">
                <div class="motion-tab__kf-field">
                    <label>
                        <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.letterSpacing')" @change="emit('toggle-property-keyframing', 'style.letterSpacing')" />
                        Letter Spacing
                    </label>
                    <div class="motion-tab__kf-row">
                        <input type="number" class="inspector-input" min="-20" max="80" step="0.5" :value="style().letterSpacing" @change="emit('update-style', 'letterSpacing', Number(($event.target as HTMLInputElement).value) || 0)" />
                        <button class="kf-diamond" :class="diamondState('style.letterSpacing')" :disabled="!isKeyframingEnabled('style.letterSpacing')" @click="kfClick('style.letterSpacing', style().letterSpacing)">
                            <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 L11 6 L6 11 L1 6 Z" /></svg>
                        </button>
                    </div>
                </div>
                <div class="motion-tab__kf-field">
                    <label>
                        <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.lineHeight')" @change="emit('toggle-property-keyframing', 'style.lineHeight')" />
                        Line Height
                    </label>
                    <div class="motion-tab__kf-row">
                        <input type="number" class="inspector-input" min="0.8" max="3" step="0.05" :value="style().lineHeight" @change="emit('update-style', 'lineHeight', Number(($event.target as HTMLInputElement).value) || 1.2)" />
                        <button class="kf-diamond" :class="diamondState('style.lineHeight')" :disabled="!isKeyframingEnabled('style.lineHeight')" @click="kfClick('style.lineHeight', style().lineHeight)">
                            <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 L11 6 L6 11 L1 6 Z" /></svg>
                        </button>
                    </div>
                </div>
                <div class="motion-tab__row">
                    <div class="motion-tab__kf-field" style="flex:1;">
                        <label>
                            <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.backgroundColor')" @change="emit('toggle-property-keyframing', 'style.backgroundColor')" />
                            BG Color
                        </label>
                        <div class="motion-tab__kf-row">
                            <input type="color" class="inspector-input" :value="style().backgroundColor || '#000000'" @input="emit('update-style', 'backgroundColor', ($event.target as HTMLInputElement).value)" />
                            <button class="kf-diamond" :class="diamondState('style.backgroundColor')" :disabled="!isKeyframingEnabled('style.backgroundColor')" @click="kfClick('style.backgroundColor', style().backgroundColor)">
                                <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 L11 6 L6 11 L1 6 Z" /></svg>
                            </button>
                        </div>
                    </div>
                    <div class="motion-tab__kf-field" style="flex:1;">
                        <label>
                            <input type="checkbox" class="kf-enable-checkbox" :checked="isKeyframingEnabled('style.backgroundPadding')" @change="emit('toggle-property-keyframing', 'style.backgroundPadding')" />
                            BG Padding
                        </label>
                        <div class="motion-tab__kf-row">
                            <input type="number" class="inspector-input" min="0" max="200" step="1" :value="style().backgroundPadding" @change="emit('update-style', 'backgroundPadding', Number(($event.target as HTMLInputElement).value) || 0)" />
                            <button class="kf-diamond" :class="diamondState('style.backgroundPadding')" :disabled="!isKeyframingEnabled('style.backgroundPadding')" @click="kfClick('style.backgroundPadding', style().backgroundPadding)">
                                <svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 L11 6 L6 11 L1 6 Z" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </details>
    </div>
</template>
