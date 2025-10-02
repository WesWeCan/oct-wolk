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

// Resizable panel state
const lyricsWidth = ref(parseInt(localStorage.getItem('lyric-analyzer-lyrics-width') || '50'))

const startResize = (e: PointerEvent) => {
    e.preventDefault()
    const container = (e.target as HTMLElement).closest('.editor-grid') as HTMLElement
    if (!container) return
    
    const onMove = (moveEvent: PointerEvent) => {
        const rect = container.getBoundingClientRect()
        const x = moveEvent.clientX - rect.left
        const percentage = Math.max(30, Math.min(70, (x / rect.width) * 100))
        lyricsWidth.value = percentage
        localStorage.setItem('lyric-analyzer-lyrics-width', percentage.toString())
    }
    
    const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
    }
    
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
}

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
    <div class="lyric-analyzer-page">
        <div class="page-header">
            <div class="header-content">
                <div class="title-section">
                    <RouterLink to="/song-bank" class="back-link">← Back to Song Bank</RouterLink>
                    <h1>Lyric Analyzer</h1>
                    <p class="subtitle">Analyze lyrics and build your word bank</p>
                </div>
                <div class="header-actions">
                    <button @click="undo" :disabled="historyStack.length === 0" title="Undo">↶ Undo</button>
                    <button @click="redo" :disabled="futureStack.length === 0" title="Redo">↷ Redo</button>
                </div>
            </div>
        </div>

        <div v-if="!song" class="loading-state">
            <div class="spinner"></div>
            <p>Loading song...</p>
        </div>

        <div v-else class="page-content">
            <details class="song-data-section" open>
                <summary>
                    <span class="summary-icon">📝</span>
                    <span class="summary-text">Song Details</span>
                </summary>
                <div class="section-content">
                    <SongData v-model:song="song" />
                </div>
            </details>

            <div class="editor-grid" :style="{ '--lyrics-width': `${lyricsWidth}%` }">
                <div class="lyrics-panel">
                    <div class="panel-header">
                        <h2>Lyrics</h2>
                        <p class="panel-hint">Double-click words to add them to the word bank</p>
                    </div>
                    <div class="panel-content">
                        <TipTapLyricAnalyzer v-model:song="song" :hovered-word="hoveredWord" @hover-word="hoverWord"/>
                    </div>
                </div>
                
                <div class="panel-resizer" @pointerdown="startResize"></div>
                
                <div class="wordbank-panel">
                    <div class="panel-header">
                        <h2>Word Bank</h2>
                        <p class="panel-hint">Organize words into groups for the editor</p>
                    </div>
                    <div class="panel-content">
                        <WordBank v-model:song="song" :hovered-word="hoveredWord" @hover-word="hoverWord" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>