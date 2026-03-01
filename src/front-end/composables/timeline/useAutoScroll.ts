import { ref, type Ref } from 'vue';

export interface AutoScrollOptions {
    containerRef: Ref<HTMLElement | null>;
    getViewport: () => { startSec: number; durationSec: number; totalSec: number };
    panBy: (secDelta: number) => void;
    /** Fraction of container width for each hot zone (default 0.10 = 10%) */
    hotZoneFraction?: number;
    /** Max pan speed in viewport-widths per second (default 2.0) */
    maxSpeed?: number;
}

/**
 * Provides velocity-curved edge auto-scrolling during drag operations.
 *
 * Call `update(clientX)` on every pointermove during a drag.
 * Call `stop()` on pointerup / pointercancel.
 * Returns `clampedX(clientX)` to get a clamped local-X within the visible viewport
 * so the dragged element doesn't extrapolate wildly past the edges.
 */
export function useAutoScroll(opts: AutoScrollOptions) {
    const hotZone = opts.hotZoneFraction ?? 0.10;
    const maxSpeed = opts.maxSpeed ?? 2.0;

    let rafId: number | null = null;
    let lastTimestamp = 0;
    let currentSpeed = 0; // sec/sec, negative = scroll left

    const isActive = ref(false);

    const tick = (timestamp: number) => {
        if (!isActive.value) return;
        const dt = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 0;
        lastTimestamp = timestamp;

        if (Math.abs(currentSpeed) > 1e-6) {
            opts.panBy(currentSpeed * dt);
        }

        rafId = requestAnimationFrame(tick);
    };

    const start = () => {
        if (isActive.value) return;
        isActive.value = true;
        lastTimestamp = 0;
        currentSpeed = 0;
        rafId = requestAnimationFrame(tick);
    };

    const stop = () => {
        isActive.value = false;
        currentSpeed = 0;
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    /**
     * Call on every pointermove during drag. Updates scroll speed based on
     * cursor proximity to edges. Returns clamped localX within visible bounds.
     */
    const update = (clientX: number): number => {
        const el = opts.containerRef.value;
        if (!el) return clientX;

        const rect = el.getBoundingClientRect();
        const localX = clientX - rect.left;
        const w = rect.width;
        const hotW = w * hotZone;
        const vp = opts.getViewport();
        const vpDurSec = vp.durationSec;

        if (localX < hotW) {
            // Left hot zone
            const penetration = Math.max(0, hotW - localX) / hotW;
            const speed = -maxSpeed * vpDurSec * Math.pow(penetration, 2);
            currentSpeed = speed;
            if (!isActive.value) start();
            return rect.left + Math.max(0, localX);
        } else if (localX > w - hotW) {
            // Right hot zone
            const penetration = Math.max(0, localX - (w - hotW)) / hotW;
            const speed = maxSpeed * vpDurSec * Math.pow(penetration, 2);
            currentSpeed = speed;
            if (!isActive.value) start();
            return rect.left + Math.min(w, localX);
        } else {
            currentSpeed = 0;
            return clientX;
        }
    };

    /**
     * Returns the local X coordinate clamped to the container's visible area.
     */
    const clampedLocalX = (clientX: number): number => {
        const el = opts.containerRef.value;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        return Math.max(0, Math.min(el.clientWidth, clientX - rect.left));
    };

    return { update, stop, start, clampedLocalX, isActive };
}
