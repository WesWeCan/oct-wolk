import { type Ref, computed } from 'vue';
import type { TimelineDocument } from '@/types/timeline_types';
import type { useTimelinePlayback } from './useTimelinePlayback';
import type { useAudioAnalysis } from './useAudioAnalysis';

/**
 * Navigation direction for timeline
 */
export type NavigationDirection = 'prevKf' | 'nextKf' | 'prevBeat' | 'nextBeat';

/**
 * Composable for timeline navigation
 * 
 * Handles navigation to:
 * - Previous/next keyframes (word pool markers)
 * - Previous/next beats
 */
export function useTimelineNavigation(
  timeline: Ref<TimelineDocument | null>,
  playback: ReturnType<typeof useTimelinePlayback>,
  audioAnalysis: ReturnType<typeof useAudioAnalysis>,
  fps: Ref<number>,
  onScrub: (payload: { timeSec: number; frame: number }) => void
) {
  /**
   * Get all word pool keyframe positions (sorted)
   */
  const keyframePositions = computed(() => {
    const track = timeline.value?.wordsPoolTrack;
    
    if (!Array.isArray(track?.keyframes)) return [];
    
    return (track.keyframes as any[])
      .map((k: any) => Math.max(0, (k.frame | 0)))
      .sort((a: number, b: number) => a - b);
  });
  
  /**
   * Get all beat times (sorted)
   */
  const beatTimes = computed(() => {
    return audioAnalysis.beatTimesSec.value.slice().sort((a, b) => a - b);
  });
  
  /**
   * Convert frame to seconds
   */
  const frameToSec = (frame: number): number => {
    return frame / Math.max(1, fps.value);
  };
  
  /**
   * Convert seconds to frame
   */
  const secToFrame = (timeSec: number): number => {
    return Math.max(0, Math.round(timeSec * Math.max(1, fps.value)));
  };
  
  /**
   * Navigate to previous keyframe
   */
  const goToPrevKeyframe = () => {
    const kf = keyframePositions.value;
    if (!kf.length) return;
    
    const currentFrame = playback.frame.value;
    const prev = [...kf].reverse().find((f: number) => f < currentFrame);
    
    if (typeof prev === 'number') {
      onScrub({ timeSec: frameToSec(prev), frame: prev });
    }
  };
  
  /**
   * Navigate to next keyframe
   */
  const goToNextKeyframe = () => {
    const kf = keyframePositions.value;
    if (!kf.length) return;
    
    const currentFrame = playback.frame.value;
    const next = kf.find((f: number) => f > currentFrame);
    
    if (typeof next === 'number') {
      onScrub({ timeSec: frameToSec(next), frame: next });
    }
  };
  
  /**
   * Navigate to previous beat
   */
  const goToPrevBeat = () => {
    const beats = beatTimes.value;
    if (!beats.length) return;
    
    const currentTime = frameToSec(playback.frame.value);
    const prev = [...beats].reverse().find((b: number) => b < currentTime);
    
    if (typeof prev === 'number') {
      onScrub({ timeSec: prev, frame: secToFrame(prev) });
    }
  };
  
  /**
   * Navigate to next beat
   */
  const goToNextBeat = () => {
    const beats = beatTimes.value;
    if (!beats.length) return;
    
    const currentTime = frameToSec(playback.frame.value);
    const next = beats.find((b: number) => b > currentTime);
    
    if (typeof next === 'number') {
      onScrub({ timeSec: next, frame: secToFrame(next) });
    }
  };
  
  /**
   * Navigate in the specified direction
   */
  const navigateTo = (direction: NavigationDirection) => {
    switch (direction) {
      case 'prevKf':
        goToPrevKeyframe();
        break;
      case 'nextKf':
        goToNextKeyframe();
        break;
      case 'prevBeat':
        goToPrevBeat();
        break;
      case 'nextBeat':
        goToNextBeat();
        break;
    }
  };
  
  return {
    navigateTo,
    goToPrevKeyframe,
    goToNextKeyframe,
    goToPrevBeat,
    goToNextBeat
  };
}


