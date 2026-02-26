import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { usePlaybackSync } from '@/front-end/composables/editor/usePlaybackSync';

vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(performance.now()), 16) as unknown as number;
});

describe('usePlaybackSync', () => {
  let fps: ReturnType<typeof ref<number>>;
  let mockPlayback: any;
  let mockAudioPlayer: any;
  let mockFrameRenderer: any;
  let needsReconfigure: ReturnType<typeof vi.fn>;
  let configureWorkerScene: ReturnType<typeof vi.fn>;
  let sync: ReturnType<typeof usePlaybackSync>;

  beforeEach(() => {
    fps = ref(60);
    mockPlayback = {
      frame: ref(0),
      playing: ref(false),
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      scrubToFrame: vi.fn(),
      onTick: vi.fn(),
    };
    mockAudioPlayer = {
      audioEl: ref(null),
      audioReady: ref(false),
      seekTo: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
    };
    mockFrameRenderer = {
      sendFrameToWorker: vi.fn(),
    };
    needsReconfigure = vi.fn().mockReturnValue(false);
    configureWorkerScene = vi.fn();

    sync = usePlaybackSync(
      fps,
      mockPlayback,
      mockAudioPlayer,
      mockFrameRenderer,
      needsReconfigure,
      configureWorkerScene,
    );
  });

  it('setupTick registers onTick callback', () => {
    sync.setupTick();
    expect(mockPlayback.onTick).toHaveBeenCalledOnce();
  });

  it('play does nothing if worker not ready', async () => {
    await sync.play(300, false);
    expect(mockPlayback.play).not.toHaveBeenCalled();
  });

  it('play does nothing if maxFrame is 0', async () => {
    await sync.play(0, true);
    expect(mockPlayback.play).not.toHaveBeenCalled();
  });

  it('play starts playback when worker ready and maxFrame > 0', async () => {
    await sync.play(300, true);
    expect(mockPlayback.play).toHaveBeenCalledOnce();
  });

  it('play syncs audio when audioReady', async () => {
    mockAudioPlayer.audioReady.value = true;
    mockPlayback.frame.value = 60;
    await sync.play(300, true);
    expect(mockAudioPlayer.seekTo).toHaveBeenCalledWith(1);
    expect(mockAudioPlayer.play).toHaveBeenCalled();
  });

  it('pause stops both playback and audio', () => {
    sync.pause();
    expect(mockPlayback.pause).toHaveBeenCalled();
    expect(mockAudioPlayer.pause).toHaveBeenCalled();
  });

  it('stop resets everything and sends frame 0', () => {
    const sendFrame = vi.fn();
    const drawPreview = vi.fn();
    sync.stop(sendFrame, drawPreview);
    expect(mockPlayback.stop).toHaveBeenCalled();
    expect(mockAudioPlayer.stop).toHaveBeenCalled();
    expect(sendFrame).toHaveBeenCalledWith(0, 0);
  });
});
