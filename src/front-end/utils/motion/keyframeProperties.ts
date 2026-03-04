import type { MotionBlock } from '@/types/project_types';

export type KeyframeKind = 'moving' | 'stationary';

export interface KeyframePropertyDef {
    path: string;
    label: string;
    shortLabel: string;
    kind: KeyframeKind;
    defaultInterpolation: 'linear' | 'step';
    getValue: (block: MotionBlock) => any;
    min?: number;
    max?: number;
    step?: number;
}

function styleGetter(key: string) {
    return (block: MotionBlock) => (block.style as any)[key];
}
function transformGetter(key: string) {
    return (block: MotionBlock) => (block.transform as any)[key];
}

export const KEYFRAMEABLE_PROPERTIES: KeyframePropertyDef[] = [
    // Moving (numeric, interpolated)
    { path: 'transform.offsetX', label: 'Offset X', shortLabel: 'X', kind: 'moving', defaultInterpolation: 'linear', getValue: transformGetter('offsetX') },
    { path: 'transform.offsetY', label: 'Offset Y', shortLabel: 'Y', kind: 'moving', defaultInterpolation: 'linear', getValue: transformGetter('offsetY') },
    { path: 'transform.scale', label: 'Scale', shortLabel: 'Scl', kind: 'moving', defaultInterpolation: 'linear', getValue: transformGetter('scale'), min: 0.05, max: 10, step: 0.01 },
    { path: 'transform.rotation', label: 'Rotation', shortLabel: 'Rot', kind: 'moving', defaultInterpolation: 'linear', getValue: transformGetter('rotation'), min: -360, max: 360, step: 0.5 },
    { path: 'style.opacity', label: 'Opacity', shortLabel: 'Opa', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('opacity'), min: 0, max: 1, step: 0.05 },
    { path: 'style.fontSize', label: 'Font Size', shortLabel: 'Sz', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('fontSize'), min: 8 },
    { path: 'style.fontWeight', label: 'Font Weight', shortLabel: 'Wt', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('fontWeight'), min: 100, max: 900, step: 100 },
    { path: 'style.letterSpacing', label: 'Letter Spacing', shortLabel: 'LS', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('letterSpacing'), min: -20, max: 80, step: 0.5 },
    { path: 'style.lineHeight', label: 'Line Height', shortLabel: 'LH', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('lineHeight'), min: 0.8, max: 3, step: 0.05 },
    { path: 'style.backgroundPadding', label: 'BG Padding', shortLabel: 'Pad', kind: 'moving', defaultInterpolation: 'linear', getValue: styleGetter('backgroundPadding'), min: 0, max: 200, step: 1 },

    // Stationary (discrete, step)
    { path: 'style.color', label: 'Color', shortLabel: 'Col', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('color') },
    { path: 'style.backgroundColor', label: 'BG Color', shortLabel: 'BG', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('backgroundColor') },
    { path: 'style.fontFamily', label: 'Font Family', shortLabel: 'Fnt', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('fontFamily') },
    { path: 'style.fontStyle', label: 'Font Style', shortLabel: 'Sty', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('fontStyle') },
    { path: 'style.textCase', label: 'Text Case', shortLabel: 'Cs', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('textCase') },
    { path: 'style.underline', label: 'Underline', shortLabel: 'U', kind: 'stationary', defaultInterpolation: 'step', getValue: styleGetter('underline') },
];

export const KEYFRAME_PROPERTY_MAP = new Map(KEYFRAMEABLE_PROPERTIES.map(p => [p.path, p]));

export function getPropertyDef(path: string): KeyframePropertyDef | undefined {
    return KEYFRAME_PROPERTY_MAP.get(path);
}

export function isPropertyKeyframeable(path: string): boolean {
    return KEYFRAME_PROPERTY_MAP.has(path);
}
