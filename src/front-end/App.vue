<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MotionPresetService } from '@/front-end/services/MotionPresetService';
import { ProjectService } from '@/front-end/services/ProjectService';
import type { AppMenuAction } from '@/shared/appMenuActions';
import { RENDERER_MENU_COMMAND_EVENT, type ProjectEditorCommandId } from '@/shared/projectEditorCommands';

const router = useRouter();
const route = useRoute();

const openStorageFolder = async () => {
    try {
        await window.electronAPI.openStorageFolder();
    } catch (error) {
        console.error('Error opening storage folder:', error);
    }
}

const busyMenuAction = ref<string | null>(null);
let removeMenuCommandListener: (() => void) | null = null;
let removeAppMenuActionListener: (() => void) | null = null;

const isEditableElement = (element: Element | null): boolean => {
    if (!element) return false;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLElement && element.isContentEditable) return true;
    return !!element.closest('.ProseMirror');
};

const tryExecuteEditableCommand = (commandId: ProjectEditorCommandId): boolean => {
    if (!isEditableElement(document.activeElement)) return false;

    const editableCommands: Partial<Record<ProjectEditorCommandId, string>> = {
        'edit.undo': 'undo',
        'edit.redo': 'redo',
        'edit.cut': 'cut',
        'edit.copy': 'copy',
        'edit.paste': 'paste',
        'edit.delete': 'delete',
    };

    const command = editableCommands[commandId];
    if (!command) return false;

    return document.execCommand(command);
};

const dispatchRendererMenuCommand = (commandId: ProjectEditorCommandId) => {
    window.dispatchEvent(new CustomEvent(RENDERER_MENU_COMMAND_EVENT, {
        detail: commandId,
    }));
};

const currentProjectId = (): string => (
    route.name === 'ProjectEditor' ? String(route.params.projectId || '') : ''
);

const syncMenuContext = async () => {
    await window.electronAPI.setMenuContext({
        hasProjectRoute: route.name === 'ProjectEditor',
    });
};

const runMenuAction = async (actionName: string, callback: () => Promise<void>) => {
    if (busyMenuAction.value) return;
    busyMenuAction.value = actionName;

    try {
        await callback();
    } catch (error) {
        console.error(`[menu] ${actionName} failed`, error);
    } finally {
        busyMenuAction.value = null;
    }
};

const handleAppMenuAction = async (action: AppMenuAction) => {
    switch (action.type) {
        case 'file.newProject':
            await runMenuAction(action.type, async () => {
                const created = await ProjectService.create({ title: 'New Project' });
                await router.push({ name: 'ProjectEditor', params: { projectId: created.id } });
            });
            return;
        case 'file.openProjectArchive':
            await runMenuAction(action.type, async () => {
                const result = await ProjectService.importWolk();
                if (result.canceled || result.error || !result.project) {
                    if (result.error) throw new Error(result.error);
                    return;
                }
                await router.push({ name: 'ProjectEditor', params: { projectId: result.project.id } });
            });
            return;
        case 'file.exportProjectArchive':
            await runMenuAction(action.type, async () => {
                const projectId = currentProjectId();
                if (!projectId) return;
                const result = await ProjectService.exportWolk(projectId);
                if (result.error) throw new Error(result.error);
            });
            return;
        case 'file.importPresetBundle':
            await runMenuAction(action.type, async () => {
                const result = await MotionPresetService.importBundle();
                if (result.error) throw new Error(result.error);
            });
            return;
        case 'file.exportPresetBundle':
            await runMenuAction(action.type, async () => {
                const result = await MotionPresetService.exportBundle();
                if (result.error) throw new Error(result.error);
            });
            return;
        case 'file.openRecent':
            await router.push({ name: 'ProjectEditor', params: { projectId: action.projectId } });
            return;
        case 'app.showProjects':
            await router.push({ name: 'Index' });
            return;
        case 'app.openStorageFolder':
            await openStorageFolder();
            return;
    }
};

onMounted(async () => {
    await syncMenuContext();

    removeMenuCommandListener = window.electronAPI.onMenuCommand((commandId) => {
        if (tryExecuteEditableCommand(commandId)) {
            return;
        }

        dispatchRendererMenuCommand(commandId);
    });
    removeAppMenuActionListener = window.electronAPI.onAppMenuAction((action) => {
        void handleAppMenuAction(action);
    });

    window.electronAPI.on('projects:imported', (payload: { projectId?: string }) => {
        if (!payload?.projectId) return;
        router.push({ name: 'ProjectEditor', params: { projectId: payload.projectId } });
    });
});

watch(() => route.name, () => {
    void syncMenuContext();
});

onUnmounted(() => {
    removeMenuCommandListener?.();
    removeMenuCommandListener = null;
    removeAppMenuActionListener?.();
    removeAppMenuActionListener = null;
    window.electronAPI.removeAllListeners('projects:imported');
});
</script>

<template>
    <header>
        <router-link to="/" exact>Home</router-link>
        <div class="spacer"></div>
        <button @click="openStorageFolder" class="open-folder-btn" title="Open storage folder">
            📁 Open Folder
        </button>
    </header>
    <RouterView></RouterView>
</template>