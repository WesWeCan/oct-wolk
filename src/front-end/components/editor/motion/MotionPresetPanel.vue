<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { MotionBlockPresetAdapter } from '@/front-end/motion-blocks/core/plugin-types';
import { MotionPresetService } from '@/front-end/services/MotionPresetService';
import type { MotionTrack, WolkProjectFont } from '@/types/project_types';
import type { MotionPresetSummary } from '@/types/motion_preset_types';

const props = defineProps<{
    motionTrack: MotionTrack;
    presetAdapter: MotionBlockPresetAdapter<any>;
    projectFont?: WolkProjectFont;
    disabled?: boolean;
    disabledMessage?: string;
}>();

const emit = defineEmits<{
    (e: 'update-track', track: MotionTrack): void;
}>();

const presets = ref<MotionPresetSummary[]>([]);
const selectedPresetId = ref('');
const presetName = ref('');
const errorMessage = ref('');
const statusMessage = ref('');
const loading = ref(false);
const saving = ref(false);
const applying = ref(false);
const deleting = ref(false);
const exporting = ref(false);

const blockType = computed(() => props.motionTrack.block.type);
const selectedPreset = computed(() => presets.value.find((preset) => preset.id === selectedPresetId.value) ?? null);
const actionDisabled = computed(() => !!props.disabled || loading.value || saving.value || applying.value || deleting.value || exporting.value);
const canSave = computed(() => !actionDisabled.value && presetName.value.trim().length > 0);
const hasSelection = computed(() => !!selectedPreset.value);
const emptyStateMessage = 'No saved presets yet. Save the current look to create one.';
const selectedPresetMeta = computed(() => {
    if (!selectedPreset.value) {
        if (presets.value.length === 0) return emptyStateMessage;
        return `${presets.value.length} saved preset${presets.value.length === 1 ? '' : 's'}. Select one to apply or overwrite it.`;
    }

    return `Selected: ${selectedPreset.value.name}. Updated ${new Date(selectedPreset.value.updatedAt).toLocaleString()}.`;
});

const clearMessages = () => {
    errorMessage.value = '';
    statusMessage.value = '';
};

const syncNameWithSelection = () => {
    if (selectedPreset.value) {
        presetName.value = selectedPreset.value.name;
    }
};

const loadPresetList = async () => {
    loading.value = true;
    clearMessages();

    try {
        presets.value = await MotionPresetService.list(blockType.value);
        if (selectedPresetId.value && !presets.value.some((preset) => preset.id === selectedPresetId.value)) {
            selectedPresetId.value = '';
        }
        if (!selectedPresetId.value && presets.value[0]) {
            selectedPresetId.value = presets.value[0].id;
        }
        syncNameWithSelection();
    } catch (error) {
        errorMessage.value = String(error);
    } finally {
        loading.value = false;
    }
};

const savePreset = async (presetId?: string) => {
    if (!canSave.value) return;

    saving.value = true;
    clearMessages();

    try {
        const saved = await MotionPresetService.save({
            id: presetId,
            blockType: blockType.value,
            version: props.presetAdapter.version,
            name: presetName.value.trim(),
            payload: props.presetAdapter.extractPayload(props.motionTrack, { projectFont: props.projectFont }),
        });

        statusMessage.value = presetId ? 'Preset updated.' : 'Preset saved.';
        await loadPresetList();
        selectedPresetId.value = saved.id;
        presetName.value = saved.name;
    } catch (error) {
        errorMessage.value = String(error);
    } finally {
        saving.value = false;
    }
};

const applyPreset = async () => {
    if (actionDisabled.value || !selectedPreset.value) return;

    applying.value = true;
    clearMessages();

    try {
        const document = await MotionPresetService.load(blockType.value, selectedPreset.value.id);
        if (!document) {
            throw new Error('Preset not found.');
        }

        const updatedTrack = props.presetAdapter.applyPreset(props.motionTrack, document as any, {
            projectFont: props.projectFont,
        });
        emit('update-track', updatedTrack);
        statusMessage.value = `Applied "${document.name}".`;
    } catch (error) {
        errorMessage.value = String(error);
    } finally {
        applying.value = false;
    }
};

const deletePreset = async () => {
    if (actionDisabled.value || !selectedPreset.value) return;
    if (!window.confirm(`Delete preset "${selectedPreset.value.name}"?`)) return;

    deleting.value = true;
    clearMessages();

    try {
        const deleted = await MotionPresetService.delete(blockType.value, selectedPreset.value.id);
        if (!deleted) {
            throw new Error('Preset could not be deleted.');
        }
        statusMessage.value = 'Preset deleted.';
        selectedPresetId.value = '';
        await loadPresetList();
    } catch (error) {
        errorMessage.value = String(error);
    } finally {
        deleting.value = false;
    }
};

const exportPreset = async () => {
    if (actionDisabled.value || !selectedPreset.value) return;

    exporting.value = true;
    clearMessages();

    try {
        const result = await MotionPresetService.exportOne(blockType.value, selectedPreset.value.id);
        if (result.canceled) return;
        if (result.error) {
            throw new Error(result.error);
        }
        statusMessage.value = result.filePath
            ? `Exported "${selectedPreset.value.name}" to ${result.filePath}.`
            : `Exported "${selectedPreset.value.name}".`;
    } catch (error) {
        errorMessage.value = String(error);
    } finally {
        exporting.value = false;
    }
};

watch(() => props.motionTrack.block.type, () => {
    selectedPresetId.value = '';
    presetName.value = '';
    void loadPresetList();
});

watch(selectedPresetId, () => {
    clearMessages();
    syncNameWithSelection();
});

onMounted(() => {
    void loadPresetList();
});
</script>

<template>
    <div class="motion-preset-panel">
        <p v-if="disabledMessage" class="inspector-hint">{{ disabledMessage }}</p>

        <div class="inspector-field motion-preset-panel__save-row">
            <label>Preset Name</label>
            <div class="motion-preset-panel__save-controls">
                <input
                    v-model="presetName"
                    class="inspector-input"
                    type="text"
                    placeholder="My motion preset"
                    :disabled="actionDisabled"
                />
                <button class="btn-sm" :disabled="!canSave" @click="savePreset()">
                    {{ saving ? 'Saving...' : 'Save New' }}
                </button>
            </div>
        </div>

        <div class="inspector-field motion-preset-panel__preset-list">
            <label>Saved Presets</label>
            <div v-if="presets.length > 0" class="motion-preset-panel__chips">
                <button
                    v-for="preset in presets"
                    :key="preset.id"
                    class="chip motion-preset-panel__chip"
                    :class="{ 'motion-preset-panel__chip--selected': preset.id === selectedPresetId }"
                    :disabled="loading"
                    @click="selectedPresetId = preset.id"
                >
                    {{ preset.name }}
                </button>
            </div>
            <p v-else class="inspector-hint motion-preset-panel__empty-state">
                {{ emptyStateMessage }}
            </p>
            <span v-if="presets.length > 0" class="inspector-hint">
                {{ selectedPresetMeta }}
            </span>
        </div>

        <div class="inspector-row motion-preset-panel__action-row">
            <button class="btn-sm" :disabled="actionDisabled || !hasSelection" @click="applyPreset()">
                {{ applying ? 'Applying...' : 'Apply' }}
            </button>
            <button class="btn-sm" :disabled="!canSave || !hasSelection" @click="savePreset(selectedPresetId)">
                {{ saving && hasSelection ? 'Saving...' : 'Overwrite' }}
            </button>
            <button class="btn-sm" :disabled="actionDisabled || !hasSelection" @click="exportPreset()">
                {{ exporting ? 'Exporting...' : 'Export' }}
            </button>
            <button class="btn-sm" :disabled="loading" @click="loadPresetList()">
                Refresh
            </button>
            <button class="btn-sm danger motion-preset-panel__delete-btn" :disabled="actionDisabled || !hasSelection" @click="deletePreset()">
                {{ deleting ? 'Deleting...' : 'Delete' }}
            </button>
        </div>

        <p v-if="errorMessage" class="inspector-hint" style="color: #e57373;">{{ errorMessage }}</p>
        <p v-else-if="statusMessage" class="inspector-hint">{{ statusMessage }}</p>
    </div>
</template>

<style scoped>
.motion-preset-panel {
    display: grid;
    gap: 10px;
}

.motion-preset-panel__save-row {
    margin-bottom: 0;
}

.motion-preset-panel__save-controls {
    display: flex;
    gap: 8px;
    align-items: center;
}

.motion-preset-panel__save-controls .inspector-input {
    flex: 1 1 auto;
    min-width: 0;
}

.motion-preset-panel__preset-list {
    margin-bottom: 0;
}

.motion-preset-panel__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 6px;
}

.motion-preset-panel__chip {
    max-width: 100%;
}

.motion-preset-panel__chip--selected {
    outline: 1px solid rgba(255, 255, 255, 0.45);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.motion-preset-panel__chip--selected:disabled {
    opacity: 1;
}

.motion-preset-panel__action-row {
    flex-wrap: wrap;
    margin-top: 0;
    gap: 10px;
}

.motion-preset-panel__delete-btn {
    margin-left: auto;
}

.motion-preset-panel__empty-state {
    margin: 0 0 6px;
}
</style>
