<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Song } from '@/types/song_types';
import { SongService } from '@/front-end/services/SongService';

const router = useRouter()
const songs = ref<Song[]>([])

const loadSongs = async () => {
    const list = await SongService.list()
    songs.value = list
}

const createNew = async () => {
    const created = await SongService.create()
    router.push({ name: 'LyricAnalyzer', params: { songId: created.id } })
}

onMounted(() => {
    document.title = 'Word Bank - Words On Live Kanvas - Open Culture Tech';
    loadSongs()
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
                <button @click="createNew">+ Create New Word Bank</button>
            </div>
            <div class="song-item" v-for="s in songs" :key="s.id" @click="router.push({ name: 'LyricAnalyzer', params: { songId: s.id } })" style="cursor: pointer;">
                <div class="song-item-image" :style="{ backgroundImage: `url(${s.imageSrc || ''})` }">
                </div>
                <div class="song-item-content">
                    <h2>{{ s.title || 'Untitled' }}</h2>
                    <p>{{ new Date(s.updatedAt).toLocaleString() }}</p>
                </div>
            </div>
        </div>



    </div>
</template>