<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink } from 'vue-router';

onMounted(() => {
   
    
    document.title = 'Word Bank - Words On Live Kanvas - Open Culture Tech';


});



</script>

<template>
    <header>
        <nav><RouterLink to="/">Home</RouterLink></nav>
    </header>
    
    <div class="song-bank">
        <h1>Word Bank</h1>


        <div class="song-list">
            <div class="song-item new">
                <RouterLink to="/lyric-analyzer">+ Create New Word Bank</RouterLink>
            </div>
            <div class="song-item" v-for="song in 4" :key="song">
                <div class="song-item-image" :style="{ backgroundImage: `url(#})` }">
                    
                </div>
                <div class="song-item-content">
                <h2>Song 1</h2>
                    <p>Artist 1</p>
                    <p>Genre 1</p>
                </div>
            </div>
        </div>



    </div>
</template>