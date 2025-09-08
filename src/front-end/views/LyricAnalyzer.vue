<script setup lang="ts">

import { onMounted, ref, watch, onBeforeUnmount } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import TipTapLyricAnalyzer from '../components/TipTapLyricAnalyzer.vue';
import { Song } from '@/types/song_types';
import WordBank from '../components/WordBank.vue';
import SongData from '../components/SongData.vue';
import { SongService } from '@/front-end/services/SongService';


const song = ref<Song | null>(null)

const route = useRoute()
const router = useRouter()

type Snapshot = Song
const historyStack: Snapshot[] = []
const futureStack: Snapshot[] = []
const maxHistory = 50
let lastSnapshotAt = 0
const SNAPSHOT_MIN_MS = 300

const cloneSong = (s: Song): Song => JSON.parse(JSON.stringify(s))
const takeSnapshot = () => {
    if (!song.value) return
    const now = Date.now()
    if (now - lastSnapshotAt < SNAPSHOT_MIN_MS) return
    historyStack.push(cloneSong(song.value))
    if (historyStack.length > maxHistory) historyStack.shift()
    futureStack.length = 0
    lastSnapshotAt = now
}

const applySnapshot = (snap?: Snapshot) => {
    if (!snap) return
    song.value = cloneSong(snap)
}

const undo = () => {
    if (historyStack.length === 0) return
    const current = song.value ? cloneSong(song.value) : null
    const prev = historyStack.pop()
    if (current) futureStack.push(current)
    applySnapshot(prev)
}

const redo = () => {
    const next = futureStack.pop()
    if (!next) return
    const current = song.value ? cloneSong(song.value) : null
    if (current) historyStack.push(current)
    applySnapshot(next)
}


onMounted(async () => {
    document.title = 'Lyric Analyzer - Words On Live Kanvas - Open Culture Tech';
    const songId = (route.params as any).songId as string | undefined
    if (songId) {
        const loaded = await SongService.load(songId)
        if (loaded) song.value = loaded
    }
    if (!song.value) {
        const created = await SongService.create()
        song.value = created
        router.replace({ name: 'LyricAnalyzer', params: { songId: created.id } })
    }
    if (song.value) {
        lastSavedJson = JSON.stringify(song.value)
        takeSnapshot()
    }
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

let autosaveTimer: any = null
const AUTOSAVE_DELAY_MS = 1000
let lastSavedJson = ''

const scheduleAutosave = () => {
    if (!song.value) return
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(async () => {
        if (!song.value) return
        const currentJson = JSON.stringify(song.value)
        if (currentJson === lastSavedJson) return
        const saved = await SongService.save(song.value)
        song.value = saved
        lastSavedJson = JSON.stringify(saved)
    }, AUTOSAVE_DELAY_MS)
}

watch(song, () => {
    if (!song.value) return
    takeSnapshot()
    scheduleAutosave()
}, { deep: true })

onBeforeUnmount(() => {
    if (autosaveTimer) clearTimeout(autosaveTimer)
})

</script>

<template>
    <header>
        <nav><RouterLink to="/song-bank">To Song Bank</RouterLink></nav>
    </header>
    <div class="lyric-analyzer">
        <h1>Lyric Analyzer</h1>

        <div class="controls">
            <button @click="undo" :disabled="!song">Undo</button>
            <button @click="redo" :disabled="!song">Redo</button>
        </div>

        <SongData v-if="song" v-model:song="song!" />


        <div class="analyzer" v-if="song">
            <div class="lyrics">
                <TipTapLyricAnalyzer v-model:song="song!" :hovered-word="hoveredWord" @hover-word="hoverWord"/>
            </div>
            <div class="words">
                <WordBank v-model:song="song!" :hovered-word="hoveredWord" @hover-word="hoverWord" />
            </div>
            
        </div>

        <div v-else>Loading...</div>




    </div>
</template>