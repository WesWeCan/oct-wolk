<script setup lang="ts">
import { useHeaderFileActions } from '@/front-end/composables/useHeaderFileActions';

const {
    busyAction,
    canExportProject,
    controlsDisabled,
    errorMessage,
    statusMessage,
    importProject,
    exportProject,
    importPresets,
    exportPresets,
} = useHeaderFileActions();
</script>

<template>
    <div class="header-file-actions">
        <button
            class="open-folder-btn"
            :disabled="controlsDisabled"
            title="Import a .wolk project archive"
            @click="importProject"
        >
            Import .wolk
        </button>
        <button
            class="open-folder-btn"
            :disabled="!canExportProject"
            title="Export the current project as a .wolk archive"
            @click="exportProject"
        >
            {{ busyAction === 'export-project' ? 'Exporting...' : 'Export .wolk' }}
        </button>
        <button
            class="open-folder-btn"
            :disabled="controlsDisabled"
            title="Import a .wolkdpreset or .wolkpresets archive"
            @click="importPresets"
        >
            Import Preset
        </button>
        <button
            class="open-folder-btn"
            :disabled="controlsDisabled"
            title="Export all saved motion presets"
            @click="exportPresets"
        >
            {{ busyAction === 'export-presets' ? 'Exporting...' : 'Export Presets' }}
        </button>
        <span v-if="errorMessage" class="header-file-actions__message header-file-actions__message--error">
            {{ errorMessage }}
        </span>
        <span v-else-if="statusMessage" class="header-file-actions__message">
            {{ statusMessage }}
        </span>
    </div>
</template>
