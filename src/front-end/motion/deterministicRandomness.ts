import {
    createMulberry32,
    deriveSeed,
    hashStringToUint32,
    type SeedRng,
} from '@/front-end/utils/seededRng';

export interface DeterministicRandomness {
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

export const createDeterministicRandomness = (
    baseSeed: string,
    scopeKey: string,
): DeterministicRandomness => {
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
