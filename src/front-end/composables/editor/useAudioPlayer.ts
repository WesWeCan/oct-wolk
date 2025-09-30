import { ref, shallowRef, computed, onUnmounted } from 'vue';

/**
 * Audio playback management for the editor.
 * 
 * Responsibilities:
 * - Audio element lifecycle management
 * - Playback controls (play/pause/stop)
 * - Seek operations
 * - Ready state tracking
 * - Duration tracking
 * 
 * @example
 * ```typescript
 * const audio = useAudioPlayer();
 * await audio.load('path/to/audio.mp3');
 * await audio.play();
 * audio.seekTo(30); // Seek to 30 seconds
 * ```
 */
export function useAudioPlayer() {
    const audioEl = shallowRef<HTMLAudioElement | null>(null);
    const audioReady = ref(false);
    const currentTime = ref(0);
    
    /**
     * Loads an audio file from URL or custom protocol (e.g., wolk://).
     * Disposes any previously loaded audio.
     */
    const load = async (src: string) => {
        // Dispose previous audio element
        if (audioEl.value) {
            audioEl.value.pause();
            audioEl.value.src = '';
        }
        
        audioReady.value = false;
        
        // Create new audio element
        audioEl.value = new Audio(src);
        audioEl.value.preload = 'auto';
        
        // Setup event listeners
        audioEl.value.addEventListener('canplay', () => {
            console.log('[useAudioPlayer] canplay event fired, duration:', audioEl.value?.duration);
            audioReady.value = true;
        });
        
        audioEl.value.addEventListener('loadedmetadata', () => {
            console.log('[useAudioPlayer] loadedmetadata event fired, duration:', audioEl.value?.duration);
        });
        
        audioEl.value.addEventListener('timeupdate', () => {
            if (audioEl.value) {
                currentTime.value = audioEl.value.currentTime;
            }
        });
        
        audioEl.value.addEventListener('ended', () => {
            // Audio playback ended naturally
        });
    };
    
    /**
     * Starts audio playback.
     * @returns Promise that resolves when playback starts
     */
    const play = async () => {
        if (!audioEl.value || !audioReady.value) return;
        
        try {
            await audioEl.value.play();
        } catch (e) {
            console.warn('Audio play failed:', e);
        }
    };
    
    /**
     * Pauses audio playback.
     */
    const pause = () => {
        audioEl.value?.pause();
    };
    
    /**
     * Stops playback and resets to beginning.
     */
    const stop = () => {
        pause();
        seekTo(0);
    };
    
    /**
     * Seeks to a specific time in the audio.
     * @param seconds - Target time in seconds
     */
    const seekTo = (seconds: number) => {
        if (!audioEl.value || !Number.isFinite(seconds)) return;
        
        try {
            audioEl.value.currentTime = Math.max(0, seconds);
        } catch (e) {
            console.warn('Seek failed:', e);
        }
    };
    
    /**
     * Audio duration in seconds (0 if not loaded).
     */
    const duration = computed(() => {
        const dur = audioEl.value?.duration;
        const result = Number.isFinite(dur) ? dur! : 0;
        console.log('[useAudioPlayer] duration computed:', result, 'audioEl exists?', !!audioEl.value, 'raw duration:', dur);
        return result;
    });
    
    /**
     * Whether audio is currently playing.
     */
    const isPlaying = computed(() => {
        return audioEl.value ? !audioEl.value.paused : false;
    });
    
    /**
     * Disposes the audio element and cleans up resources.
     */
    const dispose = () => {
        if (audioEl.value) {
            audioEl.value.pause();
            audioEl.value.src = '';
            audioEl.value = null;
        }
        audioReady.value = false;
    };
    
    // Cleanup on unmount
    onUnmounted(() => {
        dispose();
    });
    
    return {
        audioEl,
        audioReady,
        currentTime,
        duration,
        isPlaying,
        load,
        play,
        pause,
        stop,
        seekTo,
        dispose,
    };
}
