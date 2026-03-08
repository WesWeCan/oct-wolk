export type InterpolationType =
    | 'step'
    | 'linear'
    | 'easeIn'
    | 'easeOut'
    | 'easeInOut'
    | {
        type: 'cubic';
        in: [number, number];
        out: [number, number];
    };

export interface Keyframe<T = any> {
    frame: number;
    value: T;
    interpolation?: InterpolationType;
}

export interface PropertyTrack<T = any> {
    propertyPath: string;
    keyframes: Keyframe<T>[];
    enabled?: boolean;
}
