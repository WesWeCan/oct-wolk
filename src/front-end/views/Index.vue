<script setup lang="ts">

import { onMounted } from 'vue';

onMounted(() => {
    document.title = 'Words On Live Kanvas - Open Culture Tech';
});

// const openStorageFolder = () => {
//     window.electronAPI.openStorageFolder();
// }

</script>

<template>

<div class="splash-screen">
    


    <img src="#" alt="Logo" class="logo">

    <section>
        <h1>Words On Live Kanvas</h1>
        <p>An open source platform for artists to create and canvasses with words.</p>
    </section>

   <nav>
    <RouterLink to="/song-bank">Song Bank</RouterLink>
    <RouterLink to="/editor">Editor</RouterLink>
    <RouterLink to="/player">Live Player</RouterLink>
   </nav>

   <footer>
    <span>Developed by:</span>
    <span>Context Undefined</span>
    <span>Cablai & RBJAN</span>
    <span>VJ BIKKEL</span>

    <span>Part of the Open Culture Tech 2.0 project by Thunderboom Records</span>
   </footer>

</div>


  

</template>