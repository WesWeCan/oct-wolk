<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { TimelineDocument, SceneRef } from '@/types/timeline_types';
import { FontsService } from '@/front-end/services/FontsService';

interface SystemFontFile { familyGuess: string; filePath: string; fileName: string; }

const props = defineProps<{ timeline: TimelineDocument | null; selectedScene: SceneRef | null; sceneParams?: Record<string, any> | null; overlayOpts?: { showEnergy: boolean; showOnsets: boolean; showBeats?: boolean } }>();
const emit = defineEmits<{ (e: 'update:timeline', value: TimelineDocument): void; (e: 'update:scene', value: SceneRef): void; (e: 'update:sceneParams', value: Record<string, any>): void; (e: 'update:overlayOpts', value: { showEnergy: boolean; showOnsets: boolean; showBeats?: boolean }): void; (e: 'resetProject'): void; (e: 'importWolk'): void }>();

const updateSeed = (e: Event) => {
    if (!props.timeline) return;
    const v = (e.target as HTMLInputElement).value;
    const updated = { ...props.timeline, settings: { ...props.timeline.settings, seed: v } };
    emit('update:timeline', updated);
};

const updateSceneName = (e: Event) => {
    if (!props.selectedScene) return;
    const v = (e.target as HTMLInputElement).value;
    emit('update:scene', { ...props.selectedScene, name: v });
};

// Fonts
const allFonts = ref<SystemFontFile[]>([]);
const query = ref('');
const filteredFonts = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return allFonts.value.slice(0, 250);
    return allFonts.value.filter(f => f.familyGuess.toLowerCase().includes(q) || f.fileName.toLowerCase().includes(q)).slice(0, 250);
});

const primaryFont = computed(() => props.timeline?.settings.fontFamily || 'system-ui');
const fallbacks = computed(() => props.timeline?.settings.fontFallbacks || []);

const setPrimaryFont = (family: string) => {
    if (!props.timeline) return;
    const updated = { ...props.timeline, settings: { ...props.timeline.settings, fontFamily: family } } as TimelineDocument;
    emit('update:timeline', updated);
};

const addFallback = (family: string) => {
    if (!props.timeline) return;
    const current = Array.isArray(props.timeline.settings.fontFallbacks) ? props.timeline.settings.fontFallbacks.slice() : [];
    if (!current.includes(family)) current.push(family);
    const updated = { ...props.timeline, settings: { ...props.timeline.settings, fontFallbacks: current } } as TimelineDocument;
    emit('update:timeline', updated);
};

const removeFallback = (idx: number) => {
    if (!props.timeline) return;
    const current = Array.isArray(props.timeline.settings.fontFallbacks) ? props.timeline.settings.fontFallbacks.slice() : [];
    if (idx >= 0 && idx < current.length) current.splice(idx, 1);
    const updated = { ...props.timeline, settings: { ...props.timeline.settings, fontFallbacks: current } } as TimelineDocument;
    emit('update:timeline', updated);
};

const moveFallback = (idx: number, dir: -1 | 1) => {
    if (!props.timeline) return;
    const current = Array.isArray(props.timeline.settings.fontFallbacks) ? props.timeline.settings.fontFallbacks.slice() : [];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= current.length) return;
    const tmp = current[idx];
    current[idx] = current[newIdx];
    current[newIdx] = tmp;
    const updated = { ...props.timeline, settings: { ...props.timeline.settings, fontFallbacks: current } } as TimelineDocument;
    emit('update:timeline', updated);
};

const fontFamilyChain = computed(() => {
    const names = [primaryFont.value, ...fallbacks.value];
    const quote = (s: string) => /[^a-zA-Z0-9-]/.test(s) ? '"' + s.replace(/"/g, '\\"') + '"' : s;
    return names.filter(Boolean).map(quote).join(', ');
});

onMounted(async () => {
    try {
        const list = await FontsService.list();
        allFonts.value = Array.isArray(list) ? list as any : [];
    } catch {}
});

const updateExportFps = (e: Event) => {
    if (!props.timeline) return;
    const v = Math.max(1, Number((e.target as HTMLInputElement).value) | 0);
    emit('update:timeline', { ...props.timeline, settings: { ...props.timeline.settings, fps: v } } as any);
};
const updateExportWidth = (e: Event) => {
    if (!props.timeline) return;
    const v = Math.max(16, Number((e.target as HTMLInputElement).value) | 0);
    emit('update:timeline', { ...props.timeline, settings: { ...props.timeline.settings, renderWidth: v } } as any);
};
const updateExportHeight = (e: Event) => {
    if (!props.timeline) return;
    const v = Math.max(16, Number((e.target as HTMLInputElement).value) | 0);
    emit('update:timeline', { ...props.timeline, settings: { ...props.timeline.settings, renderHeight: v } } as any);
};
const toggleIncludeAudio = (e: Event) => {
    if (!props.timeline) return;
    const v = !!(e.target as HTMLInputElement).checked;
    emit('update:timeline', { ...props.timeline, settings: { ...props.timeline.settings, includeAudio: v } } as any);
};
const updateBitrate = (e: Event) => {
    if (!props.timeline) return;
    const v = Math.max(1, Number((e.target as HTMLInputElement).value) || 8);
    emit('update:timeline', { ...props.timeline, settings: { ...props.timeline.settings, exportBitrateMbps: v } } as any);
};

const promptReset = () => {
    if (globalThis.confirm('Reset timeline? This removes scenes and actions but keeps media.')) emit('resetProject');
};
const triggerImport = () => {
    emit('importWolk');
};

// (no duplicates)

// Keyframes: global opacity (0..1)
type KF = { frame: number; value: number };
const opacityTrack = computed<KF[]>({
    get() {
        return props.timeline?.globalOpacityTrack?.keyframes as any || [];
    },
    set(val: KF[]) {
        if (!props.timeline) return;
        const updated: TimelineDocument = {
            ...props.timeline,
            globalOpacityTrack: { propertyPath: 'global.opacity', keyframes: val.map(k => ({ frame: Math.max(0, k.frame|0), value: Math.min(1, Math.max(0, Number(k.value))) })) }
        } as any;
        emit('update:timeline', updated);
    }
});

const addOpacityKeyframe = (frame: number, value: number) => {
    const kf = opacityTrack.value.slice();
    kf.push({ frame: Math.max(0, frame|0), value: Math.min(1, Math.max(0, Number(value))) });
    kf.sort((a,b) => a.frame - b.frame);
    opacityTrack.value = kf;
};
const removeOpacityKeyframe = (idx: number) => {
    const kf = opacityTrack.value.slice();
    if (idx >= 0 && idx < kf.length) { kf.splice(idx, 1); opacityTrack.value = kf; }
};

</script>

<template>
    <div>
        <h3>Inspector</h3>
        <div v-if="timeline">
            <div>FPS: {{ timeline.settings.fps }}</div>
            <div>Resolution: {{ timeline.settings.renderWidth }}×{{ timeline.settings.renderHeight }}</div>
            <label style="display:block; margin-top:8px;">
                Seed
                <input :value="timeline.settings.seed" @input="updateSeed" />
            </label>
            <details style="margin-top:12px;">
                <summary style="font-weight:600; margin-bottom:4px;">Fonts</summary>
                <label style="display:block; margin-bottom:6px;">
                    Primary font
                    <input :value="primaryFont" @input="(e:any) => setPrimaryFont(e.target.value)" placeholder="e.g., Inter" />
                </label>
                <div style="margin-bottom:8px;">
                    <div style="margin-bottom:4px;">Fallbacks</div>
                    <div v-for="(ff, i) in fallbacks" :key="ff + ':' + i" style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
                        <input :value="ff" @input="(e:any) => { const v=e.target.value; const arr = fallbacks.slice(); arr[i]=v; emit('update:timeline', { ...timeline, settings: { ...timeline.settings, fontFallbacks: arr } } as any); }" />
                        <button title="Up" @click="() => moveFallback(i, -1)">↑</button>
                        <button title="Down" @click="() => moveFallback(i, 1)">↓</button>
                        <button title="Remove" @click="() => removeFallback(i)">Remove</button>
                    </div>
                    <button @click="() => addFallback('sans-serif')">Add fallback</button>
                </div>
                <div style="margin-bottom:8px;">
                    <div style="margin-bottom:4px;">Search system fonts</div>
                    <input v-model="query" placeholder="Search fonts..." />
                    <div style="max-height:160px; overflow:auto; border:1px solid #333; margin-top:6px; padding:4px;">
                        <div v-for="f in filteredFonts" :key="f.filePath" style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:2px 0;">
                            <div style="flex:1 1 auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ f.familyGuess }} <span style="opacity:0.6;">({{ f.fileName }})</span></div>
                            <div style="display:flex; gap:6px;">
                                <button @click="() => setPrimaryFont(f.familyGuess)">Set primary</button>
                                <button @click="() => addFallback(f.familyGuess)">Add fallback</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div style="margin-top:8px; padding:8px; border:1px dashed #444;" :style="{ fontFamily: fontFamilyChain }">
                    <div style="opacity:0.8; font-size:12px;">Preview (font-family): {{ fontFamilyChain }}</div>
                    <div style="font-size:18px; line-height:28px;">The quick brown fox jumps over the lazy dog 0123456789</div>
                </div>
            </details>
            <details style="margin-top:12px;">
                <summary style="font-weight:600; margin-bottom:4px;">Project Operations</summary>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <button @click="promptReset">Reset timeline (keep media)</button>
                    <button @click="triggerImport">Import .wolk…</button>
                </div>
            </details>
            <details style="margin-top:12px;">
                <summary style="font-weight:600; margin-bottom:4px;">Global Opacity</summary>
                <div style="margin-bottom:8px; font-size:12px; opacity:0.8;">Keyframes for project-wide opacity (0..1)</div>
                <div>
                    <button @click="() => addOpacityKeyframe(0, 1)">Add at 0:00 = 1</button>
                    <button @click="() => addOpacityKeyframe(60, 0)">Add at 60f = 0</button>
                </div>
                <div style="margin-top:8px;">
                    <div v-for="(k, i) in opacityTrack" :key="i" style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
                        <label>Frame <input :value="k.frame" @input="(e:any)=>{ const v = Number(e.target.value)||0; const arr = opacityTrack.slice(); arr[i] = { ...arr[i], frame: v|0 }; opacityTrack = arr as any; }" style="width:90px;" /></label>
                        <label>Value <input :value="k.value" @input="(e:any)=>{ const v = Math.min(1, Math.max(0, Number(e.target.value)||0)); const arr = opacityTrack.slice(); arr[i] = { ...arr[i], value: v }; opacityTrack = arr as any; }" style="width:80px;" /></label>
                        <button @click="() => removeOpacityKeyframe(i)">Remove</button>
                    </div>
                </div>
            </details>
            <details style="margin-top:12px;">
                <summary style="font-weight:600; margin-bottom:4px;">Export Options</summary>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <label>FPS <input type="number" min="1" :value="timeline.settings.fps" @input="updateExportFps" style="width:90px;" /></label>
                    <label>Width <input type="number" min="16" :value="timeline.settings.renderWidth" @input="updateExportWidth" style="width:110px;" /></label>
                    <label>Height <input type="number" min="16" :value="timeline.settings.renderHeight" @input="updateExportHeight" style="width:110px;" /></label>
                    <label style="display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" :checked="!!timeline.settings.includeAudio" @change="toggleIncludeAudio" /> Include audio
                    </label>
                    <label>Video bitrate (Mbps)
                        <input type="number" min="1" step="1" :value="Number(timeline.settings.exportBitrateMbps||8)" @input="updateBitrate" style="width:140px;" />
                    </label>
                </div>
            </details>
        </div>
        <div v-if="selectedScene" style="margin-top:12px;">
            <label style="display:block;">
                Scene name
                <input :value="selectedScene.name" @input="updateSceneName" />
            </label>
            <div v-if="selectedScene.type === 'singleWord'" style="margin-top:8px;">
                <label style="display:block;">
                    Beat threshold (0..1)
                    <input type="number" min="0" max="1" step="0.01" :value="Number((sceneParams && (sceneParams as any).beatThreshold) ?? 0.07)" @input="(e:any)=>{ const v=Math.min(1,Math.max(0,Number(e.target.value)||0)); emit('update:sceneParams', { ...(sceneParams||{}), beatThreshold: v }); }" />
                </label>
            </div>
        </div>
        
        <details style="margin-top:12px;">
            <summary style="font-weight:600; margin-bottom:4px;">Timeline Overlays</summary>
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
                <label>
                    <input type="checkbox" :checked="!!overlayOpts?.showEnergy" @change="(e:any)=> emit('update:overlayOpts', { ...(overlayOpts||{showEnergy:true,showOnsets:true}), showEnergy: !!e.target.checked })" />
                    Show energy
                </label>
                <label>
                    <input type="checkbox" :checked="!!overlayOpts?.showOnsets" @change="(e:any)=> emit('update:overlayOpts', { ...(overlayOpts||{showEnergy:true,showOnsets:true}), showOnsets: !!e.target.checked })" />
                    Show onsets / word changes
                </label>
            </div>
        </details>
    </div>
</template>


