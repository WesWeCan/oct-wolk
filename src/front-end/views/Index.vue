<script setup lang="ts">


const openStorageFolder = () => {
    window.electronAPI.openStorageFolder();
}

</script>

<template>

<button @click="openStorageFolder">Open Storage folder</button>


  

</template>