import type { KeyframePropertyDef } from '@/front-end/motion-blocks/core/keyframes';
import { styleGetter, transformGetter } from '@/front-end/motion-blocks/core/keyframes';

export const SUBTITLE_KEYFRAME_PROPERTIES: KeyframePropertyDef[] = [
    { path: 'transform.offsetX', label: 'Reference X', shortLabel: 'X', kind: 'moving', defaultInterpolation: 'linear', getValue: transformGetter('offsetX') },
    { path: 'transform.offsetY', label: 'Reference Y', shortLabel: 'Y', kind: 'moving', defaultInterpolation: 'linear', getValue: transformGetter('offsetY') },
    { path: 'transform.scale', label: 'Scale', shortLabel: 'Scl', kind: 'moving', defaultInterpolation: 'linear', getValue: transformGetter('scale'), min: 0.05, max: 10, step: 0.01 },
    { path: 'transform.rotation', label: 'Rotation', shortLabel: 'Rot', kind: 'moving', defaultInterpolation: 'linear', getValue: transformGetter('rotation'), min: -360, max: 360, step: 0.5 },
    { path: 'style.opacity', label: 'Text Opacity', shortLabel: 'TOp', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('opacity'), min: 0, max: 1, step: 0.05 },
    { path: 'style.globalOpacity', label: 'Block Opacity', shortLabel: 'BlO', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('globalOpacity'), min: 0, max: 1, step: 0.05 },
    { path: 'style.fontSize', label: 'Font Size', shortLabel: 'Sz', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('fontSize'), min: 8 },
    { path: 'style.fontWeight', label: 'Font Weight', shortLabel: 'Wt', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('fontWeight'), min: 100, max: 900, step: 100 },
    { path: 'style.letterSpacing', label: 'Letter Spacing', shortLabel: 'LS', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('letterSpacing'), min: -20, max: 80, step: 0.5 },
    { path: 'style.lineHeight', label: 'Line Height', shortLabel: 'LH', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('lineHeight'), min: 0.8, max: 3, step: 0.05 },
    { path: 'style.backgroundPadding', label: 'BG Padding', shortLabel: 'Pad', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('backgroundPadding'), min: 0, max: 200, step: 1 },
    { path: 'style.backgroundOpacity', label: 'BG Opacity', shortLabel: 'BOp', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('backgroundOpacity'), min: 0, max: 1, step: 0.05 },
    { path: 'style.backgroundBorderRadius', label: 'BG Radius', shortLabel: 'BR', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('backgroundBorderRadius'), min: 0, max: 100, step: 1 },
    { path: 'style.color', label: 'Color', shortLabel: 'Col', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('color') },
    { path: 'style.backgroundColor', label: 'BG Color', shortLabel: 'BG', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('backgroundColor') },
    { path: 'style.fontFamily', label: 'Font Family', shortLabel: 'Fnt', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('fontFamily') },
    { path: 'style.textCase', label: 'Text Case', shortLabel: 'Cs', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('textCase') },
    { path: 'style.outlineWidth', label: 'Outline Width', shortLabel: 'OW', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('outlineWidth'), min: 0, max: 50, step: 0.5 },
    { path: 'style.outlineColor', label: 'Outline Color', shortLabel: 'OC', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('outlineColor') },
    { path: 'style.textAlign', label: 'Text Align', shortLabel: 'Al', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('textAlign') },
    { path: 'style.maxLines', label: 'Max Lines', shortLabel: 'ML', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('maxLines') },
    { path: 'style.safeAreaPadding', label: 'Constraint Inset', shortLabel: 'CR', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('safeAreaPadding'), min: 0, step: 1 },
    { path: 'style.safeAreaOffsetX', label: 'Region Offset X', shortLabel: 'ROX', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('safeAreaOffsetX'), step: 1 },
    { path: 'style.safeAreaOffsetY', label: 'Region Offset Y', shortLabel: 'ROY', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('safeAreaOffsetY'), step: 1 },
];
