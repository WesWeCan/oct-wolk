<script setup lang="ts">
import { onMounted, ref } from 'vue';

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
    
    
    // window.electronAPI.onUpdateMenuCounter((value) => {
    //     menuCounter.value += value;
    // });

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
        <router-link to="/projects">Projects</router-link>
        <div class="spacer"></div>
        <button @click="openStorageFolder" class="open-folder-btn" title="Open storage folder">
            📁 Open Folder
        </button>
    </header>
    <RouterView></RouterView>
</template>