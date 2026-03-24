export interface CloudLayoutParams {
    targetCoverage: number;
    minFontScale: number;
    maxFontScale: number;
    boxGap: number;
    rowGap: number;
    staggerStrength: number;
}

export const DEFAULT_CLOUD_LAYOUT_PARAMS: CloudLayoutParams = {
    targetCoverage: 0.8,
    minFontScale: 0.4,
    maxFontScale: 3.5,
    boxGap: 8,
    rowGap: 10,
    staggerStrength: 0.25,
};

const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

export const resolveCloudLayoutParams = (params: Record<string, any> | null | undefined): CloudLayoutParams => {
    const raw = params || {};

    const minFontScale = clamp(
        Number.isFinite(Number(raw.minFontScale)) ? Number(raw.minFontScale) : DEFAULT_CLOUD_LAYOUT_PARAMS.minFontScale,
        0.1,
        10,
    );
    const maxFontScale = clamp(
        Number.isFinite(Number(raw.maxFontScale)) ? Number(raw.maxFontScale) : DEFAULT_CLOUD_LAYOUT_PARAMS.maxFontScale,
        minFontScale,
        10,
    );

    return {
        targetCoverage: clamp(
            Number.isFinite(Number(raw.targetCoverage)) ? Number(raw.targetCoverage) : DEFAULT_CLOUD_LAYOUT_PARAMS.targetCoverage,
            0.05,
            0.98,
        ),
        minFontScale,
        maxFontScale,
        boxGap: clamp(
            Number.isFinite(Number(raw.boxGap)) ? Number(raw.boxGap) : DEFAULT_CLOUD_LAYOUT_PARAMS.boxGap,
            0,
            200,
        ),
        rowGap: clamp(
            Number.isFinite(Number(raw.rowGap)) ? Number(raw.rowGap) : DEFAULT_CLOUD_LAYOUT_PARAMS.rowGap,
            0,
            200,
        ),
        staggerStrength: clamp(
            Number.isFinite(Number(raw.staggerStrength)) ? Number(raw.staggerStrength) : DEFAULT_CLOUD_LAYOUT_PARAMS.staggerStrength,
            0,
            1,
        ),
    };
};
