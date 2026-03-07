<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { WolkProject, LyricTrack, TimelineItem } from '@/types/project_types';
import { FontsService, FontName, type SystemFontFile } from '@/front-end/services/FontsService';
import { ProjectService } from '@/front-end/services/ProjectService';
import { buildFontFamilyChain, fontDescriptorFromProjectFont } from '@/front-end/utils/fonts/fontUtils';
import ItemInspector from './ItemInspector.vue';

const props = defineProps<{
    project: WolkProject;
    mode: 'lyric' | 'motion';
    tracks: LyricTrack[];
    selectedItemId: string | null;
    playheadMs: number;
    overlayOpts: { showEnergy: boolean; showBeats: boolean; showBands: boolean; showBeatStrength: boolean };
}>();

const emit = defineEmits<{
    (e: 'updateProject', project: WolkProject): void;
    (e: 'updateItem', item: TimelineItem): void;
    (e: 'deleteItem', itemId: string): void;
    (e: 'splitItem', itemId: string, atMs: number): void;
    (e: 'mergeWithNext', itemId: string): void;
    (e: 'addItemAtLocation', payload: { trackId?: string; atMs: number }): void;
    (e: 'update:overlayOpts', value: { showEnergy: boolean; showBeats: boolean; showBands: boolean; showBeatStrength: boolean }): void;
}>();

// ===== FONT MANAGEMENT =====

const allFonts = ref<SystemFontFile[]>([]);
const fontQuery = ref('');
const copyingFontPath = ref<string | null>(null);
const copyError = ref<string | null>(null);

const filteredFonts = computed(() => {
    const q = fontQuery.value.trim().toLowerCase();
    if (!q) return allFonts.value.slice(0, 250);
    return allFonts.value.filter(f =>
        f.familyGuess.toLowerCase().includes(q) || f.fileName.toLowerCase().includes(q)
    ).slice(0, 250);
});

const primaryFont = computed(() => props.project.font?.family || 'system-ui');
const fontLocalPath = computed(() => props.project.font?.localPath || '');

const fontFamilyChain = computed(() => {
    return buildFontFamilyChain(fontDescriptorFromProjectFont(props.project.font));
});

const fallbackType = computed<'sans' | 'serif' | 'mono' | 'display'>(() => {
    const list = (props.project.font?.fallbacks || []).map(s => s.toLowerCase());
    if (list.includes('monospace')) return 'mono';
    if (list.includes('serif')) return 'serif';
    if (list.includes('fantasy') || list.includes('cursive')) return 'display';
    return 'sans';
});

const setFallbackType = (type: 'sans' | 'serif' | 'mono' | 'display') => {
    let chain: string[] = [];
    if (type === 'mono') chain = ['SF Mono', 'Monaco', 'Roboto Mono', 'Courier New', 'monospace'];
    else if (type === 'serif') chain = ['Georgia', 'Times New Roman', 'serif'];
    else if (type === 'display') chain = ['Impact', 'Haettenschweiler', 'fantasy', 'sans-serif'];
    else chain = ['-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'];
    emit('updateProject', {
        ...props.project,
        font: { ...props.project.font, fallbacks: chain },
    });
};

const setFontWeight = (weight: number) => {
    const w = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
    emit('updateProject', {
        ...props.project,
        font: { ...props.project.font, weight: w },
    });
};

const setFontStyle = (style: 'normal' | 'italic' | 'oblique') => {
    emit('updateProject', {
        ...props.project,
        font: { ...props.project.font, style },
    });
};

const setFontFromSystem = async (f: SystemFontFile) => {
    copyingFontPath.value = f.filePath;
    copyError.value = null;
    emit('updateProject', {
        ...props.project,
        font: { ...props.project.font, style: 'normal', weight: 400 },
    });
    const wolkUrl = await FontsService.addToProject(props.project.id, f.filePath);
    if (wolkUrl) {
        const fontName = FontName.fromFileName(f.fileName);
        emit('updateProject', {
            ...props.project,
            font: { ...props.project.font, localPath: wolkUrl, family: f.familyGuess, name: fontName, style: f.guessStyle || 'normal', weight: f.guessWeight || 400 },
        });
    } else {
        copyError.value = 'Failed to copy font into project.';
    }
    copyingFontPath.value = null;
};

const removeProjectFont = () => {
    emit('updateProject', {
        ...props.project,
        font: { ...props.project.font, localPath: undefined as any, name: undefined as any },
    });
};

// ===== PROJECT SETTINGS =====

const updateSeed = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    emit('updateProject', {
        ...props.project,
        settings: { ...props.project.settings, seed: v },
    });
};

// ===== OVERLAY TOGGLES =====

const toggleOverlay = (key: keyof typeof props.overlayOpts) => {
    emit('update:overlayOpts', { ...props.overlayOpts, [key]: !props.overlayOpts[key] });
};

// ===== LIFECYCLE =====

onMounted(async () => {
    try {
        const list = await FontsService.list();
        allFonts.value = Array.isArray(list) ? list : [];
    } catch {}
});
</script>

<template>
    <div class="project-inspector">
        <!-- Item Inspector (when in lyric mode) -->
        <template v-if="mode === 'lyric'">
            <ItemInspector
                :tracks="tracks"
                :selected-item-id="selectedItemId"
                :playhead-ms="playheadMs"
                @update-item="(item: TimelineItem) => emit('updateItem', item)"
                @delete-item="(id: string) => emit('deleteItem', id)"
                @split-item="(id: string, ms: number) => emit('splitItem', id, ms)"
                @merge-with-next="(id: string) => emit('mergeWithNext', id)"
                @add-item-at-location="(payload: { trackId?: string; atMs: number }) => emit('addItemAtLocation', payload)"
            />
        </template>
        <template v-else>
            <p class="panel-placeholder">Layer inspector (Phase 2)</p>
        </template>

        <!-- Project Settings -->
        <details class="inspector-section">
            <summary class="inspector-section__title">Project Settings</summary>
            <div class="inspector-section__content">
                <label class="inspector-label">
                    Seed
                    <input type="text" :value="project.settings.seed" @input="updateSeed" class="inspector-input" />
                </label>
            </div>
        </details>

        <!-- Font Settings -->
        <details class="inspector-section">
            <summary class="inspector-section__title">Font Settings</summary>
            <div class="inspector-section__content">
                <div class="font-preview" :style="{ fontFamily: fontFamilyChain, fontStyle: project.font?.style || 'normal', fontWeight: String(project.font?.weight || 400) }">
                    <div class="preview-label">Preview: <strong>{{ project.font?.name || 'System chain' }}</strong></div>
                    <div class="preview-text">The quick brown fox jumps over the lazy dog 0123456789</div>
                    <div class="font-actions" v-if="fontLocalPath">
                        <button @click="removeProjectFont" class="btn-sm danger">Remove project font</button>
                    </div>
                </div>
                <div class="form-row">
                    <label class="inspector-label">
                        Fallback
                        <select :value="fallbackType" @change="(e: any) => setFallbackType(e.target.value)" class="inspector-input">
                            <option value="sans">sans-serif</option>
                            <option value="serif">serif</option>
                            <option value="mono">monospace</option>
                            <option value="display">display</option>
                        </select>
                    </label>
                </div>
                <div class="form-row">
                    <label class="inspector-label">
                        Weight
                        <input type="range" :value="project.font?.weight || 400" @input="(e: any) => setFontWeight(Number(e.target.value))" min="100" max="900" step="100" />
                        <span class="inspector-hint">{{ project.font?.weight || 400 }}</span>
                    </label>
                </div>
                <div class="form-row">
                    <label class="inspector-label">
                        Style
                        <select :value="project.font?.style || 'normal'" @change="(e: any) => setFontStyle(e.target.value)" class="inspector-input">
                            <option value="normal">Normal</option>
                            <option value="italic">Italic</option>
                            <option value="oblique">Oblique</option>
                        </select>
                    </label>
                </div>
                <div class="font-search">
                    <div class="font-search__label">System Fonts</div>
                    <input type="search" v-model="fontQuery" class="inspector-input" placeholder="Search fonts..." />
                    <div class="font-list">
                        <div v-for="f in filteredFonts" :key="f.filePath" class="font-item">
                            <div class="font-name">{{ f.familyGuess }} <span class="file-name">({{ f.fileName }})</span></div>
                            <button :disabled="copyingFontPath === f.filePath" @click="() => setFontFromSystem(f)" class="btn-sm">Set font</button>
                        </div>
                        <div v-if="copyError" class="error">{{ copyError }}</div>
                    </div>
                </div>
            </div>
        </details>

        <!-- Analysis Overlays -->
        <details class="inspector-section">
            <summary class="inspector-section__title">Analysis Overlays</summary>
            <div class="inspector-section__content">
                <label class="overlay-toggle">
                    <input type="checkbox" :checked="overlayOpts.showEnergy" @change="toggleOverlay('showEnergy')" />
                    Energy
                </label>
                <label class="overlay-toggle">
                    <input type="checkbox" :checked="overlayOpts.showBeats" @change="toggleOverlay('showBeats')" />
                    Beats
                </label>
                <label class="overlay-toggle">
                    <input type="checkbox" :checked="overlayOpts.showBeatStrength" @change="toggleOverlay('showBeatStrength')" />
                    Beat Strength
                </label>
                <label class="overlay-toggle">
                    <input type="checkbox" :checked="overlayOpts.showBands" @change="toggleOverlay('showBands')" />
                    Frequency Bands
                </label>
            </div>
        </details>
    </div>
</template>
