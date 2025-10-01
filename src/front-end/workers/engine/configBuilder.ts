import type { SceneRef, SceneDocumentBase } from '@/types/timeline_types';

export interface MixParams { a: { type: string; params: Record<string, any> } | null; b?: { type: string; params: Record<string, any> } | null; fontFamilyChain: string; seed: string }

export function buildMixConfig(seed: string, fontFamilyChain: string, a: SceneRef | null, b: SceneRef | null, docs: Record<string, SceneDocumentBase | undefined>, wordsA: string[], wordsB: string[]): MixParams {
    const getParams = (id: string | null | undefined, type: string | null | undefined, words: string[]) => {
        if (!id || !type) return null;
        const base = (id && docs[id]) ? (docs[id] as any).params || {} : {};
        return { type, params: { ...base, words, fontFamilyChain } };
    };
    const A = a ? getParams(a.id, a.type, wordsA) : null;
    const B = b ? getParams(b.id, b.type, wordsB) : null;
    return { a: A, b: B || undefined, fontFamilyChain, seed };
}


