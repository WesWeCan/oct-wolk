import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, h, ref } from 'vue';
import { useLaneInteractions } from '@/front-end/components/timeline/useLaneInteractions';

describe('useLaneInteractions', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
  });

  const mountLane = (onScrub: ReturnType<typeof vi.fn>) => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const viewport = { startSec: 10, durationSec: 5, fps: 30 };

    const app = createApp({
      setup() {
        const laneRef = ref<HTMLElement | null>(null);
        useLaneInteractions(laneRef, {
          getViewport: () => viewport,
          onPan: () => {},
          onZoom: () => {},
          onScrub,
          enableScrub: true,
        });
        return { laneRef };
      },
      render() {
        return h('div', { ref: 'laneRef' });
      },
    });

    app.mount(host);
    const lane = host.firstElementChild as HTMLElement;

    Object.defineProperty(lane, 'clientWidth', { value: 200, configurable: true });
    lane.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 0,
        width: 200,
        height: 40,
        right: 300,
        bottom: 40,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    return { app, host, lane };
  };

  const pointerEvent = (type: string, clientX: number, pointerId = 1) => {
    const e = new Event(type, { bubbles: true }) as PointerEvent;
    Object.defineProperty(e, 'clientX', { value: clientX });
    Object.defineProperty(e, 'pointerId', { value: pointerId });
    return e;
  };

  it('clamps scrub to left edge while dragging', () => {
    const onScrub = vi.fn();
    const { app, host, lane } = mountLane(onScrub);

    lane.dispatchEvent(pointerEvent('pointerdown', 0)); // localX = -100 -> clamp 0

    expect(onScrub).toHaveBeenCalledTimes(1);
    expect(onScrub).toHaveBeenLastCalledWith(10, 300);

    app.unmount();
    host.remove();
  });

  it('clamps scrub to right edge while dragging', () => {
    const onScrub = vi.fn();
    const { app, host, lane } = mountLane(onScrub);

    lane.dispatchEvent(pointerEvent('pointerdown', 120)); // start drag
    lane.dispatchEvent(pointerEvent('pointermove', 500)); // localX = 400 -> clamp 200

    expect(onScrub).toHaveBeenCalledTimes(2);
    expect(onScrub).toHaveBeenLastCalledWith(15, 450);

    app.unmount();
    host.remove();
  });

  it('does not scrub on move when pointer is not down', () => {
    const onScrub = vi.fn();
    const { app, host, lane } = mountLane(onScrub);

    lane.dispatchEvent(pointerEvent('pointermove', 500));

    expect(onScrub).not.toHaveBeenCalled();

    app.unmount();
    host.remove();
  });
});
