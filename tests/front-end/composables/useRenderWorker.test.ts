import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

class MockWorker {
  listeners: Record<string, Function[]> = {};
  terminated = false;
  lastMessage: any = null;

  postMessage(msg: any) {
    this.lastMessage = msg;
  }
  addEventListener(type: string, handler: Function) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }
  removeEventListener(type: string, handler: Function) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(h => h !== handler);
    }
  }
  terminate() {
    this.terminated = true;
  }
  emit(type: string, data: any) {
    (this.listeners[type] || []).forEach(h => h({ data }));
  }
}

vi.stubGlobal('Worker', MockWorker);

describe('useRenderWorker (unit behavior)', () => {
  let canvasEl: HTMLCanvasElement;
  let offscreenCanvas: any;

  beforeEach(() => {
    offscreenCanvas = { width: 1920, height: 1080 };
    canvasEl = {
      width: 0,
      height: 0,
      transferControlToOffscreen: vi.fn(() => offscreenCanvas),
    } as any;
  });

  it('captureFrame resolves with blob on success', async () => {
    const { useRenderWorker } = await import('@/front-end/composables/editor/useRenderWorker');

    const canvas = ref<HTMLCanvasElement | null>(canvasEl);
    const w = ref(1920);
    const h = ref(1080);
    const rw = useRenderWorker(canvas, w, h);

    await rw.start();
    expect(rw.isReady.value).toBe(true);

    const worker = rw.workerRef.value as unknown as MockWorker;

    const capturePromise = rw.captureFrame(42);

    // Simulate worker response
    worker.emit('message', {
      type: 'frameCaptured',
      frame: 42,
      arrayBuffer: new ArrayBuffer(10),
    });

    const blob = await capturePromise;
    expect(blob).toBeInstanceOf(Blob);
  });

  it('captureFrame rejects on timeout', async () => {
    vi.useFakeTimers();
    const { useRenderWorker } = await import('@/front-end/composables/editor/useRenderWorker');

    const canvas = ref<HTMLCanvasElement | null>(canvasEl);
    const w = ref(1920);
    const h = ref(1080);
    const rw = useRenderWorker(canvas, w, h);

    await rw.start();

    const capturePromise = rw.captureFrame(99);
    vi.advanceTimersByTime(6000);

    await expect(capturePromise).rejects.toThrow('timeout');
    vi.useRealTimers();
  });

  it('dispose terminates worker and resets state', async () => {
    const { useRenderWorker } = await import('@/front-end/composables/editor/useRenderWorker');

    const canvas = ref<HTMLCanvasElement | null>(canvasEl);
    const w = ref(1920);
    const h = ref(1080);
    const rw = useRenderWorker(canvas, w, h);

    await rw.start();
    const worker = rw.workerRef.value as unknown as MockWorker;

    rw.dispose();
    expect(worker.terminated).toBe(true);
    expect(rw.isReady.value).toBe(false);
    expect(rw.workerRef.value).toBeNull();
  });
});
