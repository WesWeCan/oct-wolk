/**
 * LEGACY SCAFFOLD: normalized audio-reactive modulation payload for future
 * motion modules.
 *
 * Why this file exists:
 * - The old scene editor exposed beat, energy, and spectral-band data to the
 *   runtime in a deterministic per-frame shape.
 * - The new motion-block system should be able to reuse that idea without
 *   reviving old scene concepts like word pools or wordOverride.
 *
 * Current status:
 * - This file only defines a normalized frame payload plus a builder helper.
 * - Subtitle rendering can ignore it safely.
 * - Future motion modules can consume it incrementally.
 *
 * Non-goals:
 * - Do not encode scene-specific action tracks here.
 * - Do not depend on legacy timeline documents here.
 * - Do not assume every block is audio-reactive.
 */

export interface LegacyAudioModulationFrame {
    frame: number;
    fps: number;
    timeSec: number;
    beat: number;
    energy: number;
    lowBand: number;
    midBand: number;
    highBand: number;
    beatMarkerActive: boolean;
}

export interface LegacyAudioModulationInput {
    frame: number;
    fps: number;
    energyPerFrame?: number[];
    beatStrengthPerFrame?: number[];
    bandsLowPerFrame?: number[];
    bandsMidPerFrame?: number[];
    bandsHighPerFrame?: number[];
    beatTimesSec?: number[];
}

const sampleArray = (values: number[] | undefined, index: number): number => {
    if (!Array.isArray(values) || values.length === 0) return 0;
    if (index < 0 || index >= values.length) return 0;
    const value = Number(values[index]);
    return Number.isFinite(value) ? value : 0;
};

export const buildLegacyAudioModulationFrame = (
    input: LegacyAudioModulationInput,
): LegacyAudioModulationFrame => {
    const frame = Math.max(0, Math.round(input.frame || 0));
    const fps = Math.max(1, Math.round(input.fps || 60));
    const timeSec = frame / fps;
    const beat = sampleArray(input.beatStrengthPerFrame, frame);
    const energy = sampleArray(input.energyPerFrame, frame);
    const lowBand = sampleArray(input.bandsLowPerFrame, frame);
    const midBand = sampleArray(input.bandsMidPerFrame, frame);
    const highBand = sampleArray(input.bandsHighPerFrame, frame);
    const beatMarkerActive = Array.isArray(input.beatTimesSec)
        ? input.beatTimesSec.some((beatTime) => Math.abs(Number(beatTime) - timeSec) <= (0.5 / fps))
        : false;

    return {
        frame,
        fps,
        timeSec,
        beat,
        energy,
        lowBand,
        midBand,
        highBand,
        beatMarkerActive,
    };
};
