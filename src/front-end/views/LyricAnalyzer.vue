<script setup lang="ts">

import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import TipTapLyricAnalyzer from '../components/TipTapLyricAnalyzer.vue';
import { Song } from '@/types/song_types';
import WordBank from '../components/WordBank.vue';


const song = ref<Song>({
    title: '',
    subtitle: '',
    audioSrc: '',
    imageSrc: '',
    lyrics: '',
    wordBank: [],
    paragraphs: [],
    wordGroups: [],
})




onMounted(() => {
    document.title = 'Lyric Analyzer - Words On Live Kanvas - Open Culture Tech';
});




const hoveredWord = ref<string | null>(null);


const hoverWord = (word: string | null) => {
    if (!word) {
        hoveredWord.value = null;
        return;
    }
    console.log('hoverWord', word);
    hoveredWord.value = word;
}

</script>

<template>
    <header>
        <nav><RouterLink to="/song-bank">To Song Bank</RouterLink></nav>
    </header>
    <div class="lyric-analyzer">
        <h1>Lyric Analyzer</h1>


        <div class="song-data">
            <div class="form-group">
                <label for="song-title">Song Title</label>
                <input type="text" id="song-title" v-model="song.title">
            </div>
            <div class="form-group">
                <label for="song-subtitle">Song Subtitle</label>
                <input type="text" id="song-subtitle" v-model="song.subtitle">
            </div>
        </div>


        <div class="analyzer">
            <div class="lyrics">
                <TipTapLyricAnalyzer v-model:song="song" :hovered-word="hoveredWord" @hover-word="hoverWord"/>
            </div>
            <div class="words">
                <WordBank v-model:song="song" :hovered-word="hoveredWord" @hover-word="hoverWord" />
            </div>
            
        </div>




    </div>
</template>