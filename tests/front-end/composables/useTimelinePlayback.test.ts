import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTimelinePlayback } from '@/front-end/composables/editor/useTimelinePlayback';

vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(performance.now()), 16) as unknown as number;
});
vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));

describe('useTimelinePlayback', () => {
  const fps = ref(60);
  const maxFrame = ref(300);

  beforeEach(() => {
    fps.value = 60;
    maxFrame.value = 300;
  });

  it('initializes at frame 0, not playing', () => {
    const pb = useTimelinePlayback(fps, maxFrame);
    expect(pb.frame.value).toBe(0);
    expect(pb.playing.value).toBe(false);
  });

  it('scrubToFrame clamps within range', () => {
    const pb = useTimelinePlayback(fps, maxFrame);
    pb.scrubToFrame(150);
    expect(pb.frame.value).toBe(150);

    pb.scrubToFrame(-10);
    expect(pb.frame.value).toBe(0);

    pb.scrubToFrame(9999);
    expect(pb.frame.value).toBe(300);
  });

  it('stop resets to frame 0', () => {
    const pb = useTimelinePlayback(fps, maxFrame);
    pb.scrubToFrame(100);
    pb.stop();
    expect(pb.frame.value).toBe(0);
    expect(pb.playing.value).toBe(false);
  });

  it('play sets playing to true', () => {
    const pb = useTimelinePlayback(fps, maxFrame);
    pb.play();
    expect(pb.playing.value).toBe(true);
    pb.pause();
  });

  it('pause sets playing to false', () => {
    const pb = useTimelinePlayback(fps, maxFrame);
    pb.play();
    pb.pause();
    expect(pb.playing.value).toBe(false);
  });

  it('does not play twice when already playing', () => {
    const pb = useTimelinePlayback(fps, maxFrame);
    pb.play();
    pb.play(); // should be no-op
    expect(pb.playing.value).toBe(true);
    pb.pause();
  });

  it('onTick callback receives frame and dt', async () => {
    const pb = useTimelinePlayback(fps, maxFrame);
    const calls: Array<{ frame: number; dt: number }> = [];
    pb.onTick((frame, dt) => {
      calls.push({ frame, dt });
    });
    pb.play();

    await new Promise(r => setTimeout(r, 60));
    pb.pause();

    expect(calls.length).toBeGreaterThan(0);
    expect(typeof calls[0].frame).toBe('number');
    expect(typeof calls[0].dt).toBe('number');
  });

  it('stops at maxFrame and pauses', async () => {
    maxFrame.value = 2;
    const pb = useTimelinePlayback(fps, maxFrame);
    pb.play();

    await new Promise(r => setTimeout(r, 100));

    expect(pb.frame.value).toBeLessThanOrEqual(2);
    expect(pb.playing.value).toBe(false);
  });
});
