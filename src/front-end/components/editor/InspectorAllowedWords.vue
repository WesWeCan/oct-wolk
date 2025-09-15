<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PropertyTrack, Keyframe } from '@/types/timeline_types';
import type { WordGroup } from '@/types/song_types';

type Track = PropertyTrack<string[]>;

// NOTE: This component currently edits per-scene allowed words. We're migrating to a
//       global timeline word pool. To support both during the transition, this emits
//       either scene track updates or global track updates based on props.
const props = defineProps<{
    wordBank: string[];
    wordGroups: WordGroup[];
    allowedTrack: Track | null | undefined; // legacy per-scene track
    currentFrame: number;
    useGlobal?: boolean; // if true, emit global track updates
}>();
const emit = defineEmits<{ (e: 'update:track', value: Track): void; (e: 'update:globalTrack', value: Track): void }>();

const search = ref('');

const allDescendantWords = (groups: WordGroup[]): string[] => {
    const out: string[] = [];
    const visit = (g: WordGroup) => {
        if (Array.isArray(g.words)) out.push(...g.words.map(w => String(w)));
        if (Array.isArray(g.groups)) g.groups.forEach(visit);
    };
    (groups || []).forEach(visit);
    return Array.from(new Set(out));
};

const groupToWordSet = computed<Set<string>>(() => new Set(allDescendantWords(props.wordGroups || [])));

// Resolve current selection at frame (step behavior). Defaults to entire bank if no keyframes
const sortedKeyframes = computed<Keyframe<string[]>[]>(() => Array.isArray(props.allowedTrack?.keyframes) ? props.allowedTrack!.keyframes.slice().sort((a, b) => (a.frame|0) - (b.frame|0)) : []);
const selectionAtFrame = computed<string[]>(() => {
    const kf = sortedKeyframes.value;
    if (!kf.length) return (props.wordBank || []).map(w => String(w));
    let last = kf[0];
    for (const k of kf) { if ((k.frame|0) <= (props.currentFrame|0)) last = k; else break; }
    const arr = Array.isArray((last as any).value) ? (last as any).value : [];
    return arr.map((w: any) => String(w));
});

// Group coverage
const bankSet = computed<Set<string>>(() => new Set((props.wordBank || []).map(w => String(w))));
const groupSet = groupToWordSet;
// Selected but not part of any group (even if in bank)
const ungroupedSelected = computed<string[]>(() => selectionAtFrame.value.filter(w => !groupSet.value.has(w)));
// Bank words that are not part of any group (toggleable list)
const ungroupedBankWords = computed<string[]>(() => (props.wordBank || []).map(w=>String(w)).filter(w => !groupSet.value.has(w)));

// Tri-state for groups
interface UiNode { name: string; words: string[]; groups: UiNode[] }
const buildUiTree = (groups: WordGroup[]): UiNode[] => {
    return (groups || []).map(g => ({ name: String(g.name||''), words: Array.isArray(g.words)? g.words.map(w=>String(w)) : [], groups: buildUiTree(Array.isArray(g.groups)?g.groups:[]) }));
};
const uiTree = computed<UiNode[]>(() => buildUiTree(props.wordGroups || []));

const filterTree = (nodes: UiNode[], term: string): UiNode[] => {
    if (!term) return nodes;
    const t = term.toLowerCase();
    const pass = (n: UiNode): UiNode | null => {
        const wordHit = n.words.some(w => w.toLowerCase().includes(t));
        const nameHit = n.name.toLowerCase().includes(t);
        const kids = n.groups.map(pass).filter(Boolean) as UiNode[];
        if (nameHit || wordHit || kids.length) return { name: n.name, words: n.words.filter(w => w.toLowerCase().includes(t)), groups: kids };
        return null;
    };
    return nodes.map(pass).filter(Boolean) as UiNode[];
};

const isChecked = (word: string) => effectiveSelection.value.includes(word);
const toggleWord = (word: string) => {
    const current = new Set(selectionAtFrame.value);
    if (current.has(word)) current.delete(word); else current.add(word);
    const frame = Math.max(0, props.currentFrame | 0);
    const path = props.useGlobal ? 'timeline.words.pool' : 'words.allowed';
    const existing = Array.isArray(props.allowedTrack?.keyframes) ? props.allowedTrack!.keyframes.slice() : [];
    const idx = existing.findIndex(k => (k.frame | 0) === frame);
    const next = Array.from(current);
    if (idx >= 0) existing[idx] = { frame, value: next } as any; else existing.push({ frame, value: next } as any);
    existing.sort((a, b) => (a.frame | 0) - (b.frame | 0));
    const payload = { propertyPath: path, keyframes: existing } as any;
    if (props.useGlobal) emit('update:globalTrack', payload); else emit('update:track', payload);
    draftSelection.value = null;
};

// Draft selection to stage changes before keyframe commit
const draftSelection = ref<string[] | null>(null);
const effectiveSelection = computed<string[]>(() => Array.isArray(draftSelection.value) ? draftSelection.value : selectionAtFrame.value);

const groupWords = (n: UiNode): string[] => {
    const out: string[] = [...n.words];
    n.groups.forEach(g => out.push(...groupWords(g)));
    return out;
};
const groupState = (n: UiNode): 'checked' | 'indeterminate' | 'unchecked' => {
    const words = groupWords(n);
    if (!words.length) return 'unchecked';
    const sel = new Set(effectiveSelection.value);
    let c = 0;
    for (const w of words) if (sel.has(w)) c++;
    if (c === 0) return 'unchecked';
    if (c === words.length) return 'checked';
    return 'indeterminate';
};
const toggleGroup = (n: UiNode) => {
    const words = groupWords(n);
    const sel = new Set(effectiveSelection.value);
    const state = groupState(n);
    if (state === 'checked' || state === 'indeterminate') {
        words.forEach(w => sel.delete(w));
    } else {
        words.forEach(w => sel.add(w));
    }
    const next = Array.from(sel);
    const frame = Math.max(0, props.currentFrame | 0);
    const path = props.useGlobal ? 'timeline.words.pool' : 'words.allowed';
    const existing = Array.isArray(props.allowedTrack?.keyframes) ? props.allowedTrack!.keyframes.slice() : [];
    const idx = existing.findIndex(k => (k.frame | 0) === frame);
    if (idx >= 0) existing[idx] = { frame, value: next } as any; else existing.push({ frame, value: next } as any);
    existing.sort((a, b) => (a.frame | 0) - (b.frame | 0));
    const payload = { propertyPath: path, keyframes: existing } as any;
    if (props.useGlobal) emit('update:globalTrack', payload); else emit('update:track', payload);
    draftSelection.value = null;
};

const commitKeyframe = (mode: 'addOrUpdate' | 'copyLast') => {
    const path = props.useGlobal ? 'timeline.words.pool' : 'words.allowed';
    const existing = Array.isArray(props.allowedTrack?.keyframes) ? props.allowedTrack!.keyframes.slice() : [];
    let newVal: string[];
    if (mode === 'copyLast') {
        const kf = sortedKeyframes.value;
        const last = kf.length ? kf[kf.length - 1] : null;
        newVal = Array.isArray(last?.value) ? (last!.value as any).map((w: any) => String(w)) : (props.wordBank || []).map(w=>String(w));
    } else {
        newVal = effectiveSelection.value.slice();
    }
    const frame = Math.max(0, props.currentFrame | 0);
    const idx = existing.findIndex(k => (k.frame|0) === frame);
    if (idx >= 0) existing[idx] = { frame, value: newVal } as any; else existing.push({ frame, value: newVal } as any);
    existing.sort((a, b) => (a.frame|0) - (b.frame|0));
    emit('update:track', { propertyPath: path, keyframes: existing } as any);
    draftSelection.value = null;
};

const deleteKeyframe = (i: number) => {
    const path = props.useGlobal ? 'timeline.words.pool' : 'words.allowed';
    const existing = Array.isArray(props.allowedTrack?.keyframes) ? props.allowedTrack!.keyframes.slice() : [];
    if (i >= 0 && i < existing.length) existing.splice(i, 1);
    const payload = { propertyPath: path, keyframes: existing } as any;
    if (props.useGlobal) emit('update:globalTrack', payload); else emit('update:track', payload);
};

// Helper: commit an explicit selection at current frame
const commitSelectionAtFrame = (words: string[]) => {
    const frame = Math.max(0, props.currentFrame | 0);
    const path = props.useGlobal ? 'timeline.words.pool' : 'words.allowed';
    const existing = Array.isArray(props.allowedTrack?.keyframes) ? props.allowedTrack!.keyframes.slice() : [];
    const idx = existing.findIndex(k => (k.frame | 0) === frame);
    const normalized = (words || []).map(w => String(w));
    if (idx >= 0) existing[idx] = { frame, value: normalized } as any; else existing.push({ frame, value: normalized } as any);
    existing.sort((a, b) => (a.frame | 0) - (b.frame | 0));
    const payload = { propertyPath: path, keyframes: existing } as any;
    if (props.useGlobal) emit('update:globalTrack', payload); else emit('update:track', payload);
    draftSelection.value = null;
};

const deselectAllUngrouped = () => {
    const sel = new Set(selectionAtFrame.value);
    for (const w of ungroupedBankWords.value) sel.delete(w);
    commitSelectionAtFrame(Array.from(sel));
};

const filteredTree = computed(() => filterTree(uiTree.value, search.value.trim()));

// Keep inspector view in sync with current keyframe/track changes
watch(() => props.currentFrame, () => { draftSelection.value = null; });
watch(() => (props.allowedTrack && Array.isArray((props.allowedTrack as any).keyframes) ? (props.allowedTrack as any).keyframes.length : 0), () => { draftSelection.value = null; });

</script>
<template>
    <div>
        <div v-if="!sortedKeyframes.length" style="margin-bottom:6px; font-size:12px; opacity:0.8;">Using entire word bank (no keyframes).</div>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
            <input type="text" v-model="search" placeholder="Search…" />
            <button @click="() => commitKeyframe('addOrUpdate')">Add/Update keyframe @ {{ currentFrame }}</button>
            <button @click="() => commitKeyframe('copyLast')" :disabled="!sortedKeyframes.length">Copy last list @ {{ currentFrame }}</button>
        </div>
        <div style="display:flex; gap:16px;">
            <div style="flex:1 1 auto; max-height:300px; overflow:auto; border:1px solid #333; padding:6px;">
                <div v-for="g in filteredTree" :key="g.name" style="margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" :checked="groupState(g)==='checked'" :indeterminate.prop="groupState(g)==='indeterminate'" @change="() => toggleGroup(g)" />
                        <span style="font-weight:600;">{{ g.name }}</span>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 8px 20px;">
                        <label v-for="w in g.words" :key="w" style="display:flex; align-items:center; gap:4px; border:1px solid #444; padding:2px 6px; border-radius:3px;">
                            <input type="checkbox" :checked="isChecked(w)" @change="() => toggleWord(w)" />
                            <span>{{ w }}</span>
                        </label>
                    </div>
                    <div v-if="g.groups.length" style="margin-left:16px;">
                        <div v-for="c in g.groups" :key="g.name + '/' + c.name" style="margin-bottom:6px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <input type="checkbox" :checked="groupState(c)==='checked'" :indeterminate.prop="groupState(c)==='indeterminate'" @change="() => toggleGroup(c)" />
                                <span>{{ c.name }}</span>
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 8px 20px;">
                                <label v-for="w in c.words" :key="w" style="display:flex; align-items:center; gap:4px; border:1px solid #444; padding:2px 6px; border-radius:3px;">
                                    <input type="checkbox" :checked="isChecked(w)" @change="() => toggleWord(w)" />
                                    <span>{{ w }}</span>
                                </label>
                            </div>
                            <div v-if="c.groups.length" style="margin-left:16px;">
                                <div v-for="cc in c.groups" :key="g.name + '/' + c.name + '/' + cc.name" style="margin-bottom:6px;">
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <input type="checkbox" :checked="groupState(cc)==='checked'" :indeterminate.prop="groupState(cc)==='indeterminate'" @change="() => toggleGroup(cc)" />
                                        <span>{{ cc.name }}</span>
                                    </div>
                                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 8px 20px;">
                                        <label v-for="w in cc.words" :key="w" style="display:flex; align-items:center; gap:4px; border:1px solid #444; padding:2px 6px; border-radius:3px;">
                                            <input type="checkbox" :checked="isChecked(w)" @change="() => toggleWord(w)" />
                                            <span>{{ w }}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-if="ungroupedBankWords.length" style="margin-top:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="font-weight:600;">Ungrouped</div>
                        <button @click="deselectAllUngrouped">Deselect all</button>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
                        <label v-for="w in ungroupedBankWords" :key="'__ungroup__'+w" style="display:flex; align-items:center; gap:4px; border:1px solid #444; padding:2px 6px; border-radius:3px;">
                            <input type="checkbox" :checked="isChecked(w)" @change="() => toggleWord(w)" />
                            <span>{{ w }}</span>
                        </label>
                    </div>
                </div>
                <div v-if="ungroupedSelected.length && !ungroupedBankWords.length" style="margin-top:8px;">
                    <div style="font-weight:600; color:#eaa;">Ungrouped (selected)</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
                        <label v-for="w in ungroupedSelected" :key="'__sel_ungroup__'+w" style="display:flex; align-items:center; gap:4px; border:1px dashed #844; padding:2px 6px; border-radius:3px;">
                            <input type="checkbox" :checked="isChecked(w)" @change="() => toggleWord(w)" />
                            <span>{{ w }}</span>
                        </label>
                    </div>
                </div>
            </div>
            <div style="width:220px;">
                <div style="font-weight:600; margin-bottom:6px;">Keyframes</div>
                <div v-for="(k,i) in sortedKeyframes" :key="i" style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:6px;">
                    <div>#{{ i+1 }} @ {{ k.frame }}</div>
                    <div style="opacity:0.7; font-size:12px;">{{ Array.isArray(k.value)? k.value.length : 0 }} words</div>
                    <button title="Delete" @click="() => deleteKeyframe(i)">×</button>
                </div>
                <div v-if="!sortedKeyframes.length" style="opacity:0.8; font-size:12px;">No keyframes</div>
            </div>
        </div>
    </div>
</template>

