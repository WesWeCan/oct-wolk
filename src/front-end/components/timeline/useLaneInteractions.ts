import { onMounted, onUnmounted } from 'vue';

type Viewport = { startSec: number; durationSec: number; totalSec?: number; fps: number };

export function useLaneInteractions(
    elRef: { value: HTMLElement | null },
    opts: {
        getViewport: () => Viewport;
        onPan: (secDelta: number) => void;
        onZoom: (timeSec: number, factor: number) => void;
        onScrub?: (timeSec: number, frame: number) => void;
        enableScrub?: boolean;
    }
) {
    let isPointerDown = false;

    const onWheel = (e: WheelEvent) => {
        const el = elRef.value; if (!el) return;
        const vp = opts.getViewport();
        const w = Math.max(1, el.clientWidth);
        const rect = el.getBoundingClientRect();
        const cursorX = (e.clientX - rect.left);
        const cursorTime = vp.startSec + (cursorX / w) * vp.durationSec;
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const factor = Math.exp(e.deltaY * 0.0015);
            opts.onZoom(cursorTime, factor);
            return;
        }
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.preventDefault();
            const secDelta = e.deltaX * (vp.durationSec / w);
            opts.onPan(secDelta);
        }
    };

    const onPointerDown = (e: PointerEvent) => {
        if (!opts.enableScrub || !opts.onScrub) return;
        const el = elRef.value; if (!el) return;
        el.setPointerCapture(e.pointerId);
        isPointerDown = true;
        const vp = opts.getViewport();
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const sec = vp.startSec + (localX / Math.max(1, el.clientWidth)) * vp.durationSec;
        opts.onScrub(Math.max(0, sec), Math.floor(sec * Math.max(1, vp.fps)));
    };
    const onPointerMove = (e: PointerEvent) => {
        if (!isPointerDown || !opts.enableScrub || !opts.onScrub) return;
        const el = elRef.value; if (!el) return;
        const vp = opts.getViewport();
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const sec = vp.startSec + (localX / Math.max(1, el.clientWidth)) * vp.durationSec;
        opts.onScrub(Math.max(0, sec), Math.floor(sec * Math.max(1, vp.fps)));
    };
    const onPointerUp = (e: PointerEvent) => {
        if (!isPointerDown) return;
        isPointerDown = false;
        const el = elRef.value; if (el) { try { el.releasePointerCapture(e.pointerId); } catch {} }
    };

    onMounted(() => {
        const el = elRef.value; if (!el) return;
        el.addEventListener('wheel', onWheel, { passive: false } as any);
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointercancel', onPointerUp);
    });
    onUnmounted(() => {
        const el = elRef.value; if (!el) return;
        el.removeEventListener('wheel', onWheel as any);
        el.removeEventListener('pointerdown', onPointerDown as any);
        el.removeEventListener('pointermove', onPointerMove as any);
        el.removeEventListener('pointerup', onPointerUp as any);
        el.removeEventListener('pointercancel', onPointerUp as any);
    });
}


