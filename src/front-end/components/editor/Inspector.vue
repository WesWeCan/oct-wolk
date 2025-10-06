<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { TimelineDocument, SceneRef, SceneDocumentBase, PropertyTrack } from '@/types/timeline_types';
import type { WordGroup } from '@/types/song_types';
import InspectorAllowedWords from './InspectorAllowedWords.vue';
import { FontsService } from '@/front-end/services/FontsService';
import { SongService } from '@/front-end/services/SongService';
import { SCENE_ANIMATABLES } from '@/front-end/workers/scenes/animatables';
import { evalInterpolatedAtFrame } from '@/front-end/utils/tracks';

interface SystemFontFile { familyGuess: string; filePath: string; fileName: string; }

const props = defineProps<{ timeline: TimelineDocument | null; selectedScene: SceneRef | null; sceneParams?: Record<string, any> | null; overlayOpts?: { showEnergy: boolean; showOnsets: boolean; showBeats?: boolean }; currentFrame?: number; wordBank?: string[]; wordGroups?: WordGroup[]; allowedTrack?: PropertyTrack<string[]> | null; sceneTracks?: PropertyTrack<any>[] | null }>();
const emit = defineEmits<{
    (e: 'update:timeline', value: TimelineDocument): void;
    (e: 'update:scene', value: SceneRef): void;
    (e: 'update:sceneParams', value: Record<string, any>): void;
    (e: 'update:overlayOpts', value: { showEnergy: boolean; showOnsets: boolean; showBeats?: boolean }): void;
    (e: 'resetProject'): void;
    (e: 'importWolk'): void;
    (e: 'update:sceneTracks', value: { sceneId: string; tracks: PropertyTrack[] }): void;
    (e: 'navigate', value: { dir: 'prevKf' | 'nextKf' | 'prevBeat' | 'nextBeat' }): void;
    (e: 'scrubToFrame', frame: number): void;
    (e: 'propChangeValue', payload: { propertyPath: string; value: any }): void;
    (e: 'addKeyframe', payload: { propertyPath: string; frame: number; value: any }): void;
    (e: 'deleteKeyframe', payload: { propertyPath: string; index: number }): void;
    (e: 'scrollToProperty', payload: { propertyPath: string }): void;
}>();
// Capture route in setup to avoid calling useRoute() later in event handlers
const route = useRoute();
const isModel3DScene = computed(() => ((props.selectedScene as any)?.type === 'model3d'));

// Get interpolated value for a property at current frame
const getAnimatedValue = (propertyPath: string) => {
    const sceneType = props.selectedScene?.type;
    if (!sceneType) return null;
    
    const animatableMetas = (SCENE_ANIMATABLES as any)[sceneType] || [];
    const meta = animatableMetas.find((m: any) => m.propertyPath === propertyPath);
    if (!meta) return null;
    
    const track = (props.sceneTracks || []).find((t: any) => t.propertyPath === propertyPath);
    const frame = props.currentFrame || 0;
    
    return evalInterpolatedAtFrame(track, frame, meta.default);
};

// Get all animatable properties for current scene type
const sceneAnimatables = computed(() => {
    const sceneType = props.selectedScene?.type;
    if (!sceneType) return [];
    return (SCENE_ANIMATABLES as any)[sceneType] || [];
});

// Group animatables by their group field
const groupedAnimatables = computed(() => {
    const groups: Record<string, any[]> = {};
    sceneAnimatables.value.forEach((meta: any) => {
        const groupName = meta.group || 'Other';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(meta);
    });
    return groups;
});

// Emit event to scroll to corresponding timeline lane
const scrollToLane = (propertyPath: string) => {
    console.log('[Inspector] scrollToLane called for:', propertyPath);
    emit('scrollToProperty' as any, { propertyPath });
};
// Helpers for model3d asset uploads
const uploading = ref(false);
const uploadError = ref<string | null>(null);
const handleUpload = async (kind: 'obj' | 'diffuse' | 'normal') => {
    try {
        uploadError.value = null; uploading.value = true;
        const input = document.createElement('input');
        input.type = 'file';
        if (kind === 'obj') input.accept = '.obj,model/obj,application/octet-stream';
        if (kind === 'diffuse' || kind === 'normal') input.accept = '.jpg,.jpeg,.png,image/jpeg,image/png';
        const picked = await new Promise<File | null>((resolve) => {
            input.onchange = () => {
                const file = input.files && input.files[0] ? input.files[0] : null;
                resolve(file);
            };
            input.click();
        });
        if (!picked) { uploading.value = false; return; }
        const songId = (route.params.songId as string) || '';
        // delete old for that slot before uploading with prefixed base name
        const p0: any = props.sceneParams || {};
        const currentUrlForSlot = kind === 'obj' ? p0.modelObjUrl : (kind === 'diffuse' ? p0.diffuseMapUrl : p0.normalMapUrl);
        if (currentUrlForSlot) { try { const name = String(currentUrlForSlot).split('/').pop() || ''; await SongService.deleteAsset(songId, name); } catch {} }
        const ext = (picked.name.split('.').pop() || '').toLowerCase();
        const preferred = `${kind === 'obj' ? 'obj' : (kind === 'diffuse' ? 'tex' : 'normal')}_${Date.now()}.${ext || 'bin'}`;
        const res = await SongService.uploadAsset(songId, picked, preferred);
        const p: Record<string, any> = { ...(props.sceneParams || {}) };
        if (kind === 'obj') p.modelObjUrl = res.url;
        if (kind === 'diffuse') p.diffuseMapUrl = res.url;
        if (kind === 'normal') p.normalMapUrl = res.url;
        emit('update:sceneParams', p);
    } catch (e: any) {
        uploadError.value = String(e?.message || 'Upload failed');
    } finally {
        uploading.value = false;
    }
};

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

// Allowed words helpers (UI glue; content editing to come)
const highlightWordSearch = (e: Event) => {
    try {
        const v = String((e.target as HTMLInputElement).value || '').toLowerCase();
        const doc: any = (globalThis as any).document || (window as any).document;
        const els = Array.from(doc.querySelectorAll('.wb-chip')) as HTMLElement[];
        els.forEach(el => {
            const t = (el.innerText || '').toLowerCase();
            (el as any).style.outline = v && t.includes(v) ? '1px solid #7fd' : '';
        });
    } catch {}
};

// Scrub numeric values by dragging the handle next to property labels
const startScrub = (e: PointerEvent, meta: any) => {
    try { (e.target as any)?.setPointerCapture?.(e.pointerId); } catch {}
    const startX = e.clientX;
    const min = Number.isFinite(meta?.min) ? Number(meta.min) : -Infinity;
    const max = Number.isFinite(meta?.max) ? Number(meta.max) : Infinity;
    const step = Number.isFinite(meta?.step) ? Number(meta.step) : 0.1;
    const pp = String(meta?.propertyPath || '');
    const getVal = () => {
        const v = getAnimatedValue(pp) as any;
        return (typeof v === 'number') ? v : (Number.isFinite(meta?.default) ? Number(meta.default) : 0);
    };
    const v0 = getVal();
    const range = (Number.isFinite(min) && Number.isFinite(max) && max > min) ? (max - min) : 100;
    const basePerPx = range * 0.002; // 500px drag ~ full range
    const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        let speed = basePerPx;
        if (ev.shiftKey) speed *= 4; // fast
        if (ev.altKey || (ev as any).metaKey) speed *= 0.25; // fine
        let next = v0 + dx * speed;
        if (Number.isFinite(step) && step > 0) {
            next = Math.round(next / step) * step;
        }
        if (Number.isFinite(min)) next = Math.max(min, next);
        if (Number.isFinite(max)) next = Math.min(max, next);
        emit('propChangeValue', { propertyPath: pp, value: next });
    };
    const onUp = (ev: PointerEvent) => {
        try { (e.target as any)?.releasePointerCapture?.(e.pointerId); } catch {}
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
};

// Inspector-level Reset/Clear helpers (emit events to parent that manages tracks)
const resetAnimatableToDefault = (meta: any) => {
    console.log('[Inspector] resetAnimatableToDefault called for:', meta.propertyPath, 'at frame:', props.currentFrame);
    console.trace('[Inspector] Reset button call stack');
    const frame = (props.currentFrame || 0) as number;
    const def = Number.isFinite(meta?.default) ? Number(meta.default) : 0;
    // Reuse the same event contract as ScenePropertiesLane
    (emit as any)('addKeyframe', { propertyPath: meta.propertyPath, frame, value: def });
};

const clearAnimatableTrack = (propertyPath: string) => {
    // Ask parent to delete all keyframes by emitting synthetic deletes; parent should handle
    const track = (props.sceneTracks || []).find((t: any) => t.propertyPath === propertyPath);
    const count = Array.isArray(track?.keyframes) ? track!.keyframes.length : 0;
    for (let i = count - 1; i >= 0; i--) {
        (emit as any)('deleteKeyframe', { propertyPath, index: i });
    }
    
    // After clearing, add a keyframe with the default value at the current frame
    const sceneType = props.selectedScene?.type;
    if (sceneType) {
        const animatableMetas = (SCENE_ANIMATABLES as any)[sceneType] || [];
        const meta = animatableMetas.find((m: any) => m.propertyPath === propertyPath);
        if (meta) {
            const frame = props.currentFrame || 0;
            const def = Number.isFinite(meta?.default) ? Number(meta.default) : 0;
            (emit as any)('addKeyframe', { propertyPath, frame, value: def });
        }
    }
};

// Color picker helpers: Convert between HSL and hex
const hslToHex = (h: number, s: number, l: number): string => {
    h = h / 360;
    s = s / 100;
    l = l / 100;
    let r: number, g: number, b: number;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
};

const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 0 };
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// Get HSL color from property path (for color picker)
const getHslColor = (prefix: string): { h: number; s: number; l: number } => {
    // Try labels pattern first (.bgHue, .bgSat, .bgLight), then background pattern (.hue, .sat, .light)
    let h = getAnimatedValue(`${prefix}.bgHue`) as number;
    let s = getAnimatedValue(`${prefix}.bgSat`) as number;
    let l = getAnimatedValue(`${prefix}.bgLight`) as number;
    
    if (h == null) h = getAnimatedValue(`${prefix}.hue`) as number ?? 0;
    if (s == null) s = getAnimatedValue(`${prefix}.sat`) as number ?? 0;
    if (l == null) l = getAnimatedValue(`${prefix}.light`) as number ?? 100;
    
    return { h: h ?? 0, s: s ?? 0, l: l ?? 100 };
};

const setColorFromPicker = (prefix: string, hex: string) => {
    const { h, s, l } = hexToHsl(hex);
    
    // Check which pattern to use (labels or background)
    if (getAnimatedValue(`${prefix}.bgHue`) != null || prefix === 'labels') {
        // Labels pattern
        emit('propChangeValue', { propertyPath: `${prefix}.bgHue`, value: h });
        emit('propChangeValue', { propertyPath: `${prefix}.bgSat`, value: s });
        emit('propChangeValue', { propertyPath: `${prefix}.bgLight`, value: l });
    } else {
        // Background pattern
        emit('propChangeValue', { propertyPath: `${prefix}.hue`, value: h });
        emit('propChangeValue', { propertyPath: `${prefix}.sat`, value: s });
        emit('propChangeValue', { propertyPath: `${prefix}.light`, value: l });
    }
};

</script>

<template>
    <div class="inspector">
        <h3>Inspector</h3>
        <div v-if="timeline">
            <!-- FPS and Resolution info moved to Monitor section -->
            <label>
                Seed
                <input type="text" :value="timeline.settings.seed" @input="updateSeed" />
            </label>
            <details class="font-management">
                <summary>Font Settings</summary>
                <div class="form-row">
                    <label>
                    Primary font
                    <input type="text" :value="primaryFont" @input="(e:any) => setPrimaryFont(e.target.value)" placeholder="e.g., Inter" />
                </label>
                </div>
          
                <div class="fallback-list">
                    <div class="list-title">Fallbacks</div>
                    <div v-for="(ff, i) in fallbacks" :key="ff + ':' + i" class="fallback-item">
                        <input type="text" :value="ff" @input="(e:any) => { const v=e.target.value; const arr = fallbacks.slice(); arr[i]=v; emit('update:timeline', { ...timeline, settings: { ...timeline.settings, fontFallbacks: arr } } as any); }" />
                        <button title="Up" @click="() => moveFallback(i, -1)">↑</button>
                        <button title="Down" @click="() => moveFallback(i, 1)">↓</button>
                        <button title="Remove" @click="() => removeFallback(i)">Remove</button>
                    </div>
                    <button @click="() => addFallback('sans-serif')">Add fallback</button>
                </div>
                <div>
                    <div>Search system fonts</div>
                    <input type="search" v-model="query" class="search-input" placeholder="Search fonts..." />
                    <div class="font-list">
                        <div v-for="f in filteredFonts" :key="f.filePath" class="font-item">
                            <div class="font-name">{{ f.familyGuess }} <span class="file-name">({{ f.fileName }})</span></div>
                            <div class="actions">
                                <button @click="() => setPrimaryFont(f.familyGuess)">Set primary</button>
                                <button @click="() => addFallback(f.familyGuess)">Add fallback</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="font-preview" :style="{ fontFamily: fontFamilyChain }">
                    <div class="preview-label">Preview (font-family): {{ fontFamilyChain }}</div>
                    <div class="preview-text">The quick brown fox jumps over the lazy dog 0123456789</div>
                </div>
            </details>
            <details>
                <summary>Project Operations</summary>
                <div class="form-row">
                    <button @click="promptReset" class="danger">Reset timeline (keep media)</button>
                    <button @click="triggerImport" class="primary">Import .wolk…</button>
                </div>
            </details>
            <details hidden>
                <summary>Global Opacity</summary>
                <div>Keyframes for project-wide opacity (0..1)</div>
                <div class="form-row">
                    <button @click="() => addOpacityKeyframe(0, 1)">Add at 0:00 = 1</button>
                    <button @click="() => addOpacityKeyframe(60, 0)">Add at 60f = 0</button>
                </div>
                <div class="form-row">
                    <div v-for="(k, i) in opacityTrack" :key="i" class="form-row">
                        <label>Frame <input type="number" :value="k.frame" @input="(e:any)=>{ const v = Number(e.target.value)||0; const arr = opacityTrack.slice(); arr[i] = { ...arr[i], frame: v|0 }; opacityTrack = arr as any; }" /></label>
                        <label>Value <input type="number" :value="k.value" @input="(e:any)=>{ const v = Math.min(1, Math.max(0, Number(e.target.value)||0)); const arr = opacityTrack.slice(); arr[i] = { ...arr[i], value: v }; opacityTrack = arr as any; }" /></label>
                        <button @click="() => removeOpacityKeyframe(i)">Remove</button>
                    </div>
                </div>
            </details>
            <!-- Export Options moved to Monitor section -->
        </div>
        <div v-if="selectedScene">
            <label>
                Scene name
                <input type="text" :value="selectedScene.name" @input="updateSceneName" />
            </label>
            
            

            <div v-if="selectedScene.type === 'wordSphere'" class="form-row">
                <label class="inline">
                    <input type="checkbox" :checked="!!(sceneParams && (sceneParams as any).showSphere !== false)" @change="(e:any)=> emit('update:sceneParams', { ...(sceneParams||{}), showSphere: !!e.target.checked })" />
                    Show sphere
                </label>
                <label class="inline">
                    <input type="checkbox" :checked="!!(sceneParams && (sceneParams as any).sphereWireframe)" @change="(e:any)=> emit('update:sceneParams', { ...(sceneParams||{}), sphereWireframe: !!e.target.checked })" />
                    Wireframe
                </label>
                <label>
                    Energy response (0..1)
                    <input type="number" min="0" max="1" step="0.05" :value="Number((sceneParams && (sceneParams as any).energyResponse) ?? 0.25)" @input="(e:any)=>{ const v=Math.min(1,Math.max(0,Number(e.target.value)||0)); emit('update:sceneParams', { ...(sceneParams||{}), energyResponse: v }); }" />
                </label>
            </div>

            <div v-if="isModel3DScene" class="model-uploads">
                <div class="upload-actions">
                    <button :disabled="uploading" @click="() => handleUpload('obj')">Upload .obj</button>
                    <button :disabled="uploading" @click="() => handleUpload('diffuse')">Upload diffuse</button>
                    <button :disabled="uploading" @click="() => handleUpload('normal')">Upload normal</button>
                    <button :disabled="uploading || !(sceneParams as any)?.modelObjUrl" @click="async()=>{ const songId=(route.params.songId as string)||''; const obj=(sceneParams as any)?.modelObjUrl; if(obj){ const name=obj.split('/').pop()||''; await SongService.deleteAsset(songId, name); emit('update:sceneParams', { ...(sceneParams||{}), modelObjUrl: undefined }); } }">Delete OBJ</button>
                    <button :disabled="uploading || !(sceneParams as any)?.diffuseMapUrl" @click="async()=>{ const songId=(route.params.songId as string)||''; const d=(sceneParams as any)?.diffuseMapUrl; if(d){ const name=d.split('/').pop()||''; await SongService.deleteAsset(songId, name); emit('update:sceneParams', { ...(sceneParams||{}), diffuseMapUrl: undefined }); } }">Delete diffuse</button>
                    <button :disabled="uploading || !(sceneParams as any)?.normalMapUrl" @click="async()=>{ const songId=(route.params.songId as string)||''; const n=(sceneParams as any)?.normalMapUrl; if(n){ const name=n.split('/').pop()||''; await SongService.deleteAsset(songId, name); emit('update:sceneParams', { ...(sceneParams||{}), normalMapUrl: undefined }); } }">Delete normal</button>
                    <button :disabled="uploading || (!((sceneParams as any)?.modelObjUrl || (sceneParams as any)?.diffuseMapUrl || (sceneParams as any)?.normalMapUrl))" @click="async()=>{ const songId=(route.params.songId as string)||''; const paths=[(sceneParams as any)?.modelObjUrl,(sceneParams as any)?.diffuseMapUrl,(sceneParams as any)?.normalMapUrl].filter(Boolean) as string[]; for(const p of paths){ const name=p.split('/').pop()||''; await SongService.deleteAsset(songId, name); } emit('update:sceneParams', { ...(sceneParams||{}), modelObjUrl: undefined, diffuseMapUrl: undefined, normalMapUrl: undefined }); }">Clear all</button>
                </div>
                
                <div v-if="!(sceneParams as any)?.modelObjUrl" class="no-model">Upload model first</div>
                <div v-if="uploadError" class="error">{{ uploadError }}</div>
                <div class="current-assets">
                    Current: OBJ {{ (sceneParams as any)?.modelObjUrl || '—' }}, MTL {{ (sceneParams as any)?.modelMtlUrl || '—' }},
                    Diffuse {{ (sceneParams as any)?.diffuseMapUrl || '—' }}, Normal {{ (sceneParams as any)?.normalMapUrl || '—' }}
                </div>
            </div>

            <!-- Generic animatable properties for current scene type (grouped) -->
            <div v-if="sceneAnimatables.length > 0" class="animatable-properties">
                <div class="section-title">Animatable Properties</div>
                <details v-for="(properties, groupName) in groupedAnimatables" :key="groupName" class="property-group" open>
                    <summary class="group-header">{{ groupName }}</summary>
                    <div v-for="meta in properties" :key="meta.propertyPath" 
                         class="property"
                         :data-property-path="meta.propertyPath">
                        <div class="property-header">
                            <span class="scrub-handle" 
                                  title="Drag left/right to adjust; Shift=fast, Alt=slow"
                                  @pointerdown.prevent.stop="(e:any)=>startScrub(e, meta)">⟷</span>
                            <span class="property-label-text" @click.stop="(e) => { console.log('[Inspector] Label clicked', meta.propertyPath, e); scrollToLane(meta.propertyPath); }">{{ meta.label || meta.propertyPath }}</span>
                            <span class="value-display" @click.stop="(e) => { console.log('[Inspector] Value display clicked', meta.propertyPath, e); scrollToLane(meta.propertyPath); }">
                                {{ typeof getAnimatedValue(meta.propertyPath) === 'number' ? getAnimatedValue(meta.propertyPath).toFixed(3) : '—' }}
                            </span>
                            <span class="property-buttons">
                                <button class="small" title="Set default at current frame" @click.prevent.stop="(e) => { console.log('[Inspector] Reset button clicked', meta.propertyPath, e); resetAnimatableToDefault(meta); }">Reset</button>
                                <button class="small danger" title="Remove all keyframes for this property" @click.prevent.stop="(e) => { console.log('[Inspector] Clear button clicked', meta.propertyPath, e); clearAnimatableTrack(meta.propertyPath); }">Clear</button>
                            </span>
                        </div>
                        <div class="input-with-picker">
                            <input 
                                v-if="meta.type === 'number' || !meta.type"
                                type="number" 
                                :step="meta.step ?? 0.1" 
                                :min="meta.min ?? undefined" 
                                :max="meta.max ?? undefined"
                                :value="typeof getAnimatedValue(meta.propertyPath) === 'number' ? getAnimatedValue(meta.propertyPath).toFixed(3) : meta.default"
                                @input="(e:any)=>{ console.log('[Inspector] Input changed', meta.propertyPath, 'value:', e.target.value); const v=Number(e.target.value) ?? meta.default; emit('propChangeValue', { propertyPath: meta.propertyPath, value: v }); }"
                            />
                            <!-- Show color picker for Hue properties (part of HSL triplet) -->
                            <input 
                                v-if="meta.propertyPath.endsWith('.bgHue') || meta.propertyPath.endsWith('.hue')"
                                type="color"
                                class="color-picker"
                                :value="hslToHex(getHslColor(meta.propertyPath.replace('.bgHue', '').replace('.hue', '')).h, getHslColor(meta.propertyPath.replace('.bgHue', '').replace('.hue', '')).s, getHslColor(meta.propertyPath.replace('.bgHue', '').replace('.hue', '')).l)"
                                @input="(e:any)=>setColorFromPicker(meta.propertyPath.replace('.bgHue', '').replace('.hue', ''), e.target.value)"
                                title="Color picker"
                            />
                        </div>
                    </div>
                </details>
            </div>
        </div>

        <details>
            <summary>Word Pool</summary>
            <div class="form-row nav-buttons">
                <button @click="() => emit('navigate', { dir: 'prevKf' })" title="Previous keyframe">◀ Keyframe</button>
                <button @click="() => emit('navigate', { dir: 'nextKf' })" title="Next keyframe">Keyframe ▶</button>
                <button @click="() => emit('navigate', { dir: 'prevBeat' })" title="Previous beat">◀ Beat</button>
                <button @click="() => emit('navigate', { dir: 'nextBeat' })" title="Next beat">Beat ▶</button>
            </div>
            <InspectorAllowedWords
                :word-bank="wordBank || []"
                :word-groups="wordGroups || []"
                :allowed-track="(timeline?.wordsPoolTrack || null) as any"
                :current-frame="currentFrame || 0"
                :use-global="true"
                @update:globalTrack="(track: any) => { if (!timeline) return; const updated: TimelineDocument = { ...(timeline as any), wordsPoolTrack: { propertyPath: 'timeline.words.pool', keyframes: Array.isArray(track?.keyframes) ? track.keyframes : [] } }; emit('update:timeline', updated); }"
                @navigateToFrame="(frame: number) => emit('scrubToFrame', frame)"
            />
        </details>
        

    </div>
</template>


<style scoped>
.scrub-handle {
  display: inline-block;
  margin-right: 6px;
  padding: 0 4px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 3px;
  cursor: ew-resize;
  font-size: 10px;
  color: #ddd;
}

.property-group {
  margin: 8px 0;
  border: 1px solid rgba(0, 212, 255, 0.15);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.15);
}

.property-group .group-header {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(0, 212, 255, 0.9);
  cursor: pointer;
  user-select: none;
  background: rgba(0, 212, 255, 0.05);
}

.property-group .group-header:hover {
  background: rgba(0, 212, 255, 0.1);
}

.property-group .property {
  transition: background 0.15s;
}

.property-group .property .property-label-text {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background 0.15s;
}

.property-group .property .property-label-text:hover {
  background: rgba(0, 212, 255, 0.12);
}

.property-group .property .value-display {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background 0.15s;
}

.property-group .property .value-display:hover {
  background: rgba(0, 212, 255, 0.12);
}

.input-with-picker {
  display: flex;
  gap: 6px;
  align-items: center;
}

.input-with-picker input[type="number"] {
  flex: 1;
}

.color-picker {
  width: 40px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  padding: 0;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 3px;
}
</style>


