export interface ProjectSettings {
    version: number;
    fps: number;
    renderWidth: number;
    renderHeight: number;
    seed: string;
    fontFamily?: string;
    fontFallbacks?: string[];
}

export type SceneType = 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord';

export interface SceneRef {
    id: string;
    type: SceneType;
    name: string;
    startFrame: number;
    durationFrames: number;
    transitionInFrames?: number;
    transitionOutFrames?: number;
}

export interface TimelineDocument {
    settings: ProjectSettings;
    scenes: SceneRef[];
    globalOpacityTrack?: PropertyTrack<number>;
}

export type InterpolationType = 'step' | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | {
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
}

export interface SceneDocumentBase {
    id: string;
    type: SceneType | string;
    name: string;
    seed?: string;
    tracks: PropertyTrack[];
    params: Record<string, any>;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
    version: 1,
    fps: 60,
    renderWidth: 1920,
    renderHeight: 1080,
    seed: 'wolk-default',
    fontFamily: 'system-ui',
    fontFallbacks: ['-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
};


