<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeaderFileActions from '@/front-end/components/AppHeaderFileActions.vue';

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

onMounted(async () => {
    getLuckyNumber();
    window.electronAPI.on('projects:imported', (payload: { projectId?: string }) => {
        if (!payload?.projectId) return;
        router.push({ name: 'ProjectEditor', params: { projectId: payload.projectId } });
    });
});

onUnmounted(() => {
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