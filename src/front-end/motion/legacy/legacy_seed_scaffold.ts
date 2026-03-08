import {
    createMulberry32,
    deriveSeed,
    hashStringToUint32,
    type SeedRng,
} from '@/front-end/utils/seededRng';

/**
 * LEGACY SCAFFOLD: deterministic randomness for future motion modules.
 *
 * Why this file exists:
 * - The old scene editor had useful deterministic randomness patterns.
 * - The new motion-block system should be able to opt into those patterns.
 * - This file intentionally does NOT make deterministic randomness the global runtime.
 *
 * Current status:
 * - Safe to import from new motion code.
 * - Safe for AI to extend.
 * - Not yet used by any advanced motion block implementation.
 *
 * Non-goals:
 * - Do not recreate scene-level runtime behavior here.
 * - Do not store old scene state here.
 * - Do not make block rendering depend on worker-only APIs.
 *
 * Future integration idea:
 * - A motion block can ask for a scoped RNG using its block id, track id,
 *   source item id, or a richer module-specific scope key.
 */

export interface LegacyDeterministicRandomness {
    baseSeed: string;
    baseSeedHash: number;
    scopeKey: string;
    createRng: (subScope?: string) => SeedRng;
    pickNumber: (subScope?: string) => number;
}

const joinScope = (scopeKey: string, subScope?: string): string => {
    return subScope && subScope.trim().length > 0
        ? `${scopeKey}:${subScope}`
        : scopeKey;
};

export const createLegacyDeterministicRandomness = (
    baseSeed: string,
    scopeKey: string,
): LegacyDeterministicRandomness => {
    const normalizedSeed = String(baseSeed || 'wolk-default');
    const normalizedScope = String(scopeKey || 'motion');
    const baseSeedHash = hashStringToUint32(normalizedSeed);

    return {
        baseSeed: normalizedSeed,
        baseSeedHash,
        scopeKey: normalizedScope,
        createRng: (subScope?: string) => {
            const scopedSeed = deriveSeed(baseSeedHash, joinScope(normalizedScope, subScope));
            return createMulberry32(scopedSeed);
        },
        pickNumber: (subScope?: string) => {
            const rng = createMulberry32(deriveSeed(baseSeedHash, joinScope(normalizedScope, subScope)));
            return rng();
        },
    };
};
