<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FontsService, FontName } from '@/front-end/services/FontsService';
import type { MotionStyle, WolkProjectFont } from '@/types/project_types';
import type { SystemFontFile } from '@/front-end/services/FontsService';
import {
    buildFontFamilyChain,
    fontDescriptorFromMotionStyle,
    fontDescriptorFromProjectFont,
    getSystemFontVariantLabel,
    groupSystemFonts,
    type MotionFontSelection,
} from '@/front-end/utils/fonts/fontUtils';

const props = defineProps<{
    modelValue: MotionStyle;
    projectFont?: WolkProjectFont;
    disabled?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: MotionFontSelection): void;
}>();

const route = useRoute();
const allFonts = ref<SystemFontFile[]>([]);
const query = ref('');
const expanded = ref(false);
const copyingPath = ref<string | null>(null);

const currentFont = computed(() => fontDescriptorFromMotionStyle(props.modelValue, props.projectFont));
const currentPreviewChain = computed(() => buildFontFamilyChain(currentFont.value));
const currentDisplayName = computed(() => currentFont.value.name || currentFont.value.family || 'System Default');
const projectPreviewChain = computed(() => buildFontFamilyChain(fontDescriptorFromProjectFont(props.projectFont)));
const projectDisplayName = computed(() => props.projectFont?.name || props.projectFont?.family || 'Project Default');

const groupedFonts = computed(() => groupSystemFonts(allFonts.value));

const filteredGroups = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return groupedFonts.value.slice(0, 75);
    return groupedFonts.value
        .filter((group) => group.searchText.includes(q))
        .slice(0, 75);
});

const emitSelection = (selection: MotionFontSelection) => {
    emit('update:modelValue', selection);
    expanded.value = false;
};

const selectSystemFont = async (font: SystemFontFile) => {
    const documentId = (route.params.projectId as string) || (route.params.songId as string) || (route.params.id as string) || '';
    copyingPath.value = font.filePath;
    try {
        const wolkUrl = await FontsService.addToProject(documentId, font.filePath);
        emitSelection({
            source: 'system',
            family: font.familyGuess,
            fallbacks: props.projectFont?.fallbacks || ['sans-serif'],
            style: font.guessStyle || 'normal',
            weight: font.guessWeight || 400,
            name: FontName.fromFileName(font.fileName) || font.familyGuess,
            localPath: wolkUrl || undefined,
            filePath: font.filePath,
        });
    } finally {
        copyingPath.value = null;
    }
};

const selectDefault = () => {
    emitSelection({
        source: 'project',
        ...fontDescriptorFromProjectFont(props.projectFont),
    });
};

onMounted(async () => {
    try {
        allFonts.value = await FontsService.list();
    } catch {
        allFonts.value = [];
    }
});
</script>

<template>
    <div class="motion-font-selector" :class="{ 'is-disabled': disabled }">
        <button
            class="motion-font-selector__trigger"
            type="button"
            :disabled="disabled"
            @click="expanded = !expanded"
        >
            <span class="motion-font-selector__preview" :style="{ fontFamily: currentPreviewChain }">Aa</span>
            <span class="motion-font-selector__name">{{ currentDisplayName }}</span>
            <span class="motion-font-selector__caret">{{ expanded ? '▲' : '▼' }}</span>
        </button>

        <div v-if="expanded" class="motion-font-selector__dropdown">
            <button class="motion-font-selector__option motion-font-selector__option--default" @click="selectDefault">
                <span class="motion-font-selector__option-preview" :style="{ fontFamily: projectPreviewChain }">Aa</span>
                <span class="motion-font-selector__option-copy">
                    <span class="motion-font-selector__option-name">Project Default</span>
                    <span class="motion-font-selector__option-meta">{{ projectDisplayName }}</span>
                </span>
            </button>
            <input
                v-model="query"
                type="search"
                class="motion-font-selector__search inspector-input"
                placeholder="Search fonts..."
                :disabled="!!copyingPath"
            />
            <div class="motion-font-selector__list">
                <div
                    v-for="group in filteredGroups"
                    :key="group.family"
                    class="motion-font-selector__group"
                >
                    <div class="motion-font-selector__group-header">
                        <span class="motion-font-selector__option-preview" :style="{ fontFamily: group.family }">Aa</span>
                        <span class="motion-font-selector__option-copy">
                            <span class="motion-font-selector__option-name">{{ group.family }}</span>
                            <span class="motion-font-selector__option-meta">
                                {{ group.variants.length }} {{ group.variants.length === 1 ? 'variant' : 'variants' }}
                            </span>
                        </span>
                    </div>
                    <div class="motion-font-selector__variants">
                        <button
                            v-for="variant in group.variants"
                            :key="variant.filePath"
                            class="motion-font-selector__variant"
                            :disabled="copyingPath === variant.filePath"
                            @click="selectSystemFont(variant)"
                        >
                            <span>{{ getSystemFontVariantLabel(variant) }}</span>
                            <span class="motion-font-selector__variant-file">{{ variant.fileName }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
