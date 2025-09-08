<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { SongService } from '@/front-end/services/SongService';
import type { Song } from '@/types/song_types';

const router = useRouter();
const songs = ref<Song[]>([]);
const loading = ref(false);

const loadSongs = async () => {
    loading.value = true;
    try {
        songs.value = await SongService.list();
    } finally {
        loading.value = false;
    }
};

const openSong = async (id: string) => {
    await router.push({ name: 'Editor', params: { songId: id } });
};

const createNewSong = async () => {
    const created = await SongService.create({ title: 'Untitled' });
    await router.push({ name: 'Editor', params: { songId: created.id } });
};

onMounted(async () => {
    document.title = 'Editor - Select Song';
    await loadSongs();
});

</script>

<template>
    <div class="editor">
        <div class="editor__toolbar">
            <h3>Select a song</h3>
            <div style="margin-left:auto; display:flex; gap:8px;">
                <button @click="createNewSong">Create New Song</button>
            </div>
        </div>
        <div class="editor__sidebar">
            <h3>Songs</h3>
            <div v-if="loading">Loading…</div>
            <ul v-else>
                <li v-for="s in songs" :key="s.id" style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 0;">
                    <div>
                        <div style="font-weight:600;">{{ s.title }}</div>
                        <div style="opacity:.7; font-size:12px;">{{ s.id }}</div>
                    </div>
                    <button @click="openSong(s.id)">Open</button>
                </li>
            </ul>
        </div>
    </div>
</template>


