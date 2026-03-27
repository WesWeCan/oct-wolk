import {
    DEFAULT_SCENE3D_GLOBAL_LIGHTING,
    DEFAULT_SCENE3D_SETTINGS,
    type Scene3DGlobalLighting,
    type Scene3DSettings,
} from '@/types/project_types';

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
};

const normalizeColor = (value: unknown, fallback: string): string => {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};

export const normalizeScene3DGlobalLighting = (value: Partial<Scene3DGlobalLighting> | null | undefined): Scene3DGlobalLighting => {
    const raw = value || {};

    return {
        ambientColor: normalizeColor(raw.ambientColor, DEFAULT_SCENE3D_GLOBAL_LIGHTING.ambientColor),
        ambientIntensity: clamp(raw.ambientIntensity, 0, 10, DEFAULT_SCENE3D_GLOBAL_LIGHTING.ambientIntensity),
        directionalColor: normalizeColor(raw.directionalColor, DEFAULT_SCENE3D_GLOBAL_LIGHTING.directionalColor),
        directionalIntensity: clamp(raw.directionalIntensity, 0, 20, DEFAULT_SCENE3D_GLOBAL_LIGHTING.directionalIntensity),
        directionalAzimuth: clamp(raw.directionalAzimuth, -180, 180, DEFAULT_SCENE3D_GLOBAL_LIGHTING.directionalAzimuth),
        directionalElevation: clamp(raw.directionalElevation, -89, 89, DEFAULT_SCENE3D_GLOBAL_LIGHTING.directionalElevation),
    };
};

export const normalizeScene3DSettings = (value: Partial<Scene3DSettings> | null | undefined): Scene3DSettings => {
    const raw = value || {};

    return {
        enabled: raw.enabled === true,
        globalLighting: normalizeScene3DGlobalLighting(raw.globalLighting),
    };
};

export const createDefaultScene3DSettings = (): Scene3DSettings => ({
    ...DEFAULT_SCENE3D_SETTINGS,
    globalLighting: { ...DEFAULT_SCENE3D_SETTINGS.globalLighting },
});
