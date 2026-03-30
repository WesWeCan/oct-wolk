<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SvgIcon from '@jamescoyle/vue-icon';
import { mdiImageOutline, mdiMusicNote, mdiTrayArrowUp } from '@mdi/js';
import type { WolkProject, WolkProjectSong } from '@/types/project_types';
import { ProjectService } from '@/front-end/services/ProjectService';

const props = defineProps<{
    projectId: string;
    song: WolkProjectSong;
    showHeader?: boolean;
}>();

const emit = defineEmits<{
    (e: 'projectUpdated', payload: { project: WolkProject; kind: 'audio' | 'cover' }): void;
}>();

const audioInputRef = ref<HTMLInputElement | null>(null);
const coverInputRef = ref<HTMLInputElement | null>(null);
const audioDragOver = ref(false);
const coverDragOver = ref(false);
const uploadingAudio = ref(false);
const uploadingCover = ref(false);
const currentAudioSrc = ref(props.song.audioSrc || '');
const currentCoverSrc = ref(props.song.coverSrc || '');

watch(() => props.song.audioSrc, value => {
    currentAudioSrc.value = value || '';
});

watch(() => props.song.coverSrc, value => {
    currentCoverSrc.value = value || '';
});

const coverStyle = computed(() => (
    currentCoverSrc.value
        ? { backgroundImage: `url(${currentCoverSrc.value})` }
        : undefined
));

const audioFileName = computed(() => {
    if (!currentAudioSrc.value) return 'No audio uploaded';
    return decodeURIComponent(currentAudioSrc.value.split('/').pop() || 'Audio uploaded');
});

const hasAudio = computed(() => !!currentAudioSrc.value);
const hasCover = computed(() => !!currentCoverSrc.value);
const coverActionLabel = computed(() => {
    if (coverDragOver.value) return 'Drop image';
    return hasCover.value ? 'Click to replace artwork' : 'Click to add artwork';
});

const IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i;
const AUDIO_FILE_PATTERN = /\.(mp3|wav|ogg|flac|aac|m4a)$/i;

const isImageFile = (file: File) => file.type.startsWith('image/') || IMAGE_FILE_PATTERN.test(file.name);
const isAudioFile = (file: File) => file.type.startsWith('audio/') || AUDIO_FILE_PATTERN.test(file.name);
const hasImagePayload = (event: DragEvent) => Array.from(event.dataTransfer?.items || []).some(item => item.kind === 'file' && item.type.startsWith('image/'));
const hasAudioPayload = (event: DragEvent) => Array.from(event.dataTransfer?.items || []).some(item => item.kind === 'file' && item.type.startsWith('audio/'));

const applyUpdatedProject = (updated: WolkProject, kind: 'audio' | 'cover') => {
    currentAudioSrc.value = updated.song.audioSrc || '';
    currentCoverSrc.value = updated.song.coverSrc || '';
    emit('projectUpdated', { project: updated, kind });
};

const handleAudioFile = async (file: File) => {
    if (uploadingAudio.value || !isAudioFile(file)) return;
    uploadingAudio.value = true;
    try {
        const updated = await ProjectService.uploadAudio(props.projectId, file);
        applyUpdatedProject(updated, 'audio');
    } catch (error) {
        console.error('Failed to upload audio file', error);
    } finally {
        uploadingAudio.value = false;
    }
};

const handleCoverFile = async (file: File) => {
    if (uploadingCover.value || !isImageFile(file)) return;
    uploadingCover.value = true;
    try {
        const updated = await ProjectService.uploadCover(props.projectId, file);
        applyUpdatedProject(updated, 'cover');
    } catch (error) {
        console.error('Failed to upload cover image', error);
    } finally {
        uploadingCover.value = false;
    }
};

const onAudioUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await handleAudioFile(file);
    input.value = '';
};

const onCoverUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await handleCoverFile(file);
    input.value = '';
};

const onAudioDrop = async (event: DragEvent) => {
    event.preventDefault();
    audioDragOver.value = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
        await handleAudioFile(file);
    }
};

const onCoverDrop = async (event: DragEvent) => {
    event.preventDefault();
    coverDragOver.value = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
        await handleCoverFile(file);
    }
};

const onAudioDragOver = (event: DragEvent) => {
    event.preventDefault();
    audioDragOver.value = hasAudioPayload(event);
};

const onCoverDragOver = (event: DragEvent) => {
    event.preventDefault();
    coverDragOver.value = hasImagePayload(event);
};

const onAudioDragLeave = () => {
    audioDragOver.value = false;
};

const onCoverDragLeave = () => {
    coverDragOver.value = false;
};
</script>

<template>
    <div class="sidebar-section song-media-panel">
        <div v-if="showHeader !== false" class="song-media-panel__header">
            <span class="song-media-panel__title">Media</span>
        </div>

        <div class="song-media-panel__body">
            <div class="song-media-panel__section">
                <span class="song-media-panel__meta-label">Audio</span>

                <button
                    v-if="hasAudio"
                    type="button"
                    class="song-media-panel__audio-card"
                    :disabled="uploadingAudio"
                    title="Replace audio file"
                    @click="audioInputRef?.click()"
                >
                    <span class="song-media-panel__audio-icon">
                        <SvgIcon type="mdi" :path="mdiMusicNote" :size="18" />
                    </span>
                    <span class="song-media-panel__audio-copy">
                        <span class="song-media-panel__audio-title">{{ audioFileName }}</span>
                        <span class="song-media-panel__audio-hint">Click to replace audio</span>
                    </span>
                </button>

                <div
                    v-else
                    class="audio-drop-zone song-media-panel__audio-drop-zone"
                    :class="{ 'drag-over': audioDragOver }"
                    @drop="onAudioDrop"
                    @dragover="onAudioDragOver"
                    @dragleave="onAudioDragLeave"
                    @click="audioInputRef?.click()"
                >
                    <span class="audio-drop-zone__icon">
                        <SvgIcon type="mdi" :path="mdiTrayArrowUp" :size="22" />
                    </span>
                    <span class="audio-drop-zone__text">Click or drag audio file here</span>
                    <span class="audio-drop-zone__hint">MP3, WAV, OGG, FLAC, AAC</span>
                </div>
            </div>

            <div class="song-media-panel__section">
                <span class="song-media-panel__meta-label">Artwork</span>

                <button
                    type="button"
                    class="song-media-panel__cover"
                    :class="{ 'drag-over': coverDragOver, 'has-cover': hasCover }"
                    :disabled="uploadingCover"
                    title="Add or replace album artwork"
                    @click="coverInputRef?.click()"
                    @drop="onCoverDrop"
                    @dragover="onCoverDragOver"
                    @dragleave="onCoverDragLeave"
                >
                    <div class="song-media-panel__cover-image" :style="coverStyle">
                        <div v-if="!hasCover" class="song-media-panel__cover-placeholder">
                            <SvgIcon type="mdi" :path="mdiImageOutline" :size="22" />
                            <span>Add artwork</span>
                        </div>
                    </div>
                    <span class="song-media-panel__cover-label">{{ coverActionLabel }}</span>
                </button>
            </div>
        </div>

        <input
            ref="coverInputRef"
            class="song-media-panel__cover-input"
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.gif,.avif,.bmp,.svg,image/*"
            style="display:none"
            @change="onCoverUpload"
        />
        <input
            ref="audioInputRef"
            class="song-media-panel__audio-input"
            type="file"
            accept=".mp3,.wav,.ogg,.flac,.aac,.m4a,audio/*"
            style="display:none"
            @change="onAudioUpload"
        />
    </div>
</template>
