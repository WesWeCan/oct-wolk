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
        audioEl.value.preload = 'metadata'; // Load metadata first
        
        // Setup event listeners
        audioEl.value.addEventListener('loadedmetadata', () => {
            // metadata loaded
        });
        
        audioEl.value.addEventListener('canplay', () => {
            audioReady.value = true;
        });
        
        audioEl.value.addEventListener('timeupdate', () => {
            if (audioEl.value) {
                currentTime.value = audioEl.value.currentTime;
            }
        });
        
        audioEl.value.addEventListener('ended', () => {
            // Audio playback ended naturally
        });
        
        audioEl.value.addEventListener('error', (e) => {
            console.error('[useAudioPlayer] Audio error:', e, audioEl.value?.error);
        });
        
        // Wait for metadata to load
        return new Promise<void>((resolve) => {
            const el = audioEl.value!;
            if (el.readyState >= 1) { // HAVE_METADATA
                resolve();
            } else {
                const onMetadata = () => {
                    resolve();
                };
                el.addEventListener('loadedmetadata', onMetadata, { once: true });
                // Timeout fallback
                setTimeout(() => {
                    el.removeEventListener('loadedmetadata', onMetadata);
                    resolve();
                }, 5000);
            }
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
            // ignore
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
     * 
     * IMPORTANT: For custom protocols (like wolk://), audio elements may ignore
     * seek attempts while paused. This function temporarily unpauses the audio,
     * performs the seek, then re-pauses it if it was originally paused.
     * 
     * @param seconds - Target time in seconds
     * @returns Promise that resolves when seek completes
     */
    const seekTo = (seconds: number): Promise<void> => {
        if (!audioEl.value || !Number.isFinite(seconds)) {
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            const el = audioEl.value!;
            const targetTime = Math.max(0, seconds);
            
            // If already at target, resolve immediately
            if (Math.abs(el.currentTime - targetTime) < 0.001) {
                resolve();
                return;
            }
            
            // Wait for audio to be seekable (readyState >= 2)
            const attemptSeek = () => {
                try {
                    // Check if audio has enough data to seek
                    // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
                    if (el.readyState < 2) {
                        // Wait for loadeddata event
                        const onLoadedData = () => {
                            el.removeEventListener('loadeddata', onLoadedData);
                            performSeek();
                        };
                        el.addEventListener('loadeddata', onLoadedData);
                        return;
                    }
                    
                    performSeek();
                } catch (e) {
                    // ignore
                    resolve();
                }
            };
            
            const performSeek = async () => {
                let resolved = false;
                const wasPaused = el.paused;
                
                // Timeout fallback in case seeked event doesn't fire
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        el.removeEventListener('seeked', onSeeked);
                        if (wasPaused) {
                            el.pause();
                        }
                        resolve();
                    }
                }, 1000);
                
                // Listen for seeked event
                const onSeeked = () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        el.removeEventListener('seeked', onSeeked);
                        // Restore paused state if it was paused before
                        if (wasPaused) {
                            el.pause();
                        }
                        resolve();
                    }
                };
                
                el.addEventListener('seeked', onSeeked);
                
                // CRITICAL: Some browsers/protocols require audio to be playing to accept seeks
                // Temporarily unpause if needed, then restore pause state after seek
                if (wasPaused) {
                    try {
                        await el.play();
                    } catch (e) {
                        // Play may fail (autoplay policy, etc.) - that's ok, seek might still work
                    }
                    // Give the audio a moment to start playing
                    await new Promise(r => setTimeout(r, 50));
                }
                
                el.currentTime = targetTime;
            };
            
            attemptSeek();
        });
    };
    
    /**
     * Audio duration in seconds (0 if not loaded).
     */
    const duration = computed(() => {
        const dur = audioEl.value?.duration;
        return Number.isFinite(dur) ? dur! : 0;
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
