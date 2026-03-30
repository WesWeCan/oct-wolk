<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeaderFileActions from '@/front-end/components/AppHeaderFileActions.vue';
import { RENDERER_MENU_COMMAND_EVENT, type ProjectEditorCommandId } from '@/shared/projectEditorCommands';

const router = useRouter();

const openExternal = (url: string) => {
     console.log('openExternal', url);
    //  window.electronAPI.openExternal(url);
 }

const openStorageFolder = async () => {
    try {
        await window.electronAPI.openStorageFolder();
    } catch (error) {
        console.error('Error opening storage folder:', error);
    }
}

 const luckyNumber = ref(-1);
 const menuCounter = ref(0);
let removeMenuCommandListener: (() => void) | null = null;

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

onMounted(async () => {
    getLuckyNumber();

    removeMenuCommandListener = window.electronAPI.onMenuCommand((commandId) => {
        menuCounter.value += 1;

        if (tryExecuteEditableCommand(commandId)) {
            return;
        }

        dispatchRendererMenuCommand(commandId);
    });

    window.electronAPI.on('projects:imported', (payload: { projectId?: string }) => {
        if (!payload?.projectId) return;
        router.push({ name: 'ProjectEditor', params: { projectId: payload.projectId } });
    });
});

onUnmounted(() => {
    removeMenuCommandListener?.();
    removeMenuCommandListener = null;
    window.electronAPI.removeAllListeners('projects:imported');
});


const getLuckyNumber = async () => {
    try {
        console.log('Calling window.electronAPI.getRandomNumber()...');
        const number = await window.electronAPI.getRandomNumber();
        console.log('Received number:', number);
        luckyNumber.value = number;
    } catch (error) {
        console.error('Error calling getRandomNumber:', error);
    }
}



</script>

<template>
    <header>
        <router-link to="/" exact>Home</router-link>
        <div class="spacer"></div>
        <AppHeaderFileActions />
        <button @click="openStorageFolder" class="open-folder-btn" title="Open storage folder">
            📁 Open Folder
        </button>
    </header>
    <RouterView></RouterView>
</template>