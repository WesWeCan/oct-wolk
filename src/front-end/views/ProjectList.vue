<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import type { WolkProject } from '@/types/project_types';
import { ProjectService } from '@/front-end/services/ProjectService';

const router = useRouter();
const projects = ref<WolkProject[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const sortBy = ref<'date-desc' | 'date-asc' | 'title-asc' | 'title-desc'>('date-desc');
const deletingId = ref<string | null>(null);

const loadProjects = async () => {
    loading.value = true;
    try {
        projects.value = await ProjectService.list();
    } finally {
        loading.value = false;
    }
};

const filteredAndSorted = computed(() => {
    let result = projects.value;

    if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(p =>
            (p.song.title || 'Untitled').toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q)
        );
    }

    result = [...result].sort((a, b) => {
        switch (sortBy.value) {
            case 'date-desc': return (b.updatedAt || 0) - (a.updatedAt || 0);
            case 'date-asc':  return (a.updatedAt || 0) - (b.updatedAt || 0);
            case 'title-asc': return (a.song.title || '').localeCompare(b.song.title || '');
            case 'title-desc': return (b.song.title || '').localeCompare(a.song.title || '');
            default: return 0;
        }
    });

    return result;
});

const createNew = async () => {
    const created = await ProjectService.create({ title: 'New Project' });
    router.push({ name: 'ProjectEditor', params: { projectId: created.id } });
};

const openProject = (id: string) => {
    router.push({ name: 'ProjectEditor', params: { projectId: id } });
};

const confirmDelete = (id: string) => {
    deletingId.value = id;
};

const cancelDelete = () => {
    deletingId.value = null;
};

const deleteProject = async (id: string) => {
    try {
        const ok = await ProjectService.delete(id);
        if (ok) {
            projects.value = projects.value.filter(p => p.id !== id);
        }
    } catch (error) {
        console.error('Error deleting project:', error);
    }
    deletingId.value = null;
};

const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

onMounted(() => {
    document.title = 'Projects - W.O.L.K.';
    loadProjects();
});
</script>

<template>
    <div class="song-bank-page">
        <div class="page-header">
            <div class="header-content">
                <div class="title-section">
                    <RouterLink to="/" class="back-link">&larr; Home</RouterLink>
                    <h1>Projects</h1>
                    <p class="subtitle">Create and manage lyric visual projects</p>
                </div>
                <button @click="createNew" class="create-btn primary">+ New Project</button>
            </div>
        </div>

        <div class="page-content">
            <div class="controls-bar">
                <div class="search-box">
                    <input
                        v-model="searchQuery"
                        type="search"
                        placeholder="Search projects..."
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
                    {{ filteredAndSorted.length }} {{ filteredAndSorted.length === 1 ? 'project' : 'projects' }}
                </div>
            </div>

            <div v-if="loading" class="loading-state">
                <div class="spinner"></div>
                <p>Loading projects...</p>
            </div>

            <div v-else-if="!projects.length" class="empty-state">
                <div class="empty-icon">&#127926;</div>
                <h3>No projects yet</h3>
                <p>Create your first project to start building lyric visuals</p>
                <button @click="createNew" class="create-btn primary">+ New Project</button>
            </div>

            <div v-else-if="!filteredAndSorted.length" class="empty-state">
                <h3>No projects found</h3>
                <p>Try a different search term</p>
            </div>

            <div v-else class="banks-grid">
                <div
                    v-for="project in filteredAndSorted"
                    :key="project.id"
                    class="bank-card"
                    :class="{ deleting: deletingId === project.id }"
                >
                    <div class="card-content" @click="openProject(project.id)">
                        <div
                            class="card-image"
                            :style="{ backgroundImage: project.song.coverSrc ? `url(${project.song.coverSrc})` : 'none' }"
                        >
                            <div v-if="!project.song.coverSrc" class="placeholder-icon">&#127926;</div>
                        </div>
                        <div class="card-info">
                            <h3 class="card-title">{{ project.song.title || 'Untitled' }}</h3>
                            <div class="card-meta">
                                <span class="meta-date">{{ formatDate(project.updatedAt) }}</span>
                                <span v-if="project.lyricTracks.length" class="meta-tracks">
                                    {{ project.lyricTracks.length }} track{{ project.lyricTracks.length === 1 ? '' : 's' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div v-if="deletingId === project.id" class="delete-confirm">
                        <p>Delete this project?</p>
                        <div class="confirm-actions">
                            <button @click.stop="deleteProject(project.id)" class="danger">Delete</button>
                            <button @click.stop="cancelDelete">Cancel</button>
                        </div>
                    </div>

                    <div v-else class="card-actions">
                        <button @click.stop="confirmDelete(project.id)" class="action-btn danger" title="Delete">
                            <span>&times;</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
