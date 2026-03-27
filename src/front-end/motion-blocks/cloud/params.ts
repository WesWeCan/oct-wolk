import {
    DEFAULT_TEXT_REVEAL_PARAMS,
    resolveTextRevealParams,
    type TextRevealMode,
    type TextRevealParams,
} from '@/front-end/utils/motion/textReveal';

export type CloudExitMode = 'stay' | 'perItem';

export interface CloudLayoutParams extends TextRevealParams {
    gap: number;
    scatter: number;
    sizeVariation: number;
    exitMode: CloudExitMode;
    exitDelayMs: number;
}

export const DEFAULT_CLOUD_LAYOUT_PARAMS: CloudLayoutParams = {
    gap: 12,
    scatter: 0.7,
    sizeVariation: 0.3,
    exitMode: 'stay',
    exitDelayMs: 0,
    ...DEFAULT_TEXT_REVEAL_PARAMS,
};

const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

const isValidExitMode = (value: unknown): value is CloudExitMode =>
    value === 'stay' || value === 'perItem';

export const resolveCloudLayoutParams = (params: Record<string, any> | null | undefined): CloudLayoutParams => {
    const raw = params || {};
    const revealParams = resolveTextRevealParams(raw);

    return {
        gap: clamp(
            Number.isFinite(Number(raw.gap)) ? Number(raw.gap) : DEFAULT_CLOUD_LAYOUT_PARAMS.gap,
            0,
            200,
        ),
        scatter: clamp(
            Number.isFinite(Number(raw.scatter)) ? Number(raw.scatter) : DEFAULT_CLOUD_LAYOUT_PARAMS.scatter,
            0,
            1,
        ),
        sizeVariation: clamp(
            Number.isFinite(Number(raw.sizeVariation)) ? Number(raw.sizeVariation) : DEFAULT_CLOUD_LAYOUT_PARAMS.sizeVariation,
            0,
            0.7,
        ),
        exitMode: isValidExitMode(raw.exitMode) ? raw.exitMode : DEFAULT_CLOUD_LAYOUT_PARAMS.exitMode,
        exitDelayMs: clamp(
            Number.isFinite(Number(raw.exitDelayMs)) ? Number(raw.exitDelayMs) : DEFAULT_CLOUD_LAYOUT_PARAMS.exitDelayMs,
            0,
            60_000,
        ),
        ...revealParams,
    };
};
