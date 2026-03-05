import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useAutoScroll } from '@/front-end/composables/timeline/useAutoScroll';

describe('useAutoScroll', () => {
  let rafCallback: FrameRequestCallback | null = null;
  let rafId = 0;

  beforeEach(() => {
    rafCallback = null;
    rafId = 0;

    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      rafCallback = cb;
      rafId += 1;
      return rafId;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  const makeElement = () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 1000, configurable: true });
    el.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 0,
        width: 1000,
        height: 40,
        right: 1100,
        bottom: 40,
        x: 100,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    return el;
  };

  it('caps left-edge speed when pointer is far outside lane', () => {
    const panBy = vi.fn();
    const autoScroll = useAutoScroll({
      containerRef: ref(makeElement()),
      getViewport: () => ({ startSec: 0, durationSec: 10, totalSec: 100 }),
      panBy,
    });

    autoScroll.update(-500); // first move starts RAF
    autoScroll.update(-500); // second move applies speed after start reset
    expect(autoScroll.isActive.value).toBe(true);
    expect(rafCallback).toBeTruthy();

    rafCallback?.(1000);
    rafCallback?.(1016);

    expect(panBy).toHaveBeenCalled();
    expect(panBy.mock.calls.at(-1)?.[0]).toBeCloseTo(-0.32, 2);
  });

  it('caps right-edge speed when pointer is far outside lane', () => {
    const panBy = vi.fn();
    const autoScroll = useAutoScroll({
      containerRef: ref(makeElement()),
      getViewport: () => ({ startSec: 0, durationSec: 10, totalSec: 100 }),
      panBy,
    });

    autoScroll.update(5000); // first move starts RAF
    autoScroll.update(5000); // second move applies speed after start reset
    expect(autoScroll.isActive.value).toBe(true);
    expect(rafCallback).toBeTruthy();

    rafCallback?.(1000);
    rafCallback?.(1016);

    expect(panBy).toHaveBeenCalled();
    expect(panBy.mock.calls.at(-1)?.[0]).toBeCloseTo(0.32, 2);
  });

  it('does not auto-pan in center zone', () => {
    const panBy = vi.fn();
    const autoScroll = useAutoScroll({
      containerRef: ref(makeElement()),
      getViewport: () => ({ startSec: 0, durationSec: 10, totalSec: 100 }),
      panBy,
    });

    autoScroll.update(600); // center (localX=500)

    expect(autoScroll.isActive.value).toBe(false);
    expect(rafCallback).toBeNull();
    expect(panBy).not.toHaveBeenCalled();
  });
});
