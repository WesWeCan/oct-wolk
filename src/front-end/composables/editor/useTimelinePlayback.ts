import { ref, type Ref } from 'vue';

/**
 * Timeline playback management.
 * 
 * Responsibilities:
 * - Frame-based playback loop (requestAnimationFrame)
 * - Play/pause/stop controls
 * - Frame tracking and timing
 * - Audio sync (optional)
 * 
 * @param fps - Frames per second
 * @param maxFrame - Maximum frame number (computed from audio duration)
 * 
 * @example
 * ```typescript
 * const playback = useTimelinePlayback(fps, maxFrame);
 * 
 * playback.onTick((frame, dt) => {
 *     // Render this frame
 *     console.log(`Frame ${frame}, delta ${dt}s`);
 * });
 * 
 * playback.play();
 * ```
 */
export function useTimelinePlayback(
    fps: Ref<number>,
    maxFrame: Ref<number>
) {
    const frame = ref(0);
    const playing = ref(false);
    
    let lastTime = 0;
    let rafId: number | null = null;
    let tickCallback: ((frame: number, dt: number) => void) | null = null;
    
    /**
     * Playback loop (runs via requestAnimationFrame).
     */
    const tick = (now: number) => {
        if (!playing.value) {
            rafId = null;
            return;
        }
        
        // Calculate delta time
        const dt = lastTime ? (now - lastTime) / 1000 : 0;
        lastTime = now;
        
        // Advance frame
        frame.value += Math.max(1, Math.round(dt * fps.value));
        
        // Check if we've reached the end
        if (frame.value >= maxFrame.value) {
            frame.value = maxFrame.value;
            pause();
            return;
        }
        
        // Invoke tick callback
        tickCallback?.(frame.value, dt);
        
        // Continue loop
        rafId = requestAnimationFrame(tick);
    };
    
    /**
     * Starts playback from current frame.
     */
    const play = () => {
        if (playing.value) return;
        
        playing.value = true;
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
    };
    
    /**
     * Pauses playback at current frame.
     */
    const pause = () => {
        playing.value = false;
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };
    
    /**
     * Stops playback and resets to frame 0.
     */
    const stop = () => {
        pause();
        frame.value = 0;
        lastTime = 0;
    };
    
    /**
     * Scrubs to a specific frame.
     */
    const scrubToFrame = (targetFrame: number) => {
        frame.value = Math.max(0, Math.min(maxFrame.value, Math.floor(targetFrame)));
    };
    
    /**
     * Sets callback for each frame tick.
     */
    const onTick = (callback: (frame: number, dt: number) => void) => {
        tickCallback = callback;
    };
    
    return {
        frame,
        playing,
        play,
        pause,
        stop,
        scrubToFrame,
        onTick,
    };
}
