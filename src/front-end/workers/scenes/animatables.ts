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
};


