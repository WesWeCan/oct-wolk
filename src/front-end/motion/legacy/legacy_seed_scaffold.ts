import {
    createDeterministicRandomness,
    type DeterministicRandomness,
} from '@/front-end/motion/deterministicRandomness';

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

export type LegacyDeterministicRandomness = DeterministicRandomness;

export const createLegacyDeterministicRandomness = (
    baseSeed: string,
    scopeKey: string,
): LegacyDeterministicRandomness => {
    return createDeterministicRandomness(baseSeed, scopeKey);
};
