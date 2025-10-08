export type AnimPropType = 'number' | 'vec2' | 'vec3' | 'color' | 'boolean';

export interface AnimatablePropertyMeta {
    propertyPath: string;
    label?: string;
    type: AnimPropType;
    default: any;
    min?: number;
    max?: number;
    step?: number;
    perAxis?: boolean;
    paramKey?: string; // inspector param key linkage
    group?: string; // optional grouping for UI organization
}

export const SCENE_ANIMATABLES: Record<string, AnimatablePropertyMeta[]> = {
    model3d: [
        // Camera (orbit)
        { propertyPath: 'camera.yaw', label: 'Camera Yaw (deg)', type: 'number', default: 0, step: 0.5, group: 'Camera' },
        { propertyPath: 'camera.pitch', label: 'Camera Pitch (deg)', type: 'number', default: 0, min: -89, max: 89, step: 0.5, group: 'Camera' },
        { propertyPath: 'camera.distance', label: 'Camera Distance', type: 'number', default: 6, min: 0, max: 50, step: 0.1, group: 'Camera' },
        { propertyPath: 'camera.fov', label: 'Camera FOV', type: 'number', default: 45, min: 10, max: 170, step: 1, group: 'Camera' },
        { propertyPath: 'camera.targetX', label: 'Camera Target X', type: 'number', default: 0, min: -20, max: 20, step: 0.05, group: 'Camera' },
        { propertyPath: 'camera.targetY', label: 'Camera Target Y', type: 'number', default: 0, min: -20, max: 20, step: 0.05, group: 'Camera' },
        { propertyPath: 'camera.targetZ', label: 'Camera Target Z', type: 'number', default: 0, min: -20, max: 20, step: 0.05, group: 'Camera' },

        // Model transform
        { propertyPath: 'model.positionX', label: 'Model X', type: 'number', default: 0, min: -20, max: 20, step: 0.05, group: 'Model Transform' },
        { propertyPath: 'model.positionY', label: 'Model Y', type: 'number', default: 0, min: -20, max: 20, step: 0.05, group: 'Model Transform' },
        { propertyPath: 'model.positionZ', label: 'Model Z', type: 'number', default: 0, min: -20, max: 20, step: 0.05, group: 'Model Transform' },
        { propertyPath: 'model.scale', label: 'Scale', type: 'number', default: 10, min: 0, max: 500, step: 0.1, paramKey: 'modelScale', group: 'Model Transform' },
        { propertyPath: 'model.scaleX', label: 'Scale X', type: 'number', default: 1, min: 0, max: 100, step: 0.1, group: 'Model Transform' },
        { propertyPath: 'model.scaleY', label: 'Scale Y', type: 'number', default: 1, min: 0, max: 100, step: 0.1, group: 'Model Transform' },
        { propertyPath: 'model.scaleZ', label: 'Scale Z', type: 'number', default: 1, min: 0, max: 100, step: 0.1, group: 'Model Transform' },
        { propertyPath: 'model.rotationX', label: 'Rot X (deg)', type: 'number', default: 0, step: 0.5, group: 'Model Transform' },
        { propertyPath: 'model.rotationY', label: 'Rot Y (deg)', type: 'number', default: 0, step: 0.5, group: 'Model Transform' },
        { propertyPath: 'model.rotationZ', label: 'Rot Z (deg)', type: 'number', default: 0, step: 0.5, group: 'Model Transform' },

        // Background (manual HSL)
        { propertyPath: 'background.hue', label: 'BG Hue', type: 'number', default: 210, min: 0, max: 360, step: 1, group: 'Background' },
        { propertyPath: 'background.sat', label: 'BG Sat', type: 'number', default: 30, min: 0, max: 100, step: 1, group: 'Background' },
        { propertyPath: 'background.light', label: 'BG Light', type: 'number', default: 12, min: 0, max: 100, step: 1, group: 'Background' },
        { propertyPath: 'background.opacity', label: 'BG Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Background' },

        // Labels
        { propertyPath: 'labels.radiusMultiplier', label: 'Label Radius', type: 'number', default: 0.5, min: 0, max: 10, step: 0.01, group: 'Labels' },
        { propertyPath: 'labels.size', label: 'Label Size', type: 'number', default: 1, min: 0, max: 5, step: 0.01, group: 'Labels' },
        { propertyPath: 'labels.opacity', label: 'Label Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Labels' },
        { propertyPath: 'labels.pulseAmount', label: 'Label Pulse', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Labels' },
        { propertyPath: 'labels.bgHue', label: 'Label Color Hue', type: 'number', default: 0, min: 0, max: 360, step: 1, group: 'Labels' },
        { propertyPath: 'labels.bgSat', label: 'Label Color Sat', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Labels' },
        { propertyPath: 'labels.bgLight', label: 'Label Color Light', type: 'number', default: 100, min: 0, max: 100, step: 1, group: 'Labels' },

        // Plexus
        { propertyPath: 'plexus.opacityMin', label: 'Plexus Opacity Min', type: 'number', default: 0.08, min: 0, max: 1, step: 0.01, group: 'Plexus' },
        { propertyPath: 'plexus.opacityMax', label: 'Plexus Opacity Max', type: 'number', default: 0.7, min: 0, max: 1, step: 0.01, group: 'Plexus' },
        { propertyPath: 'plexus.kNeighbors', label: 'Plexus Neighbors', type: 'number', default: 3, min: 1, max: 8, step: 1, group: 'Plexus' },
        { propertyPath: 'plexus.maxDistance', label: 'Plexus Max Dist', type: 'number', default: 4, min: 0, max: 10, step: 0.05, group: 'Plexus' },

        // Spokes
        { propertyPath: 'spokes.opacity', label: 'Spokes Opacity', type: 'number', default: 0.35, min: 0, max: 1, step: 0.01, group: 'Spokes' },
        { propertyPath: 'spokes.lengthFactor', label: 'Spokes Length', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01, group: 'Spokes' },

        // Reactivity
        { propertyPath: 'reactivity.model', label: 'Audio Reactivity (Model)', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Reactivity' },
        { propertyPath: 'reactivity.labels', label: 'Audio Reactivity (Labels)', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Reactivity' },
    ],
    wordSphere: [
        // Camera (orbit)
        { propertyPath: 'camera.yaw', label: 'Camera Yaw (deg)', type: 'number', default: 0, step: 0.5, group: 'Camera' },
        { propertyPath: 'camera.pitch', label: 'Camera Pitch (deg)', type: 'number', default: 0, min: -89, max: 89, step: 0.5, group: 'Camera' },
        { propertyPath: 'camera.distance', label: 'Camera Distance', type: 'number', default: 6, min: 0, max: 50, step: 0.1, group: 'Camera' },
        { propertyPath: 'camera.fov', label: 'Camera FOV', type: 'number', default: 45, min: 10, max: 170, step: 1, group: 'Camera' },
        { propertyPath: 'camera.targetX', label: 'Camera Target X', type: 'number', default: 0, min: -20, max: 20, step: 0.05, group: 'Camera' },
        { propertyPath: 'camera.targetY', label: 'Camera Target Y', type: 'number', default: 0, min: -20, max: 20, step: 0.05, group: 'Camera' },
        { propertyPath: 'camera.targetZ', label: 'Camera Target Z', type: 'number', default: 0, min: -20, max: 20, step: 0.05, group: 'Camera' },

        // Rotation (absolute)
        { propertyPath: 'rotationX', label: 'Rot X (deg)', type: 'number', default: 0, step: 0.5, group: 'Rotation' },
        { propertyPath: 'rotationY', label: 'Rot Y (deg)', type: 'number', default: 0, step: 0.5, group: 'Rotation' },
        { propertyPath: 'rotationZ', label: 'Rot Z (deg)', type: 'number', default: 0, step: 0.5, group: 'Rotation' },

        // Labels
        { propertyPath: 'labels.size', label: 'Label Size', type: 'number', default: 1, min: 0, max: 5, step: 0.01, group: 'Labels' },
        { propertyPath: 'labels.opacity', label: 'Label Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Labels' },
        { propertyPath: 'labels.pulseAmount', label: 'Label Pulse', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Labels' },
    ],
    wordcloud: [
        // Timing
        { propertyPath: 'beatThreshold', label: 'Beat Threshold', type: 'number', default: 0.07, min: 0, max: 1, step: 0.001, group: 'Word Swapping' },
        // Background
        { propertyPath: 'background.hue', label: 'BG Hue', type: 'number', default: 210, min: 0, max: 360, step: 1, group: 'Background' },
        { propertyPath: 'background.sat', label: 'BG Sat', type: 'number', default: 25, min: 0, max: 100, step: 1, group: 'Background' },
        { propertyPath: 'background.light', label: 'BG Light', type: 'number', default: 12, min: 0, max: 100, step: 1, group: 'Background' },

        // Cloud transform
        { propertyPath: 'cloud.scale', label: 'Cloud Scale', type: 'number', default: 1, min: 0, max: 10, step: 0.01, group: 'Cloud' },
        { propertyPath: 'cloud.rotationDeg', label: 'Cloud Rotation (deg)', type: 'number', default: 0, min: -180, max: 180, step: 0.5, group: 'Cloud' },
        { propertyPath: 'cloud.jitter', label: 'Jitter', type: 'number', default: 0, min: 0, max: 1, step: 0.01, group: 'Cloud' },

        // Word
        { propertyPath: 'word.scale', label: 'Word Scale', type: 'number', default: 1, min: 0, max: 10, step: 0.01, group: 'Word' },
        { propertyPath: 'word.opacity', label: 'Word Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Word' },
        { propertyPath: 'word.globalHueShift', label: 'Global Hue Shift', type: 'number', default: 0, min: -360, max: 360, step: 1, group: 'Word' },

        // Text color (base values applied on top of palette hue)
        { propertyPath: 'word.text.hue', label: 'Text Hue Offset', type: 'number', default: 0, min: -360, max: 360, step: 1, group: 'Text' },
        { propertyPath: 'word.text.sat', label: 'Text Sat', type: 'number', default: 80, min: 0, max: 100, step: 1, group: 'Text' },
        { propertyPath: 'word.text.light', label: 'Text Light', type: 'number', default: 60, min: 0, max: 100, step: 1, group: 'Text' },

        // Stroke
        { propertyPath: 'word.stroke.width', label: 'Stroke Width', type: 'number', default: 0, min: 0, max: 50, step: 0.5, group: 'Stroke' },
        { propertyPath: 'word.stroke.opacity', label: 'Stroke Opacity', type: 'number', default: 0, min: 0, max: 1, step: 0.01, group: 'Stroke' },
        { propertyPath: 'word.stroke.hue', label: 'Stroke Hue', type: 'number', default: 0, min: -360, max: 360, step: 1, group: 'Stroke' },
        { propertyPath: 'word.stroke.sat', label: 'Stroke Sat', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Stroke' },
        { propertyPath: 'word.stroke.light', label: 'Stroke Light', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Stroke' },

        // Shadow
        { propertyPath: 'word.shadow.blur', label: 'Shadow Blur', type: 'number', default: 0, min: 0, max: 200, step: 1, group: 'Shadow' },
        { propertyPath: 'word.shadow.opacity', label: 'Shadow Opacity', type: 'number', default: 0, min: 0, max: 1, step: 0.01, group: 'Shadow' },
        { propertyPath: 'word.shadow.hue', label: 'Shadow Hue', type: 'number', default: 0, min: -360, max: 360, step: 1, group: 'Shadow' },
        { propertyPath: 'word.shadow.sat', label: 'Shadow Sat', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Shadow' },
        { propertyPath: 'word.shadow.light', label: 'Shadow Light', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Shadow' },

        // Glow
        { propertyPath: 'word.glow.size', label: 'Glow Size', type: 'number', default: 0, min: 0, max: 300, step: 1, group: 'Glow' },
        { propertyPath: 'word.glow.opacity', label: 'Glow Opacity', type: 'number', default: 0, min: 0, max: 1, step: 0.01, group: 'Glow' },
        { propertyPath: 'word.glow.hue', label: 'Glow Hue', type: 'number', default: 0, min: -360, max: 360, step: 1, group: 'Glow' },
        { propertyPath: 'word.glow.sat', label: 'Glow Sat', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Glow' },
        { propertyPath: 'word.glow.light', label: 'Glow Light', type: 'number', default: 100, min: 0, max: 100, step: 1, group: 'Glow' },
    ],
    singleWord: [
        // Background
        { propertyPath: 'background.hue', label: 'BG Hue', type: 'number', default: 210, min: 0, max: 360, step: 1, group: 'Background' },
        { propertyPath: 'background.sat', label: 'BG Sat', type: 'number', default: 30, min: 0, max: 100, step: 1, group: 'Background' },
        { propertyPath: 'background.light', label: 'BG Light', type: 'number', default: 12, min: 0, max: 100, step: 1, group: 'Background' },
        { propertyPath: 'background.opacity', label: 'BG Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Background' },

        // Timing
        { propertyPath: 'beatThreshold', label: 'Beat Threshold', type: 'number', default: 0.07, min: 0, max: 1, step: 0.001, group: 'Timing' },

        // Word layout
        { propertyPath: 'word.scale', label: 'Word Scale', type: 'number', default: 1, min: 0, max: 10, step: 0.01, group: 'Word' },
        { propertyPath: 'word.opacity', label: 'Word Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Word' },
        { propertyPath: 'word.offsetX', label: 'Word Offset X', type: 'number', default: 0, min: -2000, max: 2000, step: 1, group: 'Word' },
        { propertyPath: 'word.offsetY', label: 'Word Offset Y', type: 'number', default: 0, min: -2000, max: 2000, step: 1, group: 'Word' },
        { propertyPath: 'word.nudge', label: 'Beat Nudge (px)', type: 'number', default: 0, min: -200, max: 200, step: 0.5, group: 'Word' },

        // Text color (HSL triplet so inspector color picker works)
        { propertyPath: 'word.text.hue', label: 'Text Hue', type: 'number', default: 0, min: 0, max: 360, step: 1, group: 'Text' },
        { propertyPath: 'word.text.sat', label: 'Text Sat', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Text' },
        { propertyPath: 'word.text.light', label: 'Text Light', type: 'number', default: 95, min: 0, max: 100, step: 1, group: 'Text' },

        // Stroke
        { propertyPath: 'word.stroke.width', label: 'Stroke Width', type: 'number', default: 0, min: 0, max: 50, step: 0.5, group: 'Stroke' },
        { propertyPath: 'word.stroke.opacity', label: 'Stroke Opacity', type: 'number', default: 0, min: 0, max: 1, step: 0.01, group: 'Stroke' },
        { propertyPath: 'word.stroke.hue', label: 'Stroke Hue', type: 'number', default: 0, min: 0, max: 360, step: 1, group: 'Stroke' },
        { propertyPath: 'word.stroke.sat', label: 'Stroke Sat', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Stroke' },
        { propertyPath: 'word.stroke.light', label: 'Stroke Light', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Stroke' },

        // Shadow
        { propertyPath: 'word.shadow.blur', label: 'Shadow Blur', type: 'number', default: 0, min: 0, max: 200, step: 1, group: 'Shadow' },
        { propertyPath: 'word.shadow.opacity', label: 'Shadow Opacity', type: 'number', default: 0, min: 0, max: 1, step: 0.01, group: 'Shadow' },
        { propertyPath: 'word.shadow.hue', label: 'Shadow Hue', type: 'number', default: 0, min: 0, max: 360, step: 1, group: 'Shadow' },
        { propertyPath: 'word.shadow.sat', label: 'Shadow Sat', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Shadow' },
        { propertyPath: 'word.shadow.light', label: 'Shadow Light', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Shadow' },

        // Glow
        { propertyPath: 'word.glow.size', label: 'Glow Size', type: 'number', default: 0, min: 0, max: 300, step: 1, group: 'Glow' },
        { propertyPath: 'word.glow.opacity', label: 'Glow Opacity', type: 'number', default: 0, min: 0, max: 1, step: 0.01, group: 'Glow' },
        { propertyPath: 'word.glow.hue', label: 'Glow Hue', type: 'number', default: 0, min: 0, max: 360, step: 1, group: 'Glow' },
        { propertyPath: 'word.glow.sat', label: 'Glow Sat', type: 'number', default: 0, min: 0, max: 100, step: 1, group: 'Glow' },
        { propertyPath: 'word.glow.light', label: 'Glow Light', type: 'number', default: 100, min: 0, max: 100, step: 1, group: 'Glow' },
    ],
    portraitMask: [
        // Fit
        { propertyPath: 'fit.scale', label: 'Fit Scale', type: 'number', default: 1, min: 0.2, max: 4, step: 0.01, group: 'Fit' },
        // Layout basics
        { propertyPath: 'layout.maxWords', label: 'Max Words', type: 'number', default: 120, min: 1, max: 1000, step: 1, group: 'Layout' },
        { propertyPath: 'layout.minSize', label: 'Min Size (px)', type: 'number', default: 12, min: 6, max: 200, step: 1, group: 'Layout' },
        { propertyPath: 'layout.maxSize', label: 'Max Size (px)', type: 'number', default: 64, min: 8, max: 400, step: 1, group: 'Layout' },
    ],
    // Alias for timeline type used by UI
    imageMaskFill: [
        // Scene transform (at top)
        { propertyPath: 'scene.scale', label: 'Scene Scale (Zoom)', type: 'number', default: 1, min: 0.1, max: 10, step: 0.01, group: 'A_Scene' },

        // Background (solid color layer over image)
        { propertyPath: 'background.hue', label: 'BG Hue', type: 'number', default: 210, min: 0, max: 360, step: 1, group: 'Background' },
        { propertyPath: 'background.sat', label: 'BG Sat', type: 'number', default: 30, min: 0, max: 100, step: 1, group: 'Background' },
        { propertyPath: 'background.light', label: 'BG Light', type: 'number', default: 12, min: 0, max: 100, step: 1, group: 'Background' },
        { propertyPath: 'background.opacity', label: 'BG Opacity', type: 'number', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Background' },

        // Image layer
        { propertyPath: 'image.opacity', label: 'Image Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Image' },
        { propertyPath: 'image.desaturation', label: 'Image Desaturation', type: 'number', default: 0, min: 0, max: 1, step: 0.01, group: 'Image' },

        // Mask morphing
        { propertyPath: 'mask.thresholdOverride', label: 'Mask Threshold (anim)', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01, group: 'Mask' },
        
        // Layout
        { propertyPath: 'layout.maxWords', label: 'Max Words', type: 'number', default: 120, min: 1, max: 1000, step: 1, group: 'Layout' },
        { propertyPath: 'layout.minSize', label: 'Min Size (px)', type: 'number', default: 12, min: 6, max: 200, step: 1, group: 'Layout' },
        { propertyPath: 'layout.maxSize', label: 'Max Size (px)', type: 'number', default: 64, min: 8, max: 400, step: 1, group: 'Layout' },

        // Word swapping
        { propertyPath: 'beatThreshold', label: 'Beat Threshold', type: 'number', default: 0.07, min: 0, max: 1, step: 0.001, group: 'Word Swapping' },

        // Words
        { propertyPath: 'word.scale', label: 'Word Scale', type: 'number', default: 1, min: 0, max: 5, step: 0.01, group: 'Word' },
        { propertyPath: 'word.opacity', label: 'Word Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.01, group: 'Word' },
    ],
};


