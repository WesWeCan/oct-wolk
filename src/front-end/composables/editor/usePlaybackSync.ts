import { type Ref } from 'vue';
import type { useTimelinePlayback } from './useTimelinePlayback';
import type { useAudioPlayer } from './useAudioPlayer';
import type { useFrameRenderer } from './useFrameRenderer';

export function usePlaybackSync(
  fps: Ref<number>,
  playback: ReturnType<typeof useTimelinePlayback>,
  audioPlayer: ReturnType<typeof useAudioPlayer>,
  frameRenderer: ReturnType<typeof useFrameRenderer>,
  needsReconfigure: (frame: number) => boolean,
  configureWorkerScene: () => Promise<void>,
) {
  const setupTick = () => {
    playback.onTick((_frame, dt) => {
      let frameToRender = playback.frame.value;
      if (audioPlayer.audioEl.value) {
        const t = audioPlayer.audioEl.value.currentTime;
        frameToRender = Math.max(0, Math.round(t * Math.max(1, fps.value)));
        if (frameToRender !== playback.frame.value) {
          playback.scrubToFrame(frameToRender);
        }
      }

      if (needsReconfigure(frameToRender)) {
        configureWorkerScene();
      }

      frameRenderer.sendFrameToWorker(frameToRender, dt);
    });
  };

  const play = async (maxFrame: number, renderWorkerReady: boolean) => {
    if (!renderWorkerReady) return;
    if (maxFrame <= 0) return;

    if (audioPlayer.audioReady.value) {
      const timeSec = playback.frame.value / Math.max(1, fps.value);
      await audioPlayer.seekTo(timeSec);
      await audioPlayer.play();
    }

    playback.play();
  };

  const pause = () => {
    playback.pause();
    audioPlayer.pause();
  };

  const stop = (sendFrame: (frame: number, dt: number) => void, drawPreview: () => void) => {
    playback.stop();
    audioPlayer.stop();
    sendFrame(0, 0);
    requestAnimationFrame(() => drawPreview());
  };

  return {
    setupTick,
    play,
    pause,
    stop,
  };
}
