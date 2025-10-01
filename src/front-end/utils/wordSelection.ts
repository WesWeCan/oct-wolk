import type { WordGroup } from '@/types/song_types';

export interface UiNode { name: string; words: string[]; groups: UiNode[] }

export function flattenWordsFromGroups(groups: WordGroup[]): string[] {
    const out: string[] = [];
    const visit = (g: WordGroup) => {
        if (Array.isArray(g.words)) out.push(...g.words.map(w => String(w)));
        if (Array.isArray(g.groups)) g.groups.forEach(visit);
    };
    (groups || []).forEach(visit);
    return Array.from(new Set(out));
}

export function toUiTree(groups: WordGroup[]): UiNode[] {
    const recur = (g: WordGroup): UiNode => ({ name: String(g.name || ''), words: (g.words || []).map(w => String(w)), groups: (g.groups || []).map(recur) });
    return (groups || []).map(recur);
}

export function collectUiWords(node: UiNode): string[] {
    const out: string[] = [...node.words];
    node.groups.forEach(n => out.push(...collectUiWords(n)));
    return out;
}

export function computeGroupState(node: UiNode, selected: Set<string>): 'checked' | 'indeterminate' | 'unchecked' {
    const words = collectUiWords(node);
    if (!words.length) return 'unchecked';
    let count = 0;
    for (const w of words) if (selected.has(w)) count++;
    if (count === 0) return 'unchecked';
    if (count === words.length) return 'checked';
    return 'indeterminate';
}


