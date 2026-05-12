<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MotionPresetService } from '@/front-end/services/MotionPresetService';
import { ProjectService } from '@/front-end/services/ProjectService';
import type { AppMenuAction } from '@/shared/appMenuActions';
import {
    RENDERER_MENU_COMMAND_EVENT,
    type NativeEditCommandId,
    type ProjectEditorCommandId,
    type ProjectEditorMenuContext,
} from '@/shared/projectEditorCommands';

const router = useRouter();
const route = useRoute();

const openStorageFolder = async () => {
    try {
        await window.electronAPI.openStorageFolder();
    } catch (error) {
        console.error('Error opening storage folder:', error);
    }
};

const busyMenuAction = ref<string | null>(null);
const hasEditableFocus = ref(false);
let removeMenuCommandListener: (() => void) | null = null;
let removeAppMenuActionListener: (() => void) | null = null;
let removeProjectsImportedListener: (() => void) | null = null;

const editableCommands: Partial<Record<ProjectEditorCommandId, NativeEditCommandId>> = {
    'edit.undo': 'undo',
    'edit.redo': 'redo',
    'edit.cut': 'cut',
    'edit.copy': 'copy',
    'edit.paste': 'paste',
    'edit.delete': 'delete',
};

const isEditableElement = (element: Element | null): boolean => {
    if (!element) return false;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLElement && element.isContentEditable) return true;
    return !!element.closest('.ProseMirror');
};

const tryExecuteEditableCommand = async (commandId: ProjectEditorCommandId): Promise<boolean> => {
    if (!isEditableElement(document.activeElement)) return false;

    const command = editableCommands[commandId];
    if (!command) return false;

    try {
        await window.electronAPI.performNativeEditCommand(command);
    } catch (error) {
        console.error(`[menu] native edit command failed: ${command}`, error);
    }

    return true;
};

const dispatchRendererMenuCommand = (commandId: ProjectEditorCommandId) => {
    window.dispatchEvent(new CustomEvent(RENDERER_MENU_COMMAND_EVENT, {
        detail: commandId,
    }));
};

const currentProjectId = (): string => (
    route.name === 'ProjectEditor' ? String(route.params.projectId || '') : ''
);

const syncMenuContext = async (context: Partial<ProjectEditorMenuContext> = {}) => {
    await window.electronAPI.setMenuContext({
        hasProjectRoute: route.name === 'ProjectEditor',
        hasEditableFocus: hasEditableFocus.value,
        ...context,
    });
};

const updateEditableFocus = () => {
    const next = isEditableElement(document.activeElement);
    if (hasEditableFocus.value === next) return;

    hasEditableFocus.value = next;
    void syncMenuContext({ hasEditableFocus: next });
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
        void (async () => {
            if (await tryExecuteEditableCommand(commandId)) {
                return;
            }

            dispatchRendererMenuCommand(commandId);
        })();
    });
    window.addEventListener('focusin', updateEditableFocus);
    window.addEventListener('focusout', updateEditableFocus);
    removeAppMenuActionListener = window.electronAPI.onAppMenuAction((action) => {
        void handleAppMenuAction(action);
    });

    removeProjectsImportedListener = window.electronAPI.onProjectsImported((payload) => {
        if (!payload?.projectId) return;
        router.push({ name: 'ProjectEditor', params: { projectId: payload.projectId } });
    });
});

watch(() => route.name, () => {
    void syncMenuContext();
});

onUnmounted(() => {
    window.removeEventListener('focusin', updateEditableFocus);
    window.removeEventListener('focusout', updateEditableFocus);
    removeMenuCommandListener?.();
    removeMenuCommandListener = null;
    removeAppMenuActionListener?.();
    removeAppMenuActionListener = null;
    removeProjectsImportedListener?.();
    removeProjectsImportedListener = null;
});
</script>

<template>
    <RouterView></RouterView>
</template>