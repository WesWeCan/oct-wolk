<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Song } from '@/types/song_types';
import { SongService } from '@/front-end/services/SongService';

const router = useRouter();
const songs = ref<Song[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const sortBy = ref<'date-desc' | 'date-asc' | 'title-asc' | 'title-desc'>('date-desc');
const deletingId = ref<string | null>(null);

const loadSongs = async () => {
    loading.value = true;
    try {
        const list = await SongService.list();
        songs.value = list;
    } finally {
        loading.value = false;
    }
};

const filteredAndSortedSongs = computed(() => {
    let result = songs.value;
    
    // Filter by search query
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(s => 
            (s.title || 'Untitled').toLowerCase().includes(query) ||
            s.id.toLowerCase().includes(query)
        );
    }
    
    // Sort
    result = [...result].sort((a, b) => {
        switch (sortBy.value) {
            case 'date-desc':
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            case 'date-asc':
                return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            case 'title-asc':
                return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
            case 'title-desc':
                return (b.title || 'Untitled').localeCompare(a.title || 'Untitled');
            default:
                return 0;
        }
    });
    
    return result;
});

const createNew = async () => {
    const created = await SongService.create({ title: 'New Word Bank' });
    router.push({ name: 'LyricAnalyzer', params: { songId: created.id } });
};

const duplicateSong = async (song: Song) => {
    const duplicated = await SongService.create({ 
        title: `${song.title || 'Untitled'} (Copy)`,
    });
    await loadSongs();
};

const confirmDelete = (id: string) => {
    deletingId.value = id;
};

const cancelDelete = () => {
    deletingId.value = null;
};

const deleteSong = async (id: string) => {
    // TODO: Implement delete functionality when available in SongService
    console.warn('Delete functionality not yet implemented');
    deletingId.value = null;
};

const formatDate = (dateString: string | number) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const openSong = (id: string) => {
    router.push({ name: 'LyricAnalyzer', params: { songId: id } });
};

onMounted(() => {
    document.title = 'Word Bank - W.O.L.K.';
    loadSongs();
});
</script>

<template>
    <div class="song-bank-page">
        <div class="page-header">
            <div class="header-content">
                <div class="title-section">
                    <RouterLink to="/" class="back-link">← Home</RouterLink>
                    <h1>Song Bank</h1>
                    <p class="subtitle">Manage your lyrics and word collections</p>
                </div>
                <button @click="createNew" class="create-btn primary">+ Create New Word Bank</button>
            </div>
        </div>

        <div class="page-content">
            <div class="controls-bar">
                <div class="search-box">
                    <input 
                        v-model="searchQuery" 
                        type="search" 
                        placeholder="Search word banks..." 
                        class="search-input"
                    />
                </div>
                <div class="sort-controls">
                    <label for="sort-select">Sort by:</label>
                    <select id="sort-select" v-model="sortBy" class="sort-select">
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="title-asc">Title (A-Z)</option>
                        <option value="title-desc">Title (Z-A)</option>
                    </select>
                </div>
                <div class="results-count">
                    {{ filteredAndSortedSongs.length }} {{ filteredAndSortedSongs.length === 1 ? 'item' : 'items' }}
                </div>
            </div>

            <div v-if="loading" class="loading-state">
                <div class="spinner"></div>
                <p>Loading word banks...</p>
            </div>

            <div v-else-if="!songs.length" class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>No word banks yet</h3>
                <p>Create your first word bank to start organizing lyrics</p>
                <button @click="createNew" class="create-btn primary">+ Create New Word Bank</button>
            </div>

            <div v-else-if="!filteredAndSortedSongs.length" class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>No word banks found</h3>
                <p>Try a different search term</p>
            </div>

            <div v-else class="banks-grid">
                <div 
                    v-for="song in filteredAndSortedSongs" 
                    :key="song.id" 
                    class="bank-card"
                    :class="{ 'deleting': deletingId === song.id }"
                >
                    <div class="card-content" @click="openSong(song.id)">
                        <div class="card-image" :style="{ backgroundImage: song.imageSrc ? `url(${song.imageSrc})` : 'none' }">
                            <div v-if="!song.imageSrc" class="placeholder-icon">📝</div>
                        </div>
                        <div class="card-info">
                            <h3 class="card-title">{{ song.title || 'Untitled' }}</h3>
                            <div class="card-meta">
                                <span class="meta-date">{{ formatDate(song.updatedAt) }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div v-if="deletingId === song.id" class="delete-confirm">
                        <p>Delete this word bank?</p>
                        <div class="confirm-actions">
                            <button @click.stop="deleteSong(song.id)" class="danger">Delete</button>
                            <button @click.stop="cancelDelete">Cancel</button>
                        </div>
                    </div>
                    
                    <div v-else class="card-actions">
                        <button @click.stop="duplicateSong(song)" class="action-btn" title="Duplicate">
                            <span>⎘</span>
                        </button>
                        <button @click.stop="confirmDelete(song.id)" class="action-btn danger" title="Delete">
                            <span>×</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>