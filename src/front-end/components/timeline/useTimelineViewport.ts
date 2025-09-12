import { shallowRef, watch, toRaw } from 'vue';

export interface TimelineViewport {
    startSec: number;        // left of view window (seconds)
    durationSec: number;     // view window length (seconds)
    totalSec: number;        // total content length (seconds)
    fps: number;
}

export interface TimelinePlayhead { frame: number; }

export type InteractionMode = 'idle' | 'scrub' | 'pan' | 'resize' | 'edit';

export interface InteractionState {
    mode: InteractionMode;
    dragState?: Record<string, any> | null;
}

type Listener = (evt: string, payload?: any) => void;

export function useTimelineViewport(initial: Partial<TimelineViewport> = {}) {
    const viewport = shallowRef<TimelineViewport>({
        startSec: initial.startSec ?? 0,
        durationSec: initial.durationSec ?? 30,
        totalSec: (initial as any).totalSec ?? Math.max(30, initial.durationSec || 30),
        fps: initial.fps ?? 60,
    });
    const playhead = shallowRef<TimelinePlayhead>({ frame: 0 });
    const interaction = shallowRef<InteractionState>({ mode: 'idle', dragState: null });

    const listeners = new Set<Listener>();

    const emit = (evt: string, payload?: any) => {
        for (const fn of listeners) {
            try { fn(evt, payload); } catch {}
        }
    };

    const clamp = () => {
        const v = viewport.value;
        const total = Math.max(0.1, v.totalSec);
        const win = Math.min(Math.max(0.1, v.durationSec), total);
        viewport.value = { ...v, durationSec: win, startSec: Math.max(0, Math.min(v.startSec, total - win)) };
    };

    const setStart = (s: number) => { viewport.value = { ...viewport.value, startSec: Math.max(0, s) }; emit('viewport', toRaw(viewport.value)); };
    const setDuration = (w: number) => { viewport.value = { ...viewport.value, durationSec: Math.max(0.1, w) }; clamp(); emit('viewport', toRaw(viewport.value)); };
    const setTotal = (t: number) => { viewport.value = { ...viewport.value, totalSec: Math.max(0.1, t) }; clamp(); emit('viewport', toRaw(viewport.value)); };
    const setZoomAround = (timeSec: number, factor: number) => {
        const v = viewport.value;
        const total = Math.max(0.1, v.totalSec);
        const newWin = Math.max(0.1, Math.min(v.durationSec * factor, total));
        const rel = (timeSec - v.startSec) / Math.max(1e-6, v.durationSec);
        let newStart = timeSec - rel * newWin;
        newStart = Math.max(0, Math.min(total - newWin, newStart));
        viewport.value = { ...v, startSec: newStart, durationSec: newWin };
        clamp();
        emit('viewport', toRaw(viewport.value));
    };
    const setPlayhead = (frame: number) => { playhead.value = { frame: Math.max(0, Math.floor(frame)) }; emit('playhead', playhead.value); };
    const panBy = (secDelta: number) => {
        const v = viewport.value;
        const total = Math.max(0.1, v.totalSec);
        const win = Math.min(Math.max(0.1, v.durationSec), total);
        const next = Math.max(0, Math.min(total - win, v.startSec + secDelta));
        viewport.value = { ...v, startSec: next };
        emit('viewport', toRaw(viewport.value));
    };

    const snapTo = (opts: { beats?: number[]; seconds?: number; frames?: number }) => {
        return (timeSec: number): number => {
            let t = timeSec;
            if (opts.frames) {
                const step = (opts.frames / Math.max(1, viewport.value.fps));
                t = Math.round(t / step) * step;
            } else if (typeof opts.seconds === 'number') {
                const step = Math.max(1e-6, opts.seconds);
                t = Math.round(t / step) * step;
            } else if (opts.beats && opts.beats.length) {
                let best = opts.beats[0];
                let bestD = Math.abs(best - t);
                for (const b of opts.beats) {
                    const d = Math.abs(b - t);
                    if (d < bestD) { best = b; bestD = d; }
                }
                t = best;
            }
            return t;
        };
    };

    const subscribe = (fn: Listener) => { listeners.add(fn); return () => listeners.delete(fn); };

    watch(viewport, (v) => emit('viewport', v), { deep: true });
    watch(playhead, (p) => emit('playhead', p));
    watch(interaction, (i) => emit('interaction', i), { deep: true });

    return { viewport, playhead, interaction, setStart, setDuration, setTotal, setZoomAround, setPlayhead, panBy, snapTo, subscribe };
}


