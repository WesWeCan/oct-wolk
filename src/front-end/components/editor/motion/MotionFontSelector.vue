<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FontsService, FontName } from '@/front-end/services/FontsService';
import type { SystemFontFile } from '@/front-end/services/FontsService';

const props = defineProps<{
    modelValue: string;
    projectFontFamily?: string;
    disabled?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
}>();

const route = useRoute();
const allFonts = ref<SystemFontFile[]>([]);
const query = ref('');
const expanded = ref(false);
const copying = ref(false);

const filteredFonts = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return allFonts.value.slice(0, 150);
    return allFonts.value
        .filter(f => f.familyGuess.toLowerCase().includes(q) || f.fileName.toLowerCase().includes(q))
        .slice(0, 150);
});

const displayName = computed(() => {
    const val = props.modelValue;
    if (!val || val === 'system-ui') return props.projectFontFamily || 'System Default';
    return val;
});

const selectSystemFont = async (f: SystemFontFile) => {
    const songId = (route.params.songId as string) || (route.params.id as string) || '';
    copying.value = true;
    try {
        const wolkUrl = await FontsService.addToProject(songId, f.filePath);
        if (wolkUrl) {
            const fontName = FontName.fromFileName(f.fileName);
            emit('update:modelValue', fontName || f.familyGuess);
        } else {
            emit('update:modelValue', f.familyGuess);
        }
    } catch {
        emit('update:modelValue', f.familyGuess);
    }
    copying.value = false;
    expanded.value = false;
};

const selectDefault = () => {
    emit('update:modelValue', props.projectFontFamily || 'system-ui');
    expanded.value = false;
};

onMounted(async () => {
    try {
        allFonts.value = await FontsService.list();
    } catch { /* ignore */ }
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
            <span class="motion-font-selector__preview" :style="{ fontFamily: modelValue || 'system-ui' }">Aa</span>
            <span class="motion-font-selector__name">{{ displayName }}</span>
            <span class="motion-font-selector__caret">{{ expanded ? '▲' : '▼' }}</span>
        </button>

        <div v-if="expanded" class="motion-font-selector__dropdown">
            <button class="motion-font-selector__option motion-font-selector__option--default" @click="selectDefault">
                <span class="motion-font-selector__option-preview">Aa</span>
                <span>Project Default</span>
            </button>
            <input
                type="search"
                class="motion-font-selector__search inspector-input"
                v-model="query"
                placeholder="Search fonts..."
                :disabled="copying"
            />
            <div class="motion-font-selector__list">
                <button
                    v-for="f in filteredFonts"
                    :key="f.filePath"
                    class="motion-font-selector__option"
                    :disabled="copying"
                    @click="selectSystemFont(f)"
                >
                    <span class="motion-font-selector__option-preview" :style="{ fontFamily: f.familyGuess }">Aa</span>
                    <span class="motion-font-selector__option-name">{{ f.familyGuess }}</span>
                </button>
            </div>
        </div>
    </div>
</template>
