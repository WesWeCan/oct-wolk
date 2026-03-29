import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArchiveService } from '@/front-end/services/ArchiveService';

export const useHeaderFileActions = () => {
    const route = useRoute();
    const router = useRouter();
    const busyAction = ref<string | null>(null);
    const statusMessage = ref('');
    const errorMessage = ref('');

    const currentProjectId = computed(() => {
        return route.name === 'ProjectEditor' ? String(route.params.projectId || '') : '';
    });
    const canExportProject = computed(() => !!currentProjectId.value && !busyAction.value);
    const controlsDisabled = computed(() => !!busyAction.value);

    const clearMessages = () => {
        statusMessage.value = '';
        errorMessage.value = '';
    };

    const runAction = async (actionName: string, callback: () => Promise<void>) => {
        if (busyAction.value) return;
        busyAction.value = actionName;
        clearMessages();
        try {
            await callback();
        } catch (error) {
            errorMessage.value = String(error);
        } finally {
            busyAction.value = null;
        }
    };

    const importProject = async () => {
        await runAction('import-project', async () => {
            const result = await ArchiveService.importProject();
            if (result.canceled) return;
            if (result.error) {
                throw new Error(result.error);
            }
            if (!result.project) {
                throw new Error('Project import did not return a project.');
            }
            statusMessage.value = `Imported "${result.project.song.title || 'Untitled'}".`;
            await router.push({ name: 'ProjectEditor', params: { projectId: result.project.id } });
        });
    };

    const exportProject = async () => {
        if (!currentProjectId.value) return;
        await runAction('export-project', async () => {
            const result = await ArchiveService.exportProject(currentProjectId.value);
            if (result.canceled) return;
            if (result.error) {
                throw new Error(result.error);
            }
            statusMessage.value = result.filePath
                ? `Exported .wolk to ${result.filePath}.`
                : 'Project exported.';
        });
    };

    const importPresets = async () => {
        await runAction('import-presets', async () => {
            const result = await ArchiveService.importPresets();
            if (result.canceled) return;
            if (result.error) {
                throw new Error(result.error);
            }
            const importedCount = result.imported?.length ?? 0;
            statusMessage.value = importedCount > 0
                ? `Imported ${importedCount} preset${importedCount === 1 ? '' : 's'}.`
                : 'No presets were imported.';
        });
    };

    const exportPresets = async () => {
        await runAction('export-presets', async () => {
            const result = await ArchiveService.exportPresetBundle();
            if (result.canceled) return;
            if (result.error) {
                throw new Error(result.error);
            }
            statusMessage.value = result.filePath
                ? `Exported ${result.exportedCount ?? 0} preset${result.exportedCount === 1 ? '' : 's'} to ${result.filePath}.`
                : 'Preset bundle exported.';
        });
    };

    return {
        busyAction,
        canExportProject,
        controlsDisabled,
        errorMessage,
        statusMessage,
        importProject,
        exportProject,
        importPresets,
        exportPresets,
        clearMessages,
    };
};
