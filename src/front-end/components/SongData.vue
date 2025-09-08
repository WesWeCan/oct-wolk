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
            <input type="text" id="song-title" v-model="song!.title" :disabled="!song">
        </div>
        <div class="form-group">
            <label for="song-subtitle">Song Subtitle</label>
            <input type="text" id="song-subtitle" v-model="song!.subtitle" :disabled="!song">
        </div>

        <div class="form-group">
            <label for="song-cover">Cover Image</label>
            <input type="file" id="song-cover" accept="image/*" @change="onCoverSelected" :disabled="!song">
            <div v-if="song!.imageSrc" style="margin-top: 8px;">
                <img :src="song!.imageSrc" alt="Cover" style="max-width: 200px; height: auto;" />
            </div>
        </div>

        <div class="form-group">
            <label for="song-audio">Audio File</label>
            <input type="file" id="song-audio" accept="audio/*" @change="onAudioSelected" :disabled="!song">
            <div v-if="song!.audioSrc" style="margin-top: 8px;">
                <audio :src="song!.audioSrc" controls></audio>
            </div>
        </div>

        <!-- https://www.npmjs.com/package/vue-audio-visual#install -->
        <AVWaveform :src="song!.audioSrc" ></AVWaveform>
    </div>
</template>


