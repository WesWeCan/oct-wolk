<script setup lang="ts">
import { onMounted, ref } from 'vue';


const openExternal = (url: string) => {

     console.log('openExternal', url);
    //  window.electronAPI.openExternal(url);
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
    <header style="display:flex; gap:12px; align-items:center; padding:10px 16px; border-bottom:1px solid #222;">
        <router-link to="/" style="text-decoration:none; font-weight:700;">Home</router-link>
        <router-link to="/song-bank" style="text-decoration:none;">Song Bank</router-link>
        <router-link to="/editor" style="text-decoration:none;">Editor</router-link>
        <div style="margin-left:auto; opacity:.7; font-size:12px;">Lucky: {{ luckyNumber }}</div>
    </header>
    <RouterView></RouterView>
</template>