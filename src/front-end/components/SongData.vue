<script setup lang="ts">

import { Song } from '@/types/song_types'
import { SongService } from '@/front-end/services/SongService'
import { AVWaveform } from 'vue-audio-visual'


const song = defineModel<Song>('song')

const onCoverSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0 || !song.value) return
    const file = input.files[0]
    const updated = await SongService.uploadCover(song.value.id, file)
    song.value = updated
}

const onAudioSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement
    if (!input.files || input.files.length === 0 || !song.value) return
    const file = input.files[0]
    const updated = await SongService.uploadAudio(song.value.id, file)
    song.value = updated
}

</script>

<template>
    <div class="song-data" v-if="song">
        <div class="form-group">
            <label for="song-title">Song Title</label>
            <input type="text" id="song-title" v-model="song!.title" :disabled="!song" placeholder="Enter song title">
        </div>
        <div class="form-group">
            <label for="song-subtitle">Song Subtitle</label>
            <input type="text" id="song-subtitle" v-model="song!.subtitle" :disabled="!song" placeholder="Enter subtitle (optional)">
        </div>

        <div class="form-group cover-upload">
            <label>Cover Image</label>
            <div v-if="song!.imageSrc" class="file-preview">
                <img :src="song!.imageSrc" alt="Cover" class="preview-image" />
                <div class="preview-overlay">
                    <label for="song-cover" class="replace-btn">
                        <span>📷 Replace Image</span>
                        <input type="file" id="song-cover" accept="image/*" @change="onCoverSelected" :disabled="!song" style="display: none;">
                    </label>
                </div>
            </div>
            <div v-else class="file-upload-area">
                <label for="song-cover-initial" class="upload-label">
                    <span class="upload-icon">📷</span>
                    <span class="upload-text">Click to upload cover image</span>
                    <span class="upload-hint">PNG, JPG, or WebP</span>
                    <input type="file" id="song-cover-initial" accept="image/*" @change="onCoverSelected" :disabled="!song" style="display: none;">
                </label>
            </div>
        </div>

        <div class="form-group audio-upload">
            <label>Audio File</label>
            <div v-if="song!.audioSrc" class="file-preview audio">
                <div class="audio-player">
                    <audio :src="song!.audioSrc" controls></audio>
                </div>
                <label for="song-audio" class="replace-btn secondary">
                    <span>🎵 Replace Audio</span>
                    <input type="file" id="song-audio" accept="audio/*" @change="onAudioSelected" :disabled="!song" style="display: none;">
                </label>
            </div>
            <div v-else class="file-upload-area">
                <label for="song-audio-initial" class="upload-label">
                    <span class="upload-icon">🎵</span>
                    <span class="upload-text">Click to upload audio file</span>
                    <span class="upload-hint">MP3, WAV, or OGG</span>
                    <input type="file" id="song-audio-initial" accept="audio/*" @change="onAudioSelected" :disabled="!song" style="display: none;">
                </label>
            </div>
        </div>
    </div>
</template>


