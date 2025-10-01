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
}

export const SCENE_ANIMATABLES: Record<string, AnimatablePropertyMeta[]> = {
    model3d: [
        { propertyPath: 'model.scale', label: 'Scale', type: 'number', default: 10, min: 0.001, max: 100, step: 0.1, paramKey: 'modelScale' },
        { propertyPath: 'model.rotationRPM', label: 'Rotation RPM', type: 'number', default: 3, min: -120, max: 120, step: 0.1, paramKey: 'rotationRpm' },
        { propertyPath: 'labels.radiusMultiplier', label: 'Label Radius', type: 'number', default: 0.5, min: -2, max: 5, step: 0.01 },
    ],
};


