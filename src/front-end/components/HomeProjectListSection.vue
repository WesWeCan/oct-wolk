<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiMusicNote, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
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
        result = result.filter(project =>
            (project.song.title || 'Untitled').toLowerCase().includes(q) ||
            project.id.toLowerCase().includes(q)
        );
    }

    result = [...result].sort((a, b) => {
        switch (sortBy.value) {
            case 'date-desc':
                return (b.updatedAt || 0) - (a.updatedAt || 0);
            case 'date-asc':
                return (a.updatedAt || 0) - (b.updatedAt || 0);
            case 'title-asc':
                return (a.song.title || '').localeCompare(b.song.title || '');
            case 'title-desc':
                return (b.song.title || '').localeCompare(a.song.title || '');
            default:
                return 0;
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
            projects.value = projects.value.filter(project => project.id !== id);
        }
    } catch (error) {
        console.error('Error deleting project:', error);
    }
    deletingId.value = null;
};

const formatLastEdited = (ts: number) => {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(ts));
};

const formatLyricTrackCount = (count: number) => {
    return `${count} lyric track${count === 1 ? '' : 's'}`;
};

onMounted(() => {
    loadProjects();
});
</script>

<template>
    <section class="home-projects">
        <div class="home-projects__header">
            <div class="home-projects__title-block">
          
                <h2 class="home-projects__title">My Projects</h2>
            </div>

            <button @click="createNew" class="create-btn primary home-projects__create">
                <SvgIcon type="mdi" :path="mdiPlus" :size="14" />
                <span>New Project</span>
            </button>
        </div>

        <div class="home-projects__controls">
            <div class="search-box">
                <input
                    v-model="searchQuery"
                    type="search"
                    placeholder="Search projects..."
                    class="search-input"
                />
            </div>

            <div class="sort-controls">
                <label for="home-project-sort">Sort by:</label>
                <select id="home-project-sort" v-model="sortBy" class="sort-select">
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
            <div class="empty-icon">
                <SvgIcon type="mdi" :path="mdiMusicNote" :size="36" />
            </div>
            <h3>No projects yet</h3>
            <p>Create your first project to start building lyric visuals</p>
            <button @click="createNew" class="create-btn primary">
                <SvgIcon type="mdi" :path="mdiPlus" :size="14" />
                <span>New Project</span>
            </button>
        </div>

        <div v-else-if="!filteredAndSorted.length" class="empty-state empty-state--compact">
            <h3>No projects found</h3>
            <p>Try a different search term</p>
        </div>

        <div v-else class="home-projects__list">
            <article
                v-for="project in filteredAndSorted"
                :key="project.id"
                class="project-row"
                :class="{ deleting: deletingId === project.id }"
            >
                <div class="project-row__content" @click="openProject(project.id)">
                    <div
                        class="project-row__image"
                        :style="{ backgroundImage: project.song.coverSrc ? `url(${project.song.coverSrc})` : 'none' }"
                    >
                        <div v-if="!project.song.coverSrc" class="placeholder-icon">
                            <SvgIcon type="mdi" :path="mdiMusicNote" :size="24" />
                        </div>
                    </div>

                    <div class="project-row__info">
                        <h3 class="project-row__title">{{ project.song.title || 'Untitled' }}</h3>
                        <div class="project-row__meta">
                            <span class="project-row__meta-item project-row__meta-item--date">
                                <span class="meta-label">Last edited</span>
                                <span class="meta-value">{{ formatLastEdited(project.updatedAt) }}</span>
                            </span>
                            <span v-if="project.lyricTracks.length" class="project-row__meta-item">
                                <span class="meta-value">{{ formatLyricTrackCount(project.lyricTracks.length) }}</span>
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

                <div v-else class="project-row__actions">
                    <button @click.stop="confirmDelete(project.id)" class="action-btn danger" title="Delete">
                        <SvgIcon type="mdi" :path="mdiTrashCanOutline" :size="14" />
                    </button>
                </div>
            </article>
        </div>
    </section>
</template>
